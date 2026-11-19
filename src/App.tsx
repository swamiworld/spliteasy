import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth } from './firebase';
import { createGroup, joinGroup, watchGroups, Group } from './data';
import GroupPage from './GroupPage';

function useHash() {
  const [h, setH] = useState(location.hash || '#/');
  useEffect(() => {
    const f = () => setH(location.hash || '#/');
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h;
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const hash = useHash();
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <div className="center">Loading…</div>;
  if (!user)
    return (
      <div className="center">
        <h1>SplitEasy</h1>
        <p className="muted">Split shared expenses with friends.</p>
        <button className="primary" onClick={() => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => alert(e.message))}>
          Sign in with Google
        </button>
      </div>
    );

  const join = hash.match(/^#\/join\/(.+)$/);
  const grp = hash.match(/^#\/g\/(.+)$/);
  return (
    <div className="app">
      <header>
        <a href="#/" className="logo">SplitEasy</a>
        <button className="link" onClick={() => signOut(auth)}>Sign out</button>
      </header>
      {join ? <Join id={join[1]} user={user} /> : grp ? <GroupPage id={grp[1]} user={user} /> : <Groups user={user} />}
    </div>
  );
}

function Groups({ user }: { user: User }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [name, setName] = useState('');
  useEffect(() => watchGroups(user.uid, setGroups), [user.uid]);

  async function create() {
    if (!name.trim()) return;
    const id = await createGroup(name.trim(), user);
    setName('');
    location.hash = `#/g/${id}`;
  }
  return (
    <main>
      <h2>Your groups</h2>
      {groups === null ? <p className="muted">Loading…</p> : groups.length === 0 && <p className="muted">No groups yet. Create one below, or open an invite link.</p>}
      <ul className="list">
        {groups?.map((g) => (
          <li key={g.id}><a href={`#/g/${g.id}`}>{g.name}<span className="muted"> · {g.memberIds.length} members</span></a></li>
        ))}
      </ul>
      <div className="row">
        <input placeholder="New group name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} />
        <button className="primary" onClick={create}>Create</button>
      </div>
    </main>
  );
}

function Join({ id, user }: { id: string; user: User }) {
  const [err, setErr] = useState('');
  useEffect(() => {
    joinGroup(id, user).then(() => (location.hash = `#/g/${id}`)).catch(() => setErr('Could not join. Check the invite link.'));
  }, [id, user]);
  return <main>{err ? <p className="err">{err}</p> : <p className="muted">Joining group…</p>}</main>;
}
