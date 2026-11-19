export interface Expense {
  id: string;
  type: 'expense' | 'settlement';
  description: string;
  amount: number;
  paidBy: string;
  splits: Record<string, number>;
  date: number;
  createdBy: string;
}

export interface Transfer { from: string; to: string; amount: number }

/** Positive = is owed money, negative = owes money. */
export function netBalances(expenses: Expense[], memberIds: string[]): Record<string, number> {
  const net: Record<string, number> = {};
  for (const m of memberIds) net[m] = 0;
  for (const e of expenses) {
    net[e.paidBy] = (net[e.paidBy] ?? 0) + e.amount;
    for (const [u, share] of Object.entries(e.splits)) net[u] = (net[u] ?? 0) - share;
  }
  return net;
}

/** Greedy: match biggest debtor with biggest creditor to minimise payments. */
export function simplify(net: Record<string, number>): Transfer[] {
  const cred = Object.entries(net).filter(([, v]) => v > 0).map(([u, v]) => ({ u, v })).sort((a, b) => b.v - a.v);
  const debt = Object.entries(net).filter(([, v]) => v < 0).map(([u, v]) => ({ u, v: -v })).sort((a, b) => b.v - a.v);
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].v, cred[j].v);
    out.push({ from: debt[i].u, to: cred[j].u, amount: amt });
    debt[i].v -= amt;
    cred[j].v -= amt;
    if (debt[i].v === 0) i++;
    if (cred[j].v === 0) j++;
  }
  return out;
}
