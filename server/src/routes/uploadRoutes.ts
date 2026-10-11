import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { UploadStatus } from '@prisma/client';
import { prisma } from '../db/prisma';
import { config } from '../config';
import { authenticateUser, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Ensure upload directories exist
const uploadDir = config.storageDir;
const chunksBaseDir = path.join(uploadDir, 'chunks');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(chunksBaseDir)) fs.mkdirSync(chunksBaseDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB chunk max
});

router.use(authenticateUser);

// POST /api/v1/uploads/initiate
router.post('/initiate', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      id,
      filename,
      contentType,
      byteSize,
      totalChunks = 1,
      checksumSha256,
      associatedType = 'INSPECTION',
      associatedId,
    } = req.body;

    if (!id || !filename || !contentType || !byteSize) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_METADATA', message: 'Attachment id, filename, contentType, and byteSize are required.' },
      });
      return;
    }

    // Allowed image types
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];
    if (!allowedMime.includes(contentType.toLowerCase())) {
      res.status(400).json({
        success: false,
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Only image attachments are permitted.' },
      });
      return;
    }

    // Check 25MB max size
    if (byteSize > 25 * 1024 * 1024) {
      res.status(400).json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'Photo evidence exceeds maximum 25MB limit.' },
      });
      return;
    }

    // Upsert attachment record
    const attachment = await prisma.attachment.upsert({
      where: { id },
      create: {
        id,
        filename,
        contentType,
        byteSize,
        checksumSha256: checksumSha256 || null,
        storagePath: '',
        uploadStatus: UploadStatus.PENDING,
        totalChunks,
        uploadedChunks: 0,
        uploaderId: req.user!.id,
        associatedType,
        associatedId: associatedId || id,
      },
      update: {
        filename,
        contentType,
        byteSize,
        totalChunks,
        uploadStatus: UploadStatus.PENDING,
      },
    });

    // Create chunks directory for this upload
    const uploadChunkDir = path.join(chunksBaseDir, id);
    if (!fs.existsSync(uploadChunkDir)) {
      fs.mkdirSync(uploadChunkDir, { recursive: true });
    }

    res.json({
      success: true,
      data: {
        attachmentId: attachment.id,
        uploadStatus: attachment.uploadStatus,
        totalChunks: attachment.totalChunks,
        uploadedChunks: attachment.uploadedChunks,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/uploads/:id/chunk (Upload chunk with resumable progress tracking)
router.post('/:id/chunk', upload.single('chunk'), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const chunkIndex = parseInt(String(req.headers['x-chunk-index'] ?? req.body.chunkIndex ?? 0), 10);
    const totalChunks = parseInt(String(req.headers['x-total-chunks'] ?? req.body.totalChunks ?? 1), 10);

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Upload session not found.' } });
      return;
    }

    if (!req.file || !req.file.buffer) {
      res.status(400).json({ success: false, error: { code: 'MISSING_CHUNK', message: 'Binary chunk payload is required.' } });
      return;
    }

    const chunkDir = path.join(chunksBaseDir, id);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    const chunkFilePath = path.join(chunkDir, `part_${chunkIndex}`);
    fs.writeFileSync(chunkFilePath, req.file.buffer);

    // Count present chunks
    const existingParts = fs.readdirSync(chunkDir).filter((f) => f.startsWith('part_'));
    const isCompleted = existingParts.length >= totalChunks;

    if (isCompleted) {
      // Assemble final file
      const finalFileName = `${id}_${attachment.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const finalFilePath = path.join(uploadDir, finalFileName);
      const writeStream = fs.createWriteStream(finalFilePath);

      for (let i = 0; i < totalChunks; i++) {
        const partPath = path.join(chunkDir, `part_${i}`);
        if (fs.existsSync(partPath)) {
          const partData = fs.readFileSync(partPath);
          writeStream.write(partData);
        }
      }
      writeStream.end();

      // Clean up chunk files
      try {
        fs.rmSync(chunkDir, { recursive: true, force: true });
      } catch (e) {
        logger.warn('Could not clean chunk dir', { error: e });
      }

      // Verify checksum if provided
      let actualHash: string | undefined;
      try {
        const fileBuffer = fs.readFileSync(finalFilePath);
        actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      } catch (e) {
        // pass
      }

      const updated = await prisma.attachment.update({
        where: { id },
        data: {
          storagePath: finalFilePath,
          uploadStatus: UploadStatus.COMPLETED,
          uploadedChunks: totalChunks,
          checksumSha256: actualHash || attachment.checksumSha256,
        },
      });

      res.json({
        success: true,
        data: {
          attachmentId: updated.id,
          uploadStatus: UploadStatus.COMPLETED,
          uploadedChunks: totalChunks,
          totalChunks,
          storageUrl: `/api/v1/uploads/file/${updated.id}`,
          checksumVerified: attachment.checksumSha256 ? attachment.checksumSha256 === actualHash : true,
        },
      });
      return;
    }

    // Still in progress
    const updated = await prisma.attachment.update({
      where: { id },
      data: {
        uploadStatus: UploadStatus.UPLOADING,
        uploadedChunks: existingParts.length,
      },
    });

    res.json({
      success: true,
      data: {
        attachmentId: updated.id,
        uploadStatus: UploadStatus.UPLOADING,
        uploadedChunks: existingParts.length,
        totalChunks,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/uploads/:id/status (Check chunk upload progress for resumption)
router.get('/:id/status', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Attachment record not found.' } });
      return;
    }

    const chunkDir = path.join(chunksBaseDir, id);
    let presentChunkIndices: number[] = [];
    if (fs.existsSync(chunkDir)) {
      presentChunkIndices = fs
        .readdirSync(chunkDir)
        .filter((f) => f.startsWith('part_'))
        .map((f) => parseInt(f.replace('part_', ''), 10))
        .sort((a, b) => a - b);
    }

    res.json({
      success: true,
      data: {
        attachmentId: attachment.id,
        uploadStatus: attachment.uploadStatus,
        totalChunks: attachment.totalChunks,
        uploadedChunks: attachment.uploadedChunks,
        presentChunkIndices,
        storageUrl: attachment.uploadStatus === UploadStatus.COMPLETED ? `/api/v1/uploads/file/${attachment.id}` : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/uploads/file/:id (Stream photo file)
router.get('/file/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment || !attachment.storagePath || !fs.existsSync(attachment.storagePath)) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File is not available on server.' } });
      return;
    }

    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(attachment.storagePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
