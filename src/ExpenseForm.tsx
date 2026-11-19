import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { loadBill, saveExpense, Group } from './data';
import { compressImage, MAX_BILLS } from './image';
import type { Expense, Transfer } from './balances';
import { snap } from './changes';
import { equalSplit, fmt, parseMoney } from './money';
import { fromISODate, toISODate } from './dates';

interface Props {
  group: Group;
  user: User;
  kind: 'expense' | 'settlement';
  transfers: Transfer[];
  existing?: Expense; // set when editing
  onClose: () => void;
}

const fixed = (minor: number) => (minor / 100).toFixed(2);

export default function ExpenseForm({ group, user, kind, transfers, existing, onClose }: Props) {
  const ids = group.memberIds;
  const nm = (u: string) => (u === user.uid ? 'You' : group.members[u]?.name ?? 'Unknown');
  const myName = group.members[user.uid]?.name ?? user.displayName ?? 'Someone';
  const suggestion = existing ? undefined : transfers.find((t) => t.from === user.uid);

  // When editing, work out whether the saved split was "equal" or "exact".
  const keys = existing ? Object.keys(existing.splits) : [];
  const vals = existing ? Object.values(existing.splits) : [];
  const wasEqual = !!existing && vals.length > 0 && Math.max(...vals) - Math.min(...vals) <= 1;

  const [desc, setDesc] = useState(existing?.description ?? '');
  const [amountStr, setAmountStr] = useState(existing ? fixed(existing.amount) : suggestion ? fixed(suggestion.amount) : '');
  const [dateStr, setDateStr] = useState(toISODate(existing?.date ?? Date.now()));
  const [paidBy, setPaidBy] = useState(existing?.paidBy ?? user.uid);
  const [to, setTo] = useState(existing && kind === 'settlement' ? keys[0] : suggestion?.to ?? ids.find((i) => i !== user.uid) ?? user.uid);
  const [mode, setMode] = useState<'equal' | 'exact'>(existing && !wasEqual ? 'exact' : 'equal');
  const [chosen, setChosen] = useState<string[]>(existing && wasEqual ? keys : ids);
  const [exact, setExact] = useState<Record<string, string>>(
    existing && !wasEqual ? Object.fromEntries(Object.entries(existing.splits).map(([u, v]) => [u, fixed(v)])) : {},
  );
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Bills: already-saved ones (loaded lazily), ones marked for removal, and newly picked photos.
  const [saved, setSaved] = useState<{ id: string; src: string | null }[]>(
    (existing?.billIds ?? []).map((id) => ({ id, src: null })),
  );
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    for (const b of existing?.billIds ?? [])
      loadBill(group.id, b).then((src) => setSaved((cur) => cur.map((x) => (x.id === b ? { ...x, src } : x)))).catch(() => {});
  }, [existing, group.id]);

  const billCount = saved.length + added.length;

  async function pickFiles(files: FileList | null) {
    if (!files?.length) return;
    setErr('');
    setProcessing(true);
    try {
      const room = MAX_BILLS - billCount;
      const out: string[] = [];
      for (const f of Array.from(files).slice(0, room)) out.push(await compressImage(f));
      setAdded((cur) => [...cur, ...out]);
      if (files.length > room) setErr(`Only ${MAX_BILLS} bills per expense; extra files were skipped.`);
    } catch (e: any) { setErr(e.message); }
    setProcessing(false);
  }

  async function save() {
    const amount = parseMoney(amountStr);
    if (!amount || amount <= 0) return setErr('Enter a valid amount (up to 2 decimals).');
    if (!dateStr) return setErr('Pick a date.');
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
    // Keep the exact original timestamp if the user didn't touch the date.
    const date = existing && toISODate(existing.date) === dateStr ? existing.date : fromISODate(dateStr);
    setBusy(true);
    try {
      await saveExpense(
        group.id,
        existing?.id ?? null,
        {
          type: kind,
          description: desc.trim() || (kind === 'settlement' ? 'Payment' : 'Expense'),
          amount, paidBy, splits, date,
          createdBy: existing?.createdBy ?? user.uid,
          createdAt: existing?.createdAt ?? Date.now(),
        },
        { uid: user.uid, name: myName },
        existing ? snap(existing) : null,
        { keep: saved.map((b) => b.id), remove: removed, add: added },
      );
      onClose();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  const title = `${existing ? 'Edit' : 'Add'} ${kind === 'settlement' ? 'payment' : 'expense'}`;
  return (
    <div className="modal"><div className="card">
      <h3>{title}</h3>
      {kind === 'expense' && <input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />}
      <input placeholder="Amount" inputMode="decimal" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
      <label>Date
        <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
      </label>
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
      {kind === 'expense' && (
        <div className="bills">
          <div className="between">
            <span>Bills ({billCount}/{MAX_BILLS})</span>
            {billCount < MAX_BILLS && (
              <label className="filebtn">
                {processing ? 'Processing…' : '＋ Add photo'}
                <input type="file" accept="image/*" multiple hidden disabled={processing}
                  onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
          <div className="thumbs">
            {saved.map((b) => (
              <div key={b.id} className="thumb">
                {b.src ? <img src={b.src} alt="Bill" /> : <span className="muted">…</span>}
                <button aria-label="Remove bill" onClick={() => { setSaved(saved.filter((x) => x.id !== b.id)); setRemoved([...removed, b.id]); }}>✕</button>
              </div>
            ))}
            {added.map((src, i) => (
              <div key={i} className="thumb">
                <img src={src} alt="New bill" />
                <button aria-label="Remove bill" onClick={() => setAdded(added.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {err && <p className="err">{err}</p>}
      <div className="row"><button className="primary" disabled={busy || processing} onClick={save}>Save</button><button onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}
