import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { motion } from 'motion/react';
import { AvatarStack } from './AvatarStack';
import { formatMoney, sessionTotal } from '../data';
import type { BillSession, SessionStatus } from '../types';
import { useMemo, useState } from 'react';

export function HistoryTab({ sessions, onSession }: { sessions: BillSession[]; onSession: (session: BillSession) => void }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | SessionStatus>('all');
  const [sort, setSort] = useState('newest');
  const filtered = useMemo(() => {
    const result = sessions.filter((s) => (status === 'all' || s.status === status) && `${s.name} ${s.venue} ${s.code}`.toLowerCase().includes(query.toLowerCase()));
    return result.sort((a, b) => sort === 'oldest' ? +new Date(a.date) - +new Date(b.date) : sort === 'high' ? sessionTotal(b) - sessionTotal(a) : sort === 'low' ? sessionTotal(a) - sessionTotal(b) : +new Date(b.date) - +new Date(a.date));
  }, [sessions, query, status, sort]);

  return <motion.main className="page standard-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <div className="page-title"><div><p className="eyebrow">YOUR ACTIVITY</p><h1>Split history</h1><p>Every meal, trip and shared expense in one place.</p></div><div className="history-total"><small>TOTAL SHARED</small><strong>{formatMoney(sessions.reduce((n, s) => n + sessionTotal(s), 0))}</strong><span>across {sessions.length} splits</span></div></div>
    <section className="filter-panel">
      <label className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by table, venue or code" /></label>
      <div className="status-tabs">
        {(['all', 'active', 'settled'] as const).map((value) => <button className={status === value ? 'active' : ''} onClick={() => setStatus(value)} key={value}>{value[0].toUpperCase() + value.slice(1)}</button>)}
      </div>
      <label className="select-wrap"><SlidersHorizontal size={16} /><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="high">Amount: high to low</option><option value="low">Amount: low to high</option></select><ChevronDown size={15} /></label>
    </section>
    <section className="history-list-wrap">
      <div className="list-label"><span>{filtered.length} SPLITS</span><button><CalendarDays size={15} /> All dates</button></div>
      <div className="history-list">
        {filtered.length === 0 ? <div className="empty-state"><Search size={28} /><h3>{sessions.length ? 'No splits found' : 'No Firebase history yet'}</h3><p>{sessions.length ? 'Try another search or filter.' : 'New receipt splits will appear here in real time.'}</p></div> : filtered.map((session) => <button className="history-row" onClick={() => onSession(session)} key={session.id}>
          <span className="date-tile"><strong>{new Date(session.date).getDate()}</strong><small>{new Date(session.date).toLocaleDateString('en-SG', { month: 'short' }).toUpperCase()}</small></span>
          <span className="history-row-copy"><span><strong>{session.name}</strong><i className={`status-pill ${session.status}`}>{session.status === 'active' && <b />} {session.status}</i></span><small>{session.venue} · Code {session.code}</small></span>
          <span className="history-people"><AvatarStack people={session.people} /><small>{session.people.length} people</small></span>
          <span className="history-amount"><strong>{formatMoney(sessionTotal(session), session.currency)}</strong><small>{session.status === 'settled' && <CheckCircle2 size={12} />} {session.status === 'settled' ? 'All paid' : 'In progress'}</small></span>
          <ChevronRight size={18} className="row-arrow" />
        </button>)}
      </div>
    </section>
  </motion.main>;
}
