import {
  arrayUnion, collection, doc, limit, onSnapshot, orderBy, query,
  setDoc, updateDoc, where, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import type { Expense } from './balances';
import { snap, LogEntry, Snap } from './changes';

export interface Member { name: string; photo?: string }
export interface Group { id: string; name: string; memberIds: string[]; members: Record<string, Member> }
export type ExpenseData = Omit<Expense, 'id'>;

const toGroup = (id: string, d: any): Group => ({ id, name: d.name, memberIds: d.memberIds ?? [], members: d.members ?? {} });
const memberOf = (u: User): Member => ({ name: u.displayName || u.email || 'Someone', photo: u.photoURL || '' });

export function watchGroups(uid: string, cb: (g: Group[]) => void) {
  const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', uid));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => toGroup(d.id, d.data()))));
}

export function watchGroup(id: string, cb: (g: Group | null) => void) {
  return onSnapshot(doc(db, 'groups', id), (s) => cb(s.exists() ? toGroup(s.id, s.data()) : null), () => cb(null));
}

export async function createGroup(name: string, u: User) {
  const ref = doc(collection(db, 'groups'));
  await setDoc(ref, { name, memberIds: [u.uid], members: { [u.uid]: memberOf(u) }, createdAt: serverTimestamp() });
  return ref.id;
}

export async function joinGroup(id: string, u: User) {
  await updateDoc(doc(db, 'groups', id), { memberIds: arrayUnion(u.uid), [`members.${u.uid}`]: memberOf(u) });
}

/** Display name used only inside this group. */
export const renameMe = (gid: string, uid: string, name: string) =>
  updateDoc(doc(db, 'groups', gid), { [`members.${uid}.name`]: name });

/** Newest first: by expense date, then by entry time. */
export function watchExpenses(gid: string, cb: (e: Expense[]) => void) {
  const q = query(collection(db, 'groups', gid, 'expenses'), orderBy('date', 'desc'));
  return onSnapshot(q, (s) => {
    const list = s.docs.map((d) => ({ id: d.id, ...(d.data() as ExpenseData) }));
    list.sort((a, b) => b.date - a.date || (b.createdAt ?? 0) - (a.createdAt ?? 0));
    cb(list);
  });
}

export function watchLog(gid: string, cb: (l: LogEntry[]) => void) {
  const q = query(collection(db, 'groups', gid, 'log'), orderBy('at', 'desc'), limit(100));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LogEntry, 'id'>) }))), () => cb([]));
}

/** Add (id = null) or edit an expense and write an audit entry, atomically. */
export async function saveExpense(
  gid: string, id: string | null, data: ExpenseData, actor: { uid: string; name: string }, before: Snap | null,
) {
  const expRef = id ? doc(db, 'groups', gid, 'expenses', id) : doc(collection(db, 'groups', gid, 'expenses'));
  const logRef = doc(collection(db, 'groups', gid, 'log'));
  const entry: Omit<LogEntry, 'id'> = {
    action: before ? 'edit' : 'add', expenseId: expRef.id, by: actor.uid, byName: actor.name, at: Date.now(),
    description: data.description, amount: data.amount, after: snap(data),
    ...(before ? { before } : {}),
  };
  const batch = writeBatch(db);
  batch.set(expRef, data);
  batch.set(logRef, entry);
  await batch.commit();
}

export async function deleteExpense(gid: string, e: Expense, actor: { uid: string; name: string }) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'groups', gid, 'expenses', e.id));
  batch.set(doc(collection(db, 'groups', gid, 'log')), {
    action: 'delete', expenseId: e.id, by: actor.uid, byName: actor.name, at: Date.now(),
    description: e.description, amount: e.amount, before: snap(e),
  } satisfies Omit<LogEntry, 'id'>);
  await batch.commit();
}
