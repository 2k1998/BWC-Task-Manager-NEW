/**
 * Backend API origin from NEXT_PUBLIC_API_URL (no trailing slash).
 * Set in .env / .env.local — do not hardcode hosts in call sites.
 */
export function getPublicApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw == null || raw === '') return '';
  return raw.trim().replace(/\/+$/, '');
}

/** WebSocket origin derived from the same public API URL (http→ws, https→wss). */
export function getPublicWsBaseUrl(): string {
  const apiBase = getPublicApiBaseUrl();
  if (!apiBase) return '';
  if (apiBase.startsWith('https://')) return apiBase.replace('https://', 'wss://');
  if (apiBase.startsWith('http://')) return apiBase.replace('http://', 'ws://');
  return apiBase;
}
