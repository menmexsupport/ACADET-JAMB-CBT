import { db } from '../../db/index.ts';
import { auditLogs } from '../../db/schema.ts';

export async function logAuditEvent(params: {
  actorId?: string | null;
  actorRole: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: params.actorId || null,
      actorRole: params.actorRole,
      actorEmail: params.actorEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      details: params.details || {},
      ipAddress: params.ipAddress || null,
    });
  } catch (err) {
    console.error('[audit] Failed to record audit log:', err);
  }
}
