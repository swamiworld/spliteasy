import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { deleteExpense, renameMe, watchExpenses, watchGroup, watchLog, Group } from './data';
import { Expense, netBalances, simplify } from './balances';
import { describe, LogEntry } from './changes';
import { fmt } from './money';
import { fmtDate, fmtDateTime, toISODate } from './dates';
import ExpenseForm from './ExpenseForm';

type Tab = 'summary' | 'expenses';
type FormState = null | { kind: 'expense' | 'settlement'; existing?: Expense };

export default function GroupPage({ id, user }: { id: string; user: User }) {
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [form, setForm] = useState<FormState>(null);
  const [tab, setTab] = useState<Tab>('summary');
  const [showAllLog, setShowAllLog] = useState(false);

  useEffect(() => watchGroup(id, setGroup), [id]);
  useEffect(() => watchExpenses(id, setExpenses), [id]);
  useEffect(() => watchLog(id, setLog), [id]);

  const net = useMemo(() => (group ? netBalances(expenses, group.memberIds) : {}), [expenses, group]);
  const transfers = useMemo(() => simplify(net), [net]);

  if (group === undefined) return <main><p className="muted">Loading…</p></main>;
  if (group === null || !group.memberIds.includes(user.uid))
    return <main><p className="err">Group not found, or you are not a member.</p><a href="#/">Back</a></main>;

  const myName = group.members[user.uid]?.name ?? user.displayName ?? 'Someone';
  const name = (u: string) => (u === user.uid ? 'You' : group.members[u]?.name ?? 'Unknown');
  const invite = `${location.origin}${location.pathname}#/join/${id}`;

  async function editName() {
    const n = prompt('Your name in this group:', myName)?.trim();
    if (!n || n === myName) return;
    try { await renameMe(id, user.uid, n.slice(0, 40)); } catch (e: any) { alert(e.message); }
  }
  function remove(e: Expense) {
    if (confirm(`Delete “${e.description}” (${fmt(e.amount)})? This is recorded in the change log.`))
      deleteExpense(id, e, { uid: user.uid, name: myName }).catch((err) => alert(err.message));
  }
  const onEdit = (e: Expense) => setForm({ kind: e.type, existing: e });

  return (
    <main>
      <a href="#/">← Groups</a>
      <h2>{group.name}</h2>
      <div className="row tight">
        <button className="link" onClick={() => navigator.clipboard.writeText(invite).then(() => alert('Invite link copied'))}>Copy invite link</button>
        <button className="link" onClick={editName}>Edit my name ({myName})</button>
      </div>

      <div className="tabs">
        <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>Summary</button>
        <button className={tab === 'expenses' ? 'active' : ''} onClick={() => setTab('expenses')}>Expenses ({expenses.length})</button>
      </div>

      <div className="row">
        <button className="primary" onClick={() => setForm({ kind: 'expense' })}>Add expense</button>
        <button onClick={() => setForm({ kind: 'settlement' })}>Settle up</button>
      </div>

      {tab === 'summary' ? (
        <>
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

          <h3>Recent transactions</h3>
          {expenses.length === 0 && <p className="muted">Nothing yet.</p>}
          <ExpenseList items={expenses.slice(0, 5)} name={name} onEdit={onEdit} onDelete={remove} />
          {expenses.length > 5 && <button className="link" onClick={() => setTab('expenses')}>View all {expenses.length} →</button>}

          <h3>Change log</h3>
          {log.length === 0 && <p className="muted">No activity recorded yet.</p>}
          <ul className="list">
            {(showAllLog ? log : log.slice(0, 5)).map((l) => (
              <li key={l.id}>
                {describe(l, name)}
                <div className="muted small-text">{fmtDateTime(l.at)}</div>
              </li>
            ))}
          </ul>
          {log.length > 5 && (
            <button className="link" onClick={() => setShowAllLog(!showAllLog)}>{showAllLog ? 'Show less' : `Show all ${log.length}`}</button>
          )}
        </>
      ) : (
        <ExpensesTab group={group} expenses={expenses} name={name} onEdit={onEdit} onDelete={remove} />
      )}

      {form && (
        <ExpenseForm
          key={form.existing?.id ?? form.kind}
          group={group} user={user} kind={form.kind} transfers={transfers}
          existing={form.existing} onClose={() => setForm(null)}
        />
      )}
    </main>
  );
}

interface ListProps {
  items: Expense[];
  name: (u: string) => string;
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
}

function ExpenseList({ items, name, onEdit, onDelete }: ListProps) {
  return (
    <ul className="list">
      {items.map((e) => (
        <li key={e.id} className="between">
          <span>
            {e.type === 'settlement' ? '💸 ' : ''}{e.description || 'Expense'}
            <span className="muted"> · {fmtDate(e.date)} · {name(e.paidBy)} paid</span>
          </span>
          <span className="nowrap">
            {fmt(e.amount)}{' '}
            <button className="link" aria-label="Edit" onClick={() => onEdit(e)}>✎</button>
            <button className="link" aria-label="Delete" onClick={() => onDelete(e)}>✕</button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ExpensesTab({ group, expenses, name, onEdit, onDelete }: { group: Group; expenses: Expense[] } & Omit<ListProps, 'items'>) {
  const [text, setText] = useState('');
  const [payer, setPayer] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => {
    const t = text.trim().toLowerCase();
    return expenses.filter((e) => {
      const d = toISODate(e.date);
      return (!t || e.description.toLowerCase().includes(t))
        && (!payer || e.paidBy === payer)
        && (!from || d >= from)
        && (!to || d <= to);
    });
  }, [expenses, text, payer, from, to]);

  const total = filtered.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const active = text || payer || from || to;

  return (
    <>
      <div className="filters">
        <input placeholder="Search description" value={text} onChange={(e) => setText(e.target.value)} />
        <select value={payer} onChange={(e) => setPayer(e.target.value)}>
          <option value="">Paid by: anyone</option>
          {group.memberIds.map((u) => <option key={u} value={u}>{name(u)}</option>)}
        </select>
        <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="between">
        <span className="muted">{filtered.length} of {expenses.length} · spent {fmt(total)}</span>
        {active && <button className="link" onClick={() => { setText(''); setPayer(''); setFrom(''); setTo(''); }}>Clear filters</button>}
      </div>
      {filtered.length === 0 && <p className="muted">No matching entries.</p>}
      <ExpenseList items={filtered} name={name} onEdit={onEdit} onDelete={onDelete} />
    </>
  );
}
