import { ArrowRight, Camera, Check, ChevronRight, Clock3, Copy, Plus, QrCode, Sparkles, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { AvatarStack } from './AvatarStack';
import { formatMoney, sessionTotal } from '../data';
import type { BillSession, Profile } from '../types';

interface HomeProps {
  sessions: BillSession[];
  profile: Profile;
  onCreate: () => void;
  onJoin: () => void;
  onHistory: () => void;
  onSession: (session: BillSession) => void;
  onToast: (message: string) => void;
}

export function HomeTab({ sessions, profile, onCreate, onJoin, onHistory, onSession, onToast }: HomeProps) {
  const active = sessions.find((session) => session.status === 'active');
  const recent = sessions.filter((session) => session.id !== active?.id).slice(0, 3);
  const now = new Date();
  const splitsThisMonth = sessions.filter((session) => {
    const date = new Date(session.date);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;
  const claimedItems = active?.items.filter((item) => item.claimedBy.length > 0).length || 0;
  const claimPercent = active?.items.length ? claimedItems / active.items.length * 100 : 0;

  return (
    <motion.main className="page home-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <section className="welcome-row">
        <div><p className="eyebrow">{now.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</p><h1>Hey {profile.name.split(' ')[0]}, <span>ready to split?</span></h1></div>
        <div className="mini-stat"><span><Sparkles size={15} /></span><div><strong>{splitsThisMonth}</strong><small>splits this month</small></div></div>
      </section>

      <section className="quick-grid">
        <motion.button className="quick-card scan" onClick={onCreate} whileHover={{ y: -3 }} whileTap={{ scale: .985 }}>
          <span className="quick-icon"><Camera size={25} /></span>
          <span className="quick-copy"><small>START A NEW SPLIT</small><strong>Scan a receipt</strong><span>We’ll itemise it with AI <ArrowRight size={16} /></span></span>
          <span className="sparkle sparkle-one">✦</span><span className="sparkle sparkle-two">✦</span>
        </motion.button>
        <motion.button className="quick-card join" onClick={onJoin} whileHover={{ y: -3 }} whileTap={{ scale: .985 }}>
          <span className="quick-icon"><QrCode size={25} /></span>
          <span className="quick-copy"><small>GOT A TABLE CODE?</small><strong>Join a table</strong><span>Claim what you ordered <ArrowRight size={16} /></span></span>
          <span className="join-shape shape-one" /><span className="join-shape shape-two" />
        </motion.button>
      </section>

      {active && <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">HAPPENING NOW</p><h2>Your active table</h2></div><button onClick={() => onSession(active)}>View table <ChevronRight size={16} /></button></div>
        <motion.article className="active-table-card" whileHover={{ y: -2 }} onClick={() => onSession(active)}>
          <div className="table-card-main">
            <div className="receipt-illustration"><span /><span /><span /><span /></div>
            <div className="table-summary">
              <div className="table-title-line"><h3>{active.name}</h3><span className="live-pill"><i /> LIVE</span></div>
              <p>{active.venue}</p>
              <div className="table-meta"><span><Clock3 size={15} /> Started {new Date(active.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</span><span><Users size={15} /> {active.people.length} people</span></div>
            </div>
            <div className="table-total"><small>TABLE TOTAL</small><strong>{formatMoney(sessionTotal(active), active.currency)}</strong><button onClick={(event) => { event.stopPropagation(); navigator.clipboard?.writeText(active.code); onToast('Table code copied'); }}><span>{active.code}</span><Copy size={14} /></button></div>
          </div>
          <div className="claim-progress">
            <div className="progress-copy"><span><Check size={14} /> {claimedItems} of {active.items.length} items claimed</span><AvatarStack people={active.people} /></div>
            <div className="progress-track"><span style={{ width: `${claimPercent}%` }} /></div>
          </div>
        </motion.article>
      </section>}

      <section className="section-block recent-section">
        <div className="section-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Past splits</h2></div><button onClick={onHistory}>View all <ChevronRight size={16} /></button></div>
        <div className="recent-list">
          {recent.length === 0 ? <div className="empty-state"><Clock3 size={28} /><h3>No Firebase splits yet</h3><p>Completed and settled splits will appear here in real time.</p></div> : recent.map((session) => <button className="recent-row" key={session.id} onClick={() => onSession(session)}>
            <span className="recent-icon">{session.venue.includes('Daily') ? '🥗' : session.venue.includes('Honey') ? '🥞' : '🎬'}</span>
            <span className="recent-copy"><strong>{session.name}</strong><small>{session.venue} · {new Date(session.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}</small></span>
            <AvatarStack people={session.people} />
            <span className="recent-amount"><strong>{formatMoney(sessionTotal(session), session.currency)}</strong><small><Check size={12} /> Settled</small></span>
            <ChevronRight size={18} className="row-arrow" />
          </button>)}
        </div>
      </section>

      <button className="desktop-fab" onClick={onCreate}><Plus size={20} /> New split</button>
    </motion.main>
  );
}
