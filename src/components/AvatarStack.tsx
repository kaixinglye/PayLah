import type { Person } from '../types';

export function Avatar({ person, size = 'md' }: { person: Person; size?: 'sm' | 'md' | 'lg' }) {
  const initials = person.name === 'You' ? 'YO' : person.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <span className={`person-avatar avatar-${size}`} style={{ backgroundColor: person.color }} title={person.name}>{initials}</span>;
}

export function AvatarStack({ people, extra = 0 }: { people: Person[]; extra?: number }) {
  return (
    <div className="avatar-stack">
      {people.slice(0, 4).map((person) => <Avatar key={person.id} person={person} size="sm" />)}
      {extra > 0 && <span className="person-avatar avatar-sm avatar-extra">+{extra}</span>}
    </div>
  );
}
