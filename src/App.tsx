import { Check, Plus, UsersRound, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { GroupsTab } from './components/GroupsTab';
import { Header } from './components/Header';
import { HistoryTab } from './components/HistoryTab';
import { HomeTab } from './components/HomeTab';
import { NotificationsPanel } from './components/NotificationsPanel';
import { ProfileTab } from './components/ProfileTab';
import { SessionDetail } from './components/SessionDetail';
import { Stepper } from './components/Stepper';
import { defaultProfile, people } from './data';
import { connectFirebaseStore, saveCloudGroup, saveCloudNotification, saveCloudProfile, saveCloudSession, uploadCloudPaymentQr, type CloudSyncState } from './lib/firebaseStore';
import type { BillSession, DiningGroup, Notification, Profile, Tab } from './types';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [sessions, setSessions] = useState<BillSession[]>([]);
  const [groups, setGroups] = useState<DiningGroup[]>([]);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardKey, setWizardKey] = useState(0);
  const [presetGroup, setPresetGroup] = useState<DiningGroup | null>(null);
  const [selectedSession, setSelectedSession] = useState<BillSession | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [cloudState, setCloudState] = useState<CloudSyncState>('connecting');
  const [cloudMessage, setCloudMessage] = useState('Connecting to Firebase…');

  useEffect(() => {
    localStorage.removeItem('paylah:sessions');
    localStorage.removeItem('paylah:groups');
    localStorage.removeItem('paylah:profile');
    let disposed = false;
    let unsubscribe: () => void = () => undefined;
    void connectFirebaseStore(
      profile,
      {
        onProfile: setProfile,
        onSessions: setSessions,
        onGroups: setGroups,
        onNotifications: setNotifications,
        onStatus: (status, message) => {
          setCloudState(status);
          setCloudMessage(message || (status === 'synced' ? 'Changes sync to Firebase in real time.' : 'Connecting to Firebase…'));
          if (status === 'offline' && message) setToast(message);
        },
      },
    ).then((stop) => { if (disposed) stop(); else unsubscribe = stop; });
    return () => { disposed = true; unsubscribe(); };
  }, []);

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timer); }, [toast]);

  const startWizard = (group: DiningGroup | null = null) => { setPresetGroup(group); setWizardKey((n) => n + 1); setWizardOpen(true); };
  const updateProfile = (updated: Profile) => { setProfile(updated); void saveCloudProfile(updated); };
  const updateSession = (updated: BillSession) => { setSelectedSession(updated); void saveCloudSession(updated).then((saved) => { if (!saved) setToast('Firebase is offline; the table was not updated.'); }); };
  const completeSession = (session: BillSession) => {
    void saveCloudSession(session).then((saved) => {
      if (saved) { setSelectedSession(session); setToast(`Table ${session.code} is live`); }
      else setToast('Firebase is offline; the table was not created.');
    });
  };
  const markNotificationsRead = () => {
    setNotifications((current) => current.map((item) => {
      const updated = { ...item, read: true };
      void saveCloudNotification(updated);
      return updated;
    }));
  };
  const uploadPaymentQr = async (file: File) => {
    if (!file.type.startsWith('image/')) { setToast('Choose an image file for your payment QR.'); return; }
    if (file.size > 5 * 1024 * 1024) { setToast('Payment QR images must be under 5 MB.'); return; }
    try {
      const cloudUrl = await uploadCloudPaymentQr(file);
      if (!cloudUrl) throw new Error('Firebase Storage is not connected.');
      updateProfile({ ...profile, paymentQr: cloudUrl });
      setToast('Payment QR uploaded to Firebase');
    } catch {
      setToast('Firebase Storage is unavailable; QR was not saved.');
    }
  };

  return <div className="app-shell">
    <Header profile={profile} unread={notifications.filter((n) => !n.read).length} cloudState={cloudState} cloudMessage={cloudMessage} onNotifications={() => setNoticeOpen(true)} />
    <div className="desktop-nav"><BottomNav active={tab} onChange={setTab} /></div>
    <div className="page-container">
      {tab === 'home' && <HomeTab sessions={sessions} profile={profile} onCreate={() => startWizard()} onJoin={() => setJoinOpen(true)} onHistory={() => setTab('history')} onSession={setSelectedSession} onToast={setToast} />}
      {tab === 'history' && <HistoryTab sessions={sessions} onSession={setSelectedSession} />}
      {tab === 'groups' && <GroupsTab groups={groups} onCreate={() => setGroupOpen(true)} onStart={(group) => startWizard(group)} />}
      {tab === 'profile' && <ProfileTab profile={profile} onChange={updateProfile} onPaymentQr={uploadPaymentQr} onToast={setToast} />}
    </div>
    <div className="mobile-nav"><BottomNav active={tab} onChange={setTab} /></div>
    <NotificationsPanel open={noticeOpen} items={notifications} onClose={() => setNoticeOpen(false)} onReadAll={markNotificationsRead} />
    <Stepper key={wizardKey} open={wizardOpen} presetGroup={presetGroup} onClose={() => setWizardOpen(false)} onComplete={completeSession} />
    {selectedSession && <SessionDetail session={selectedSession} onClose={() => setSelectedSession(null)} onUpdate={updateSession} onToast={setToast} />}
    <JoinModal open={joinOpen} sessions={sessions} onClose={() => setJoinOpen(false)} onJoin={(session) => { setJoinOpen(false); setSelectedSession(session); }} onToast={setToast} />
    <GroupModal open={groupOpen} onClose={() => setGroupOpen(false)} onCreate={(name, emoji) => {
      const group: DiningGroup = { id: `g-${Date.now()}`, name, emoji, members: [people[0]], lastActive: 'Today', totalSplits: 0 };
      setGroupOpen(false);
      void saveCloudGroup(group).then((saved) => setToast(saved ? `${name} created` : 'Firebase is offline; the group was not created.'));
    }} />
    <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><Check size={16} /> {toast}</motion.div>}</AnimatePresence>
  </div>;
}

function JoinModal({ open, sessions, onClose, onJoin, onToast }: { open: boolean; sessions: BillSession[]; onClose: () => void; onJoin: (session: BillSession) => void; onToast: (message: string) => void }) {
  const [code, setCode] = useState('');
  const submit = () => { const found = sessions.find((session) => session.code === code.toUpperCase()); if (found) onJoin(found); else onToast('No live Firebase table was found for that code.'); };
  return <AnimatePresence>{open && <div className="modal-shell small-shell"><motion.button className="modal-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.section className="small-modal" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}><button className="icon-button modal-x" onClick={onClose}><X size={19} /></button><span className="feature-icon violet"><UsersRound size={23} /></span><p className="eyebrow">JOIN A TABLE</p><h2>What’s the code?</h2><p>Ask the host for their 5-character table code.</p><input className="code-input" maxLength={5} autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABCDE" onKeyDown={(e) => e.key === 'Enter' && submit()} /><button className="primary-button modal-submit" onClick={submit} disabled={code.length < 5}>Join table</button></motion.section></div>}</AnimatePresence>;
}

function GroupModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, emoji: string) => void }) {
  const [name, setName] = useState(''); const [emoji, setEmoji] = useState('🍜');
  return <AnimatePresence>{open && <div className="modal-shell small-shell"><motion.button className="modal-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.section className="small-modal" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}><button className="icon-button modal-x" onClick={onClose}><X size={19} /></button><span className="feature-icon coral"><UsersRound size={23} /></span><p className="eyebrow">NEW GROUP</p><h2>Bring your crew together.</h2><p>Name the people you split with often.</p><label className="emoji-name-input"><select value={emoji} onChange={(e) => setEmoji(e.target.value)}><option>🍜</option><option>🏠</option><option>✈️</option><option>🥗</option><option>🎉</option></select><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend Crew" /></label><button className="primary-button modal-submit" onClick={() => onCreate(name, emoji)} disabled={!name.trim()}><Plus size={17} /> Create group</button></motion.section></div>}</AnimatePresence>;
}
