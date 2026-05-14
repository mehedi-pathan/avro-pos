import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { db, getDatabasePath } from "./database";
import { setLastCloudSyncNow } from "./settings";
import { getDriveClient } from "./googleDriveAuth";

const BACKUP_FILE_NAME = "avro_pos_backup.json";
const AVRO_FOLDER_NAME = "Avro POS";

async function ensureAvroFolder(drive: Awaited<ReturnType<typeof getDriveClient>>) {
  const existing = await drive.files.list({
    q: `name='${AVRO_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (existing.data.files?.[0]?.id) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: AVRO_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id, name",
  });

  return created.data.id!;
}

export async function syncToDrive() {
  const drive = await getDriveClient();
  const folderId = await ensureAvroFolder(drive);

  const [products, sales] = await Promise.all([
    db().product.findMany({ orderBy: { name: "asc" } }),
    db().sale.findMany({ include: { items: true, customer: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      source: getDatabasePath(),
      products,
      sales,
    },
    null,
    2,
  );

  const tempPath = path.join(path.dirname(getDatabasePath()), BACKUP_FILE_NAME);
  await fs.writeFile(tempPath, payload, "utf8");

  const existing = await drive.files.list({
    q: `name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  const media = {
    mimeType: "application/json",
    body: createReadStream(tempPath),
  };

  const fileId = existing.data.files?.[0]?.id;
  if (fileId) {
    const result = await drive.files.update({
      fileId,
      media,
      fields: "id, name, modifiedTime, webViewLink",
    });
    await setLastCloudSyncNow();
    return result.data;
  }

  const result = await drive.files.create({
    requestBody: {
      name: BACKUP_FILE_NAME,
      parents: [folderId],
    },
    media,
    fields: "id, name, modifiedTime, webViewLink",
  });

  await setLastCloudSyncNow();
  return result.data;
}
