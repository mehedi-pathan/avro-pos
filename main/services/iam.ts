import bcrypt from "bcryptjs";
import { db } from "./database";
import { auditLog } from "./audit";
import { normalizeRole } from "./capabilities";

function initialsFromName(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "ST";
}

export async function generateUniqueID(displayName: string, joinedAtInput?: string | Date) {
  const joinedAt = joinedAtInput ? new Date(joinedAtInput) : new Date();
  const year = joinedAt.getFullYear();
  const prefix = `AV-${year}`;
  const count = await db().user.count({
    where: {
      staffId: {
        startsWith: prefix
      }
    }
  });
  const sequence = String(count + 1).padStart(3, "0");
  return `${prefix}-${sequence}-${initialsFromName(displayName)}`;
}

function publicUser(user: {
  id: string;
  staffId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  joinedAt: Date;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...user,
    role: normalizeRole(user.role),
    joinedAt: user.joinedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export async function listUsers() {
  const users = await db().user.findMany({ orderBy: [{ role: "asc" }, { displayName: "asc" }] });
  return users.map(publicUser);
}

export async function createUser(input: {
  actorId?: string;
  username: string;
  displayName: string;
  password: string;
  role: string;
  joinedAt?: string;
}) {
  const role = normalizeRole(input.role);
  if (role === "OWNER") {
    throw new Error("Create additional Owner accounts manually after business verification.");
  }

  const joinedAt = input.joinedAt ? new Date(input.joinedAt) : new Date();
  const staffId = await generateUniqueID(input.displayName, joinedAt);
  const user = await db().user.create({
    data: {
      staffId,
      username: input.username,
      displayName: input.displayName,
      passwordHash: await bcrypt.hash(input.password, 12),
      role,
      joinedAt
    }
  });

  await auditLog({
    actorId: input.actorId,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    description: `Created ${role} account ${staffId} for ${input.displayName}.`
  });

  return publicUser(user);
}

export async function updateProfile(input: {
  actorId: string;
  targetUserId: string;
  displayName?: string;
  avatarUrl?: string | null;
  password?: string;
  role?: string;
  isActive?: boolean;
  actorRole?: string;
}) {
  const ownerEdit = normalizeRole(input.actorRole ?? "") === "OWNER";
  const selfEdit = input.actorId === input.targetUserId;
  if (!ownerEdit && !selfEdit) {
    throw new Error("Users can only update their own profile.");
  }

  const data: {
    displayName?: string;
    avatarUrl?: string | null;
    passwordHash?: string;
    role?: string;
    isActive?: boolean;
  } = {};

  if (input.displayName !== undefined) data.displayName = input.displayName;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 12);
  if (input.role !== undefined || input.isActive !== undefined) {
    if (!ownerEdit) {
      throw new Error("Only the Owner can change roles or suspend accounts.");
    }
    if (input.role !== undefined) data.role = normalizeRole(input.role);
    if (input.isActive !== undefined) data.isActive = input.isActive;
  }

  const user = await db().user.update({
    where: { id: input.targetUserId },
    data
  });

  await auditLog({
    actorId: input.actorId,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: user.id,
    description: `Updated staff profile ${user.staffId}.`,
    metadata: { changed: Object.keys(data) }
  });

  return publicUser(user);
}
