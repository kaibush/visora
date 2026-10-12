export function parseAgent(ua) {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\/|FxiOS\//.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Other'
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Other'
  const device =
    /iPad|Tablet/.test(ua) || (os === 'Android' && !/Mobile/.test(ua))
      ? 'Tablet'
      : /Mobile|iPhone/.test(ua)
        ? 'Mobile'
        : ua
          ? 'Desktop'
          : 'Unknown'
  return { browser, os, device }
}
