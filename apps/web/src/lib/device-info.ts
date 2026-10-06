// User-agent parsing for the account page's active sessions list.
// Best-effort detection: unknown agents degrade to generic labels instead
// of showing the raw user-agent string in the UI.

export interface DeviceInfo {
  browser: string;
  os: string;
}

export function parseUserAgent(userAgent: string | null | undefined): DeviceInfo {
  const ua = userAgent ?? "";
  if (!ua) return { browser: "Navegador desconhecido", os: "" };

  // Browser — order matters (Chromium derivatives must be checked first).
  let browser = "Navegador desconhecido";
  if (/Edg(?:A|iOS)?\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  // Operating system.
  let os = "";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  return { browser, os };
}
