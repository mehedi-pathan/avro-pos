import { promises as fs } from "node:fs";
import path from "node:path";
import http from "node:http";
import { URL } from "node:url";
import { randomBytes } from "node:crypto";
import { BrowserWindow, app } from "electron";
import { google } from "googleapis";
import Store from "electron-store";

const SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/userinfo.email"];
const TOKEN_KEY = "googleDriveTokens";

const store = new Store({
  name: "avro-pos-google-drive",
  encryptionKey: "avro-pos-drive-v1",
});

interface StoredTokens {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

async function loadCredentials() {
  const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!rawPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS not set. Point it to your OAuth client credentials JSON file.");
  }
  const projectRoot = app.isPackaged ? process.resourcesPath : process.cwd();
  const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.join(projectRoot, rawPath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);
  return parsed.installed ?? parsed.web;
}

function getOAuth2Client(credentials: { client_secret: string; client_id: string; redirect_uris: string[] }) {
  return new google.auth.OAuth2(credentials.client_id, credentials.client_secret, credentials.redirect_uris[0]);
}

async function startLocalServer(port: number): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to start local server"));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
    server.on("error", reject);
  });
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = http.createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      if (!addr || typeof addr === "string") {
        s.close();
        reject(new Error("Failed to find free port"));
        return;
      }
      const port = (addr as any).port;
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });
}

export async function authenticateWithGoogle(): Promise<{ email: string }> {
  const creds = await loadCredentials();
  const oauth2Client = getOAuth2Client(creds);
  const port = await findFreePort();
  const { server, url: redirectUri } = await startLocalServer(port);

  const state = randomBytes(16).toString("hex");
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state,
    prompt: "consent",
    redirect_uri: redirectUri,
  });

  const win = new BrowserWindow({
    width: 600,
    height: 700,
    title: "Google Drive - Sign In",
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  store.delete(TOKEN_KEY);

  try {
    const code = await new Promise<string>((resolve, reject) => {
      server.on("request", (req, res) => {
        const reqUrl = new URL(req.url ?? "/", redirectUri);
        if (reqUrl.searchParams.get("state") !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>State mismatch</h1>");
          return;
        }
        const codeVal = reqUrl.searchParams.get("code");
        if (codeVal) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h1>Authentication successful! You may close this window.</h1>");
          resolve(codeVal);
          win.close();
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(`<h1>Error: ${reqUrl.searchParams.get("error") ?? "Unknown"}</h1>`);
          reject(new Error(reqUrl.searchParams.get("error") ?? "OAuth callback missing code"));
        }
      });

      win.on("closed", () => reject(new Error("Authentication cancelled")));
      win.loadURL(authUrl);
    });

    const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri });
    oauth2Client.setCredentials(tokens);
    store.set(TOKEN_KEY, tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    return { email: data.email ?? "unknown" };
  } finally {
    server.close();
    if (!win.isDestroyed()) win.destroy();
  }
}

export async function signOutFromGoogle(): Promise<void> {
  store.delete(TOKEN_KEY);
}

export async function getGoogleDriveAuthStatus(): Promise<{ authenticated: boolean; email?: string }> {
  const tokens = store.get(TOKEN_KEY) as StoredTokens | undefined;
  if (!tokens?.access_token) return { authenticated: false };

  try {
    const creds = await loadCredentials();
    const oauth2Client = getOAuth2Client(creds);
    oauth2Client.setCredentials(tokens);

    if (tokens.expiry_date && Date.now() >= tokens.expiry_date && tokens.refresh_token) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      store.set(TOKEN_KEY, credentials);
      oauth2Client.setCredentials(credentials);
    }

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    return { authenticated: true, email: data.email ?? "unknown" };
  } catch {
    return { authenticated: false };
  }
}

export async function getDriveClient() {
  const tokens = store.get(TOKEN_KEY) as StoredTokens | undefined;
  if (!tokens?.access_token) throw new Error("Not authenticated with Google Drive");

  const creds = await loadCredentials();
  const oauth2Client = getOAuth2Client(creds);
  oauth2Client.setCredentials(tokens);

  if (tokens.expiry_date && Date.now() >= tokens.expiry_date && tokens.refresh_token) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    store.set(TOKEN_KEY, credentials);
    oauth2Client.setCredentials(credentials);
  }

  return google.drive({ version: "v3", auth: oauth2Client });
}
