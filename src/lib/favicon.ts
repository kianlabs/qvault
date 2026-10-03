// QVAULT — helper favicon & inisial avatar (Wave 3, Agent D).
import { hostnameFromUrl, initials } from "./utils";

/**
 * URL favicon Google untuk sebuah URL. Kembalikan `null` bila url kosong
 * atau host-nya tidak bisa ditentukan.
 */
export function faviconUrl(url: string | null | undefined): string | null {
  const host = hostnameFromUrl(url);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

/** Inisial untuk fallback avatar (delegasi ke `initials` di utils). */
export function avatarInitials(name: string): string {
  return initials(name);
}
