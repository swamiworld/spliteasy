import type { Expense } from './balances';
import { fmt } from './money';
import { toISODate, fmtDate } from './dates';

export type Snap = Pick<Expense, 'description' | 'amount' | 'paidBy' | 'date' | 'splits'>;

export const snap = (e: Snap): Snap => ({
  description: e.description, amount: e.amount, paidBy: e.paidBy, date: e.date, splits: { ...e.splits },
});

export interface LogEntry {
  id: string;
  action: 'add' | 'edit' | 'delete';
  expenseId: string;
  by: string;
  byName: string;
  at: number;
  description: string;
  amount: number;
  before?: Snap;
  after?: Snap;
}

const splitKey = (s: Record<string, number>) =>
  JSON.stringify(Object.entries(s).sort(([a], [b]) => a.localeCompare(b)));

/** Human-readable list of what changed between two versions of an expense. */
export function diff(before: Snap, after: Snap, name: (uid: string) => string): string[] {
  const out: string[] = [];
  if (before.description !== after.description) out.push(`description “${before.description}” → “${after.description}”`);
  if (before.amount !== after.amount) out.push(`amount ${fmt(before.amount)} → ${fmt(after.amount)}`);
  if (before.paidBy !== after.paidBy) out.push(`paid by ${name(before.paidBy)} → ${name(after.paidBy)}`);
  if (toISODate(before.date) !== toISODate(after.date)) out.push(`date ${fmtDate(before.date)} → ${fmtDate(after.date)}`);
  if (splitKey(before.splits) !== splitKey(after.splits)) out.push('split changed');
  return out;
}

export function describe(l: LogEntry, name: (uid: string) => string): string {
  const who = l.byName || 'Someone';
  if (l.action === 'add') return `${who} added “${l.description}” ${fmt(l.amount)}`;
  if (l.action === 'delete') return `${who} deleted “${l.description}” (${fmt(l.amount)})`;
  const changes = l.before && l.after ? diff(l.before, l.after, name) : [];
  return `${who} edited “${l.description}”${changes.length ? ': ' + changes.join('; ') : ''}`;
}
