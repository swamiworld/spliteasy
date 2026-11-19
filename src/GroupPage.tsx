import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { addExpense, removeExpense, watchExpenses, watchGroup, Group } from './data';
import { Expense, netBalances, simplify } from './balances';
import { equalSplit, fmt, parseMoney } from './money';

export default function GroupPage({ id, user }: { id: string; user: User }) {
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState<null | 'expense' | 'settlement'>(null);

  useEffect(() => watchGroup(id, setGroup), [id]);
  useEffect(() => watchExpenses(id, setExpenses), [id]);

  const net = useMemo(() => (group ? netBalances(expenses, group.memberIds) : {}), [expenses, group]);
  const transfers = useMemo(() => simplify(net), [net]);

  if (group === undefined) return <main><p className="muted">Loading…</p></main>;
  if (group === null || !group.memberIds.includes(user.uid))
    return <main><p className="err">Group not found, or you are not a member.</p><a href="#/">Back</a></main>;

  const name = (u: string) => (u === user.uid ? 'You' : group.members[u]?.name ?? 'Unknown');
  const invite = `${location.origin}${location.pathname}#/join/${id}`;

  return (
    <main>
      <a href="#/">← Groups</a>
      <h2>{group.name}</h2>
      <button className="link" onClick={() => navigator.clipboard.writeText(invite).then(() => alert('Invite link copied'))}>
        Copy invite link
      </button>

      <h3>Balances</h3>
      <ul className="list">
        {group.memberIds.map((m) => (
          <li key={m} className="between">
            <span>{name(m)}</span>
            <span className={net[m] > 0 ? 'pos' : net[m] < 0 ? 'neg' : 'muted'}>
              {net[m] > 0 ? `gets back ${fmt(net[m])}` : net[m] < 0 ? `owes ${fmt(-net[m])}` : 'settled up'}
            </span>
          </li>
        ))}
      </ul>

      {transfers.length > 0 && (
        <>
          <h3>Suggested payments</h3>
          <ul className="list">
            {transfers.map((t, i) => (
              <li key={i}>{name(t.from)} {t.from === user.uid ? 'pay' : 'pays'} {name(t.to)} <b>{fmt(t.amount)}</b></li>
            ))}
          </ul>
        </>
      )}

      <div className="row">
        <button className="primary" onClick={() => setForm('expense')}>Add expense</button>
        <button onClick={() => setForm('settlement')}>Settle up</button>
      </div>

      {form && <ExpenseForm group={group} user={user} kind={form} transfers={transfers} onClose={() => setForm(null)} />}

      <h3>History</h3>
      {expenses.length === 0 && <p className="muted">Nothing yet.</p>}
      <ul className="list">
        {expenses.map((e) => (
          <li key={e.id} className="between">
            <span>
              {e.type === 'settlement' ? '💸 ' : ''}{e.description || 'Expense'}
              <span className="muted"> · {new Date(e.date).toLocaleDateString()} · {name(e.paidBy)} paid</span>
            </span>
            <span>
              {fmt(e.amount)}{' '}
              {e.createdBy === user.uid && (
                <button className="link" onClick={() => confirm('Delete this entry?') && removeExpense(id, e.id)}>✕</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

function ExpenseForm({ group, user, kind, transfers, onClose }: {
  group: Group; user: User; kind: 'expense' | 'settlement';
  transfers: { from: string; to: string; amount: number }[]; onClose: () => void;
}) {
  const ids = group.memberIds;
  const nm = (u: string) => (u === user.uid ? 'You' : group.members[u]?.name ?? 'Unknown');
  const suggestion = transfers.find((t) => t.from === user.uid);

  const [desc, setDesc] = useState('');
  const [amountStr, setAmountStr] = useState(kind === 'settlement' && suggestion ? String(suggestion.amount / 100) : '');
  const [paidBy, setPaidBy] = useState(user.uid);
  const [to, setTo] = useState(suggestion?.to ?? ids.find((i) => i !== user.uid) ?? user.uid);
  const [mode, setMode] = useState<'equal' | 'exact'>('equal');
  const [chosen, setChosen] = useState<string[]>(ids);
  const [exact, setExact] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const amount = parseMoney(amountStr);

  async function save() {
    if (!amount || amount <= 0) return setErr('Enter a valid amount (up to 2 decimals).');
    let splits: Record<string, number>;
    if (kind === 'settlement') {
      if (to === paidBy) return setErr('Payer and receiver must differ.');
      splits = { [to]: amount };
    } else if (mode === 'equal') {
      if (chosen.length === 0) return setErr('Pick at least one person.');
      splits = equalSplit(amount, chosen);
    } else {
      splits = {};
      let sum = 0;
      for (const u of ids) {
        const v = exact[u]?.trim() ? parseMoney(exact[u]) : 0;
        if (v === null) return setErr(`Invalid amount for ${nm(u)}.`);
        if (v > 0) { splits[u] = v; sum += v; }
      }
      if (sum !== amount) return setErr(`Splits add up to ${fmt(sum)} but total is ${fmt(amount)}.`);
    }
    setBusy(true);
    try {
      await addExpense(group.id, {
        type: kind, description: desc.trim() || (kind === 'settlement' ? 'Payment' : 'Expense'),
        amount, paidBy, splits, date: Date.now(), createdBy: user.uid,
      });
      onClose();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="modal"><div className="card">
      <h3>{kind === 'settlement' ? 'Settle up' : 'Add expense'}</h3>
      {kind === 'expense' && <input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />}
      <input placeholder="Amount" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
      <label>{kind === 'settlement' ? 'Who paid' : 'Paid by'}
        <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>{ids.map((u) => <option key={u} value={u}>{nm(u)}</option>)}</select>
      </label>
      {kind === 'settlement' ? (
        <label>Paid to
          <select value={to} onChange={(e) => setTo(e.target.value)}>{ids.map((u) => <option key={u} value={u}>{nm(u)}</option>)}</select>
        </label>
      ) : (
        <>
          <div className="row">
            <button className={mode === 'equal' ? 'primary' : ''} onClick={() => setMode('equal')}>Split equally</button>
            <button className={mode === 'exact' ? 'primary' : ''} onClick={() => setMode('exact')}>Exact amounts</button>
          </div>
          {ids.map((u) => (
            <div key={u} className="between">
              {mode === 'equal' ? (
                <label className="check">
                  <input type="checkbox" checked={chosen.includes(u)} onChange={(e) => setChosen(e.target.checked ? [...chosen, u] : chosen.filter((x) => x !== u))} />
                  {nm(u)}
                </label>
              ) : (
                <>
                  <span>{nm(u)}</span>
                  <input className="small" placeholder="0.00" inputMode="decimal" value={exact[u] ?? ''} onChange={(e) => setExact({ ...exact, [u]: e.target.value })} />
                </>
              )}
            </div>
          ))}
        </>
      )}
      {err && <p className="err">{err}</p>}
      <div className="row"><button className="primary" disabled={busy} onClick={save}>Save</button><button onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}
