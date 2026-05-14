import bcrypt from "bcryptjs";
import { db } from "./database";
import { normalizeRole } from "./capabilities";

export async function login(username: string, password: string, ipAddress = "local") {
  const user = await db().user.findUnique({ where: { username } });

  if (!user) {
    return { ok: false as const, error: "Invalid username or password." };
  }

  if (!user.isActive) {
    return { ok: false as const, error: "This account is suspended." };
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return { ok: false as const, error: "Invalid username or password." };
  }

  const updatedUser = await db().user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress
    }
  });

  return {
    ok: true as const,
    user: {
      id: updatedUser.id,
      staffId: updatedUser.staffId,
      username: updatedUser.username,
      displayName: updatedUser.displayName,
      avatarUrl: updatedUser.avatarUrl,
      role: normalizeRole(updatedUser.role)
    }
  };
}
