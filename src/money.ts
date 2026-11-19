export const CURRENCY = '₹';

/** "12.5" -> 1250 (integer minor units). Returns null if invalid. */
export function parseMoney(s: string): number | null {
  const t = s.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

export function fmt(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100).toLocaleString('en-IN');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${CURRENCY}${whole}.${frac}`;
}

/** Split `amount` equally among uids; leftover minor units go to the first people. */
export function equalSplit(amount: number, uids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  if (uids.length === 0) return out;
  const base = Math.floor(amount / uids.length);
  let rem = amount - base * uids.length;
  for (const u of uids) {
    out[u] = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
  }
  return out;
}
