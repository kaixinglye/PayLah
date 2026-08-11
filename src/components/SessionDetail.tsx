import { Check, CheckCircle2, Copy, Minus, Plus, Share2, UserPlus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Avatar } from './AvatarStack';
import { formatMoney, sessionTotal } from '../data';
import { claimedItemAmount, claimedQuantityFor, totalClaimedQuantity, withClaimedQuantity } from '../lib/billMath';
import type { BillSession } from '../types';

export function SessionDetail({ session, onClose, onUpdate, onToast }: { session: BillSession | null; onClose: () => void; onUpdate: (session: BillSession) => void; onToast: (message: string) => void }) {
  if (!session) return null;
  const subtotal = session.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const fees = session.tax + session.serviceCharge - session.discount + (session.roundingAdjustment || 0);
  const personTotal = (personId: string) => {
    const itemAmount = session.items.reduce((sum, item) => sum + claimedItemAmount(item, personId), 0);
    return itemAmount + (subtotal ? itemAmount / subtotal * fees : 0);
  };
  const toggleClaim = (itemId: string) => onUpdate({ ...session, items: session.items.map((item) => item.id === itemId ? { ...item, claimedBy: item.claimedBy.includes('you') ? item.claimedBy.filter((id) => id !== 'you') : [...item.claimedBy, 'you'] } : item) });
  const updateClaimQuantity = (itemId: string, quantity: number) => onUpdate({
    ...session,
    items: session.items.map((item) => item.id === itemId ? withClaimedQuantity(item, 'you', quantity) : item),
  });
  const personItemCount = (personId: string) => session.items.reduce((sum, item) => sum + claimedQuantityFor(item, personId), 0);

  return <AnimatePresence><div className="modal-shell session-shell">
    <motion.button className="modal-backdrop" onClick={onClose} aria-label="Close table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
    <motion.section className="session-modal" initial={{ opacity: 0, y: 30, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}>
      <header className="session-head">
        <div><span className={`status-pill ${session.status}`}>{session.status === 'active' && <b />} {session.status}</span><h2>{session.name}</h2><p>{session.venue}</p></div>
        <button className="icon-button" onClick={onClose}><X size={20} /></button>
      </header>
      <div className="session-code-row"><div><small>TABLE CODE</small><strong>{session.code}</strong></div><button onClick={() => { navigator.clipboard?.writeText(session.code); onToast('Table code copied'); }}><Copy size={17} /> Copy code</button><button onClick={() => onToast('Share link copied')}><Share2 size={17} /> Share</button></div>
      <div className="session-columns">
        <div className="claim-column">
          <div className="column-title"><div><p className="eyebrow">THE RECEIPT</p><h3>Claim your items and quantities</h3></div><span>{session.items.filter((item) => item.claimedBy.length).length}/{session.items.length} claimed</span></div>
          <div className="claim-list">{session.items.map((item) => {
            const yours = item.claimedBy.includes('you');
            const yourQuantity = claimedQuantityFor(item, 'you');
            const maximumForYou = item.quantity - totalClaimedQuantity(item) + yourQuantity;
            const claimCheck = item.quantity > 1 && session.status === 'active'
              ? <button type="button" className="claim-check" aria-label={yours ? `Unselect all ${item.name}` : `Claim one ${item.name}`} disabled={!yours && maximumForYou <= 0} onClick={() => updateClaimQuantity(item.id, yours ? 0 : 1)}>{yours && <Check size={14} />}</button>
              : <span className="claim-check">{yours && <Check size={14} />}</span>;
            const itemContent = <>{claimCheck}<span className="claim-copy"><strong>{item.name}</strong><small>{item.quantity > 1 && `${item.quantity} × `}{formatMoney(item.price, session.currency)}</small>{item.quantity > 1 && <em>{yourQuantity ? `You claimed ${yourQuantity}` : 'Choose your quantity'}</em>}</span>
              <span className="claimers">{item.claimedBy.map((id) => { const p = session.people.find((person) => person.id === id); return p ? <Avatar key={id} person={p} size="sm" /> : null; })}</span></>;

            if (item.quantity > 1) return <div className={`claim-item multi-claim ${yours ? 'yours' : ''}`} key={item.id}>
              {itemContent}
              {session.status === 'active' ? <span className="claim-quantity-area"><span className="claim-quantity-control"><button type="button" aria-label={`Claim one fewer ${item.name}`} disabled={!yourQuantity} onClick={() => updateClaimQuantity(item.id, yourQuantity - 1)}><Minus size={12} /></button><b>{yourQuantity}</b><button type="button" aria-label={`Claim one more ${item.name}`} disabled={yourQuantity >= maximumForYou} onClick={() => updateClaimQuantity(item.id, yourQuantity + 1)}><Plus size={12} /></button></span><small>your quantity</small></span> : <span className="claimed-quantity-static">{yourQuantity} of {item.quantity}</span>}
              <strong>{formatMoney(item.price * item.quantity, session.currency)}</strong>
            </div>;

            return <button className={`claim-item ${yours ? 'yours' : ''}`} key={item.id} onClick={() => session.status === 'active' && toggleClaim(item.id)}>
              {itemContent}<strong>{formatMoney(item.price, session.currency)}</strong>
            </button>;
          })}</div>
          <div className="receipt-totals"><span>Subtotal <b>{formatMoney(subtotal, session.currency)}</b></span><span>Tax & service <b>{formatMoney(session.tax + session.serviceCharge, session.currency)}</b></span>{session.discount > 0 && <span>Discount <b>− {formatMoney(session.discount, session.currency)}</b></span>}{Boolean(session.roundingAdjustment) && <span>Rounding <b>{formatMoney(session.roundingAdjustment || 0, session.currency)}</b></span>}<span>Total <b>{formatMoney(sessionTotal(session), session.currency)}</b></span></div>
        </div>
        <aside className="split-column">
          <p className="eyebrow">WHO OWES WHAT</p><h3>Split summary</h3>
          <div className="people-totals">{session.people.map((person) => { const count = personItemCount(person.id); return <div key={person.id}><Avatar person={person} /><span><strong>{person.name}</strong><small>{count} {count === 1 ? 'item' : 'items'}</small></span><b>{formatMoney(personTotal(person.id), session.currency)}</b></div>; })}</div>
          <div className="you-owe"><small>YOUR SHARE</small><strong>{formatMoney(personTotal('you'), session.currency)}</strong><p>Includes your share of tax & service</p></div>
          {session.status === 'active' ? <button className="primary-button settle-button" onClick={() => onUpdate({ ...session, status: 'settled' })}><CheckCircle2 size={18} /> Mark table settled</button> : <div className="settled-message"><CheckCircle2 size={22} /><div><strong>All settled up!</strong><p>No outstanding payments.</p></div></div>}
          <button className="invite-button" onClick={() => onToast('Invite link copied')}><UserPlus size={17} /> Invite someone</button>
        </aside>
      </div>
    </motion.section>
  </div></AnimatePresence>;
}
