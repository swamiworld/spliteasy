import {
  addDoc, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  setDoc, updateDoc, where, serverTimestamp,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import type { Expense } from './balances';

export interface Member { name: string; photo?: string }
export interface Group { id: string; name: string; memberIds: string[]; members: Record<string, Member> }

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

export function watchExpenses(gid: string, cb: (e: Expense[]) => void) {
  const q = query(collection(db, 'groups', gid, 'expenses'), orderBy('date', 'desc'));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) }))));
}

export const addExpense = (gid: string, e: Omit<Expense, 'id'>) => addDoc(collection(db, 'groups', gid, 'expenses'), e);
export const removeExpense = (gid: string, id: string) => deleteDoc(doc(db, 'groups', gid, 'expenses', id));
