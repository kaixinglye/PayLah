import { Clock3, Home, UserRound, UsersRound } from 'lucide-react';
import type { Tab } from '../types';

const items = [
  { id: 'home' as const, label: 'Home', icon: Home },
  { id: 'history' as const, label: 'History', icon: Clock3 },
  { id: 'groups' as const, label: 'Groups', icon: UsersRound },
  { id: 'profile' as const, label: 'Profile', icon: UserRound },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} className={active === id ? 'active' : ''} onClick={() => onChange(id)} aria-current={active === id ? 'page' : undefined}>
          <Icon size={21} strokeWidth={active === id ? 2.5 : 2} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
