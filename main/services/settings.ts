import { db } from "./database";
import { auditLog } from "./audit";

export type BusinessSettings = {
  businessName: string;
  address: string;
  taxId: string;
  binNumber?: string;
  tinNumber?: string;
  tradeLicenseNumber?: string;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  verifiedPhone?: string;
  email?: string;
  website?: string;
  socialLinks?: string;
  mushakRegistration?: string;
  businessLogoPath?: string;
  currencySymbol: string;
  lowStockEmail: string;
  taxRate: string;
  lastCloudSyncAt: string | null;
};

const defaults: BusinessSettings = {
  businessName: "Avro POS",
  address: "",
  taxId: "",
  binNumber: "",
  tinNumber: "",
  tradeLicenseNumber: "",
  branchId: "",
  branchName: "",
  branchAddress: "",
  verifiedPhone: "",
  email: "",
  website: "",
  socialLinks: "",
  mushakRegistration: "",
  businessLogoPath: "",
  currencySymbol: "৳",
  lowStockEmail: "",
  taxRate: "5",
  lastCloudSyncAt: null
};

export async function getSettings(): Promise<BusinessSettings> {
  const rows = await db().setting.findMany();
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    ...defaults,
    ...Object.fromEntries(values),
    lastCloudSyncAt: values.get("lastCloudSyncAt") ?? null
  };
}

export async function updateSettings(input: Partial<BusinessSettings> & { actorId?: string }) {
  const entries = Object.entries(input).filter(([key, value]) => key !== "actorId" && value !== undefined);
  await db().$transaction(
    entries.map(([key, value]) =>
      db().setting.upsert({
        where: { key },
        create: { key, value: String(value ?? "") },
        update: { value: String(value ?? "") }
      })
    )
  );

  await auditLog({
    actorId: input.actorId,
    action: "SETTINGS_UPDATED",
    entityType: "Setting",
    description: `Updated business settings: ${entries.map(([key]) => key).join(", ")}.`
  });

  return getSettings();
}

export async function setLastCloudSyncNow() {
  const timestamp = new Date().toISOString();
  await db().setting.upsert({
    where: { key: "lastCloudSyncAt" },
    create: { key: "lastCloudSyncAt", value: timestamp },
    update: { value: timestamp }
  });
  return timestamp;
}
