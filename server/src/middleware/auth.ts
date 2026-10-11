import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../db/prisma';
import { config } from '../config';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  facilityIds: string[];
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authenticateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check HttpOnly cookie
    if (req.cookies && req.cookies.spotcheck_session) {
      token = req.cookies.spotcheck_session;
    }
    // 2. Fallback to Authorization: Bearer <token> header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication session token required. Please sign in.',
        },
      });
      return;
    }

    // Verify JWT
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Session expired or token invalid. Please log in again.',
        },
      });
      return;
    }

    if (!decoded || !decoded.userId) {
      res.status(401).json({
        success: false,
        error: { code: 'MALFORMED_TOKEN', message: 'Token payload missing user identifier.' },
      });
      return;
    }

    // Recheck active user in database (Mandatory for immediate revocation enforcement)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        assignedFacilities: {
          select: { facilityId: true },
        },
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User account not found.' },
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: {
          code: 'USER_REVOKED',
          message: 'Account access has been suspended or revoked. Operations cannot proceed.',
        },
      });
      return;
    }

    const facilityIds = user.assignedFacilities.map((f) => f.facilityId);

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      facilityIds,
    };

    next();
  } catch (err: any) {
    next(err);
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_ROLE',
          message: `Forbidden. Role '${req.user.role}' is not authorized for this resource. Required: [${roles.join(', ')}].`,
        },
      });
      return;
    }

    next();
  };
}

export function requireFacilityAccess(getFacilityId: (req: AuthRequest) => string | undefined) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Auth required' } });
      return;
    }

    // Facility Managers have global facility oversight
    if (req.user.role === UserRole.FACILITY_MANAGER) {
      next();
      return;
    }

    const facilityId = getFacilityId(req);
    if (!facilityId) {
      next();
      return;
    }

    if (!req.user.facilityIds.includes(facilityId)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FACILITY_ACCESS_DENIED',
          message: 'You are not assigned to this facility.',
        },
      });
      return;
    }

    next();
  };
}
