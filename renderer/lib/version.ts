export function getAppVersion(): string {
  // This will be replaced at build time or read from package.json
  // For now, we'll extract it from the global scope or return a default
  try {
    const pkg = require("../../package.json");
    return pkg.version;
  } catch {
    return "2.0.3+12";
  }
}

// Synchronous version that works in the browser
export const APP_VERSION = "2.0.3+12";
