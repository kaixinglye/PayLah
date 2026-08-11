import { ArrowRight, ChevronRight, Plus, UsersRound } from 'lucide-react';
import { motion } from 'motion/react';
import { Avatar, AvatarStack } from './AvatarStack';
import type { DiningGroup } from '../types';

export function GroupsTab({ groups, onCreate, onStart }: { groups: DiningGroup[]; onCreate: () => void; onStart: (group: DiningGroup) => void }) {
  return <motion.main className="page standard-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <div className="page-title"><div><p className="eyebrow">YOUR PEOPLE</p><h1>Groups</h1><p>Keep your regular crews together and start splits faster.</p></div><button className="primary-button" onClick={onCreate}><Plus size={18} /> New group</button></div>
    <section className="group-feature">
      <div className="group-feature-art"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="center-avatar">☺</span><span className="orbit-avatar oa-1">JM</span><span className="orbit-avatar oa-2">SL</span><span className="orbit-avatar oa-3">RK</span></div>
      <div><p className="eyebrow">MAKE SPLITTING A HABIT</p><h2>Your people, one tap away.</h2><p>Create groups for the friends, flatmates and teammates you split with most. Everyone’s ready for the next bill.</p><button onClick={onCreate}>Create your next group <ArrowRight size={16} /></button></div>
    </section>
    <div className="section-heading group-heading"><div><p className="eyebrow">SAVED GROUPS</p><h2>{groups.length} groups</h2></div></div>
    <section className="groups-grid">
      {groups.map((group) => <motion.article className="group-card" key={group.id} whileHover={{ y: -3 }}>
        <div className="group-card-top"><span className="group-emoji">{group.emoji}</span><button aria-label={`Open ${group.name}`}><ChevronRight size={18} /></button></div>
        <h3>{group.name}</h3><p>{group.members.length} members · {group.totalSplits} splits</p>
        <div className="group-members">{group.members.map((person) => <span key={person.id}><Avatar person={person} size="sm" /><small>{person.name}</small></span>)}</div>
        <div className="group-card-footer"><span><AvatarStack people={group.members} /><small>Active {group.lastActive.toLowerCase()}</small></span><button onClick={() => onStart(group)}>Start split <ArrowRight size={15} /></button></div>
      </motion.article>)}
      <button className="new-group-card" onClick={onCreate}><span><UsersRound size={24} /></span><strong>Create a group</strong><small>Save a crew you split with often</small></button>
    </section>
  </motion.main>;
}
