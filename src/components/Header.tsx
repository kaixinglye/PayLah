import { Bell, ChevronDown, Cloud, CloudOff, LoaderCircle } from 'lucide-react';
import type { CloudSyncState } from '../lib/firebaseStore';
import type { Profile } from '../types';

interface HeaderProps {
  profile: Profile;
  unread: number;
  cloudState: CloudSyncState;
  cloudMessage?: string;
  onNotifications: () => void;
}

export function Header({ profile, unread, cloudState, cloudMessage, onNotifications }: HeaderProps) {
  const CloudIcon = cloudState === 'synced' ? Cloud : cloudState === 'connecting' ? LoaderCircle : CloudOff;
  return (
    <header className="topbar">
      <button className="brand" aria-label="PayLah home">
        <span className="brand-mark"><span>$</span></span>
        <span>PayLah</span>
      </button>
      <div className="topbar-actions">
        <span className={`sync-status ${cloudState}`} title={cloudMessage || (cloudState === 'synced' ? 'Changes sync to Firebase in real time' : 'Connecting to Firebase')}>
          <CloudIcon size={14} className={cloudState === 'connecting' ? 'spin' : ''} />
          <span>{cloudState === 'synced' ? 'Synced' : cloudState === 'connecting' ? 'Connecting' : 'Firebase offline'}</span>
        </span>
        <button className="icon-button notification-button" onClick={onNotifications} aria-label={`${unread} unread notifications`}>
          <Bell size={20} strokeWidth={2.2} />
          {unread > 0 && <span className="notification-dot">{unread}</span>}
        </button>
        <button className="profile-chip" aria-label="Profile menu">
          <span className="mini-avatar">{profile.initials}</span>
          <span className="profile-chip-copy"><strong>{profile.name}</strong><small>{profile.handle}</small></span>
          <ChevronDown size={15} />
        </button>
      </div>
    </header>
  );
}
