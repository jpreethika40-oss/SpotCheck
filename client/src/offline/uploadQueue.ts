import { db, OfflineUploadItem } from './db';
import { api } from '../api/client';

export type UploadQueueListener = (status: {
  isUploading: boolean;
  pendingCount: number;
  activeUploadId?: string;
  progressPercent: number;
}) => void;

class UploadQueueService {
  private isUploading = false;
  private listeners: Set<UploadQueueListener> = new Set();
  private chunkSize = 512 * 1024; // 512 KB chunk size

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.processQueue();
      });
    }
  }

  public subscribe(listener: UploadQueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(data: { isUploading: boolean; pendingCount: number; activeUploadId?: string; progressPercent: number }) {
    this.listeners.forEach((l) => l(data));
  }

  public async getPendingUploads(): Promise<OfflineUploadItem[]> {
    return await db.offlineUploads.where('uploadStatus').anyOf(['PENDING', 'UPLOADING', 'FAILED']).toArray();
  }

  public async enqueuePhoto(
    blob: Blob,
    filename: string,
    associatedType: 'INSPECTION' | 'ISSUE' | 'WORK_ORDER_EVENT',
    associatedId: string
  ): Promise<OfflineUploadItem> {
    const id = crypto.randomUUID();
    const byteSize = blob.size;
    const totalChunks = Math.max(1, Math.ceil(byteSize / this.chunkSize));

    const item: OfflineUploadItem = {
      id,
      associatedType,
      associatedId,
      filename,
      contentType: blob.type || 'image/jpeg',
      byteSize,
      blob,
      uploadStatus: 'PENDING',
      totalChunks,
      uploadedChunks: 0,
      createdAt: new Date().toISOString(),
    };

    await db.offlineUploads.put(item);

    // If online, start processing
    if (navigator.onLine) {
      setTimeout(() => this.processQueue(), 50);
    }

    return item;
  }

  public async processQueue(): Promise<void> {
    if (this.isUploading || !navigator.onLine) return;

    this.isUploading = true;

    try {
      const pendingItems = await this.getPendingUploads();
      if (pendingItems.length === 0) {
        this.isUploading = false;
        this.notify({ isUploading: false, pendingCount: 0, progressPercent: 100 });
        return;
      }

      for (const item of pendingItems) {
        if (!navigator.onLine) break;

        this.notify({
          isUploading: true,
          pendingCount: pendingItems.length,
          activeUploadId: item.id,
          progressPercent: Math.round((item.uploadedChunks / item.totalChunks) * 100),
        });

        try {
          // 1. Initiate upload on server
          const initRes = await api.post('/uploads/initiate', {
            id: item.id,
            filename: item.filename,
            contentType: item.contentType,
            byteSize: item.byteSize,
            totalChunks: item.totalChunks,
            associatedType: item.associatedType,
            associatedId: item.associatedId,
          });

          if (!initRes.success) {
            item.uploadStatus = 'FAILED';
            await db.offlineUploads.put(item);
            continue;
          }

          // 2. Query status to see which chunks are already present (resumability)
          const statusRes = await api.get(`/uploads/${item.id}/status`);
          const presentIndices: number[] = statusRes.data?.presentChunkIndices || [];

          // 3. Upload missing chunks
          const totalChunks = item.totalChunks;
          for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
            if (presentIndices.includes(chunkIdx)) {
              continue; // Already uploaded in previous attempt
            }

            const start = chunkIdx * this.chunkSize;
            const end = Math.min(item.byteSize, start + this.chunkSize);
            const chunkBlob = item.blob.slice(start, end);

            const formData = new FormData();
            formData.append('chunk', chunkBlob, `part_${chunkIdx}`);
            formData.append('chunkIndex', String(chunkIdx));
            formData.append('totalChunks', String(totalChunks));

            const chunkRes = await fetch(`/api/v1/uploads/${item.id}/chunk`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${localStorage.getItem('spotcheck_token') || ''}`,
                'x-chunk-index': String(chunkIdx),
                'x-total-chunks': String(totalChunks),
              },
              body: formData,
            });

            if (!chunkRes.ok) {
              throw new Error(`Chunk ${chunkIdx} upload failed with HTTP ${chunkRes.status}`);
            }

            item.uploadedChunks = chunkIdx + 1;
            item.uploadStatus = 'UPLOADING';
            await db.offlineUploads.put(item);

            this.notify({
              isUploading: true,
              pendingCount: pendingItems.length,
              activeUploadId: item.id,
              progressPercent: Math.round(((chunkIdx + 1) / totalChunks) * 100),
            });
          }

          // Marked completed
          item.uploadStatus = 'COMPLETED';
          item.storageUrl = `/api/v1/uploads/file/${item.id}`;
          await db.offlineUploads.put(item);
        } catch (err: any) {
          console.error(`Upload failed for item ${item.id}:`, err);
          item.uploadStatus = 'FAILED';
          await db.offlineUploads.put(item);
        }
      }
    } finally {
      this.isUploading = false;
      const remaining = await this.getPendingUploads();
      this.notify({
        isUploading: false,
        pendingCount: remaining.length,
        progressPercent: remaining.length === 0 ? 100 : 0,
      });
    }
  }
}

export const uploadQueue = new UploadQueueService();
