import { db } from "./database";

export async function auditLog(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: unknown;
}) {
  return db().auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null
    }
  });
}

export async function getAuditLogs(limit = 100) {
  return db().auditLog.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      actor: {
        select: {
          staffId: true,
          displayName: true,
          username: true,
          role: true
        }
      }
    }
  });
}
