import { CheckCheck, ReceiptText, UserPlus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Notification } from '../types';

export function NotificationsPanel({ open, items, onClose, onReadAll }: { open: boolean; items: Notification[]; onClose: () => void; onReadAll: () => void }) {
  return (
    <AnimatePresence>
      {open && <>
        <motion.button className="drawer-backdrop" aria-label="Close notifications" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        <motion.aside className="drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 280 }}>
          <div className="drawer-head">
            <div><p className="eyebrow">INBOX</p><h2>Notifications</h2></div>
            <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
          </div>
          <button className="mark-read" onClick={onReadAll}><CheckCheck size={16} /> Mark all as read</button>
          <div className="notification-list">
            {items.map((item) => {
              const Icon = item.type === 'join' ? UserPlus : ReceiptText;
              return (
                <article className={`notification-item ${item.read ? '' : 'unread'}`} key={item.id}>
                  <span className={`notification-icon ${item.type}`}><Icon size={18} /></span>
                  <div><strong>{item.title}</strong><p>{item.message}</p><small>{item.createdAt}</small></div>
                  {!item.read && <span className="unread-pip" />}
                </article>
              );
            })}
          </div>
        </motion.aside>
      </>}
    </AnimatePresence>
  );
}
