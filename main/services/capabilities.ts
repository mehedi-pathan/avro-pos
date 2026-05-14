export type Role = "OWNER" | "MANAGER" | "SALESMAN";

export type Capability =
  | "CHECKOUT"
  | "INVENTORY_READ"
  | "INVENTORY_WRITE"
  | "REPORTS"
  | "TEAM_MANAGE"
  | "DELETE_RECORDS"
  | "CLOUD_SYNC"
  | "SETTINGS";

export const capabilityMap: Record<Role, Capability[]> = {
  SALESMAN: ["CHECKOUT"],
  MANAGER: ["CHECKOUT", "INVENTORY_READ", "INVENTORY_WRITE", "REPORTS"],
  OWNER: ["CHECKOUT", "INVENTORY_READ", "INVENTORY_WRITE", "REPORTS", "TEAM_MANAGE", "DELETE_RECORDS", "CLOUD_SYNC", "SETTINGS"]
};

export function normalizeRole(role: string): Role {
  if (role === "OWNER" || role === "MANAGER" || role === "SALESMAN") {
    return role;
  }
  return "SALESMAN";
}

export function hasCapability(role: string, capability: Capability) {
  return capabilityMap[normalizeRole(role)].includes(capability);
}

export function assertCapability(role: string, capability: Capability) {
  if (!hasCapability(role, capability)) {
    throw new Error(`Missing capability: ${capability}`);
  }
}
