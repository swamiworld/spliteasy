import { describe as suite, it, expect } from 'vitest';
import { diff, describe as describeLog, LogEntry } from './changes';
import { fromISODate, toISODate } from './dates';

const base = { description: 'Dinner', amount: 30000, paidBy: 'a', date: fromISODate('2026-11-01'), splits: { a: 15000, b: 15000 } };
const name = (u: string) => u.toUpperCase();

suite('dates', () => {
  it('round-trips ISO dates', () => {
    expect(toISODate(fromISODate('2026-01-31'))).toBe('2026-01-31');
  });
});

suite('diff', () => {
  it('detects nothing when identical', () => {
    expect(diff(base, { ...base, splits: { b: 15000, a: 15000 } }, name)).toEqual([]);
  });
  it('lists each changed field', () => {
    const after = { ...base, amount: 40000, paidBy: 'b', date: fromISODate('2026-11-02'), description: 'Lunch', splits: { a: 40000 } };
    const d = diff(base, after, name);
    expect(d).toHaveLength(5);
    expect(d.join('|')).toContain('₹300.00 → ₹400.00');
    expect(d.join('|')).toContain('A → B');
  });
  it('describes log entries', () => {
    const l: LogEntry = { id: '1', action: 'delete', expenseId: 'e', by: 'a', byName: 'Asha', at: 0, description: 'Dinner', amount: 30000 };
    expect(describeLog(l, name)).toBe('Asha deleted “Dinner” (₹300.00)');
  });
});
