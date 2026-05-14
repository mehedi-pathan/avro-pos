import { app } from "electron";

const REPO_OWNER = "mehedi-pathan";
const REPO_NAME = "avro-pos";
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

interface GithubRelease {
  tag_name: string;
  html_url: string;
  published_at: string;
  body: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
  }>;
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
}

function parseVersion(v: string): number[] {
  return v.replace(/^v/i, "").split(".").map(Number);
}

function isNewer(current: string, latest: string): boolean {
  const a = parseVersion(current);
  const b = parseVersion(latest);
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    if (vb > va) return true;
    if (vb < va) return false;
  }
  return false;
}

function platformAssetName(): string {
  switch (process.platform) {
    case "darwin": return ".dmg";
    case "win32": return ".exe";
    default: return "";
  }
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(GITHUB_API, {
      headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "avro-pos" },
    });
    if (!res.ok) return null;

    const release: GithubRelease = await res.json();
    const currentVersion = app.getVersion();
    const latestVersion = release.tag_name.replace(/^v/i, "");

    if (!isNewer(currentVersion, latestVersion)) {
      return {
        available: false,
        currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        releaseNotes: "",
        publishedAt: release.published_at,
        downloadUrl: "",
      };
    }

    const ext = platformAssetName();
    const asset = ext
      ? release.assets.find((a) => a.name.endsWith(ext))
      : release.assets[0];

    return {
      available: true,
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
      releaseNotes: release.body?.slice(0, 2000) ?? "",
      publishedAt: release.published_at,
      downloadUrl: asset?.browser_download_url ?? release.html_url,
    };
  } catch {
    return null;
  }
}
