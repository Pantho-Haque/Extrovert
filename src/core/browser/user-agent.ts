/**
 * A plain Chrome user agent (no "Electron/" or app tokens), so services serve their normal
 * web app instead of an "unsupported browser" page (FR-S04).
 */
export function chromeUserAgent(platform: NodeJS.Platform, chromeVersion: string): string {
  const major = chromeVersion.split('.')[0];
  const os =
    platform === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7'
    : platform === 'win32' ? 'Windows NT 10.0; Win64; x64'
    : 'X11; Linux x86_64';
  // Chrome freezes the minor/build numbers to 0.0.0 in its real UA, so we do the same.
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}
