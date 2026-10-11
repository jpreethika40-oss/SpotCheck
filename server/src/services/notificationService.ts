import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: string;
  entityType?: string;
  entityId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const notif = await prisma.appNotification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        isRead: false,
      },
    });
    return notif;
  } catch (err: any) {
    logger.error('Failed to create in-app notification', { error: err.message, params });
    return null;
  }
}
