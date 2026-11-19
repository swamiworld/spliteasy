const pad = (n: number) => String(n).padStart(2, '0');

/** ms -> "YYYY-MM-DD" in local time (value for <input type="date">). */
export function toISODate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" -> ms at local noon (avoids timezone day-shifts). */
export function fromISODate(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
}

export function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
