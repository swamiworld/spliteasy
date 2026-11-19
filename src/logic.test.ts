import { describe, it, expect } from 'vitest';
import { equalSplit, parseMoney } from './money';
import { netBalances, simplify, Expense } from './balances';

describe('money', () => {
  it('parses', () => {
    expect(parseMoney('12.5')).toBe(1250);
    expect(parseMoney('100')).toBe(10000);
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
  });
  it('splits equally with remainder', () => {
    const s = equalSplit(100, ['a', 'b', 'c']);
    expect(Object.values(s).reduce((x, y) => x + y, 0)).toBe(100);
    expect(s).toEqual({ a: 34, b: 33, c: 33 });
  });
});

describe('balances', () => {
  const e = (paidBy: string, amount: number, splits: Record<string, number>, type: Expense['type'] = 'expense'): Expense =>
    ({ id: Math.random() + '', type, description: '', amount, paidBy, splits, date: 0, createdBy: paidBy });

  it('nets to zero and simplifies chain', () => {
    // A paid 300 for A,B,C ; B paid 300 for A,B,C
    const ex = [e('A', 300, { A: 100, B: 100, C: 100 }), e('B', 300, { A: 100, B: 100, C: 100 })];
    const net = netBalances(ex, ['A', 'B', 'C']);
    expect(net).toEqual({ A: 100, B: 100, C: -200 });
    const t = simplify(net);
    expect(t.reduce((s, x) => s + x.amount, 0)).toBe(200);
    expect(t.every((x) => x.from === 'C')).toBe(true);
  });
  it('settlement clears debt', () => {
    const ex = [e('A', 200, { A: 100, B: 100 }), e('B', 100, { A: 100 }, 'settlement')];
    expect(simplify(netBalances(ex, ['A', 'B']))).toEqual([]);
  });
});
