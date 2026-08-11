import { Bell, Camera, Check, ChevronDown, ChevronRight, CircleDollarSign, CreditCard, Globe2, LogOut, QrCode, Search, ShieldCheck, Smartphone, UserRound, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { supportedCurrencies } from '../lib/currencies';
import type { Profile } from '../types';

function initialsFromName(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function ProfileTab({ profile, onChange, onPaymentQr, onToast }: { profile: Profile; onChange: (profile: Profile) => void; onPaymentQr: (file: File) => Promise<void>; onToast: (message: string) => void }) {
  const [uploadingQr, setUploadingQr] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const currencyPicker = useRef<HTMLDivElement>(null);
  const selectedCurrency = supportedCurrencies.find((currency) => currency.code === profile.currency);
  const currencyQuery = currencySearch.trim().toLowerCase();
  const filteredCurrencies = supportedCurrencies.filter((currency) =>
    !currencyQuery || currency.code.toLowerCase().includes(currencyQuery) || currency.label.toLowerCase().includes(currencyQuery),
  );

  useEffect(() => {
    if (!currencyOpen) return;
    const closePicker = (event: MouseEvent) => {
      if (!currencyPicker.current?.contains(event.target as Node)) setCurrencyOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCurrencyOpen(false);
    };
    document.addEventListener('mousedown', closePicker);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closePicker);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [currencyOpen]);
  const uploadQr = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try { await onPaymentQr(file); } finally { setUploadingQr(false); event.target.value = ''; }
  };

  const openEditor = () => {
    setName(profile.name);
    setEditing(true);
  };
  const saveName = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onChange({ ...profile, name: trimmedName, initials: initialsFromName(trimmedName) });
    setEditing(false);
    onToast('Profile name updated');
  };

  return <><motion.main className="page standard-page" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <div className="page-title"><div><p className="eyebrow">YOUR SPACE</p><h1>Profile & settings</h1><p>Set up how you split, pay and get notified.</p></div></div>
    <section className="profile-layout">
      <div className="profile-main">
        <article className="profile-identity card">
          <div className="big-avatar">{profile.initials}<button aria-label="Change profile photo"><Camera size={15} /></button></div>
          <div><h2>{profile.name}</h2><p>{profile.handle}</p><span><Check size={12} /> Profile ready</span></div>
          <button className="secondary-button" onClick={openEditor}>Edit profile</button>
        </article>
        <article className="card settings-card">
          <div className="card-heading"><span><Globe2 size={19} /></span><div><h3>Preferences</h3><p>Personalise your PayLah experience</p></div></div>
          <div className="setting-row currency-setting"><div><CircleDollarSign size={19} /><span><strong>Default currency</strong><small>Used when you create a new split</small></span></div>
            <div className="currency-picker" ref={currencyPicker}>
              <button type="button" className="currency-picker-trigger" aria-haspopup="listbox" aria-expanded={currencyOpen} onClick={() => { setCurrencySearch(''); setCurrencyOpen((open) => !open); }}>
                <span>{selectedCurrency?.symbol}</span><strong>{profile.currency}</strong><ChevronDown size={15} />
              </button>
              <AnimatePresence>{currencyOpen && <motion.div className="currency-menu" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
                <label className="currency-search"><Search size={15} /><input autoFocus value={currencySearch} onChange={(event) => setCurrencySearch(event.target.value)} placeholder="Search currency" aria-label="Search currencies" /></label>
                <div className="currency-options" role="listbox" aria-label="Currencies">
                  {filteredCurrencies.map((currency) => <button type="button" role="option" aria-selected={currency.code === profile.currency} key={currency.code} onClick={() => {
                    onChange({ ...profile, currency: currency.code });
                    setCurrencyOpen(false);
                    onToast(`Default currency changed to ${currency.code}`);
                  }}><span className="currency-symbol">{currency.symbol}</span><span><strong>{currency.code}</strong><small>{currency.label}</small></span>{currency.code === profile.currency && <Check size={15} />}</button>)}
                  {!filteredCurrencies.length && <p className="currency-empty">No currency found</p>}
                </div>
              </motion.div>}</AnimatePresence>
            </div>
          </div>
          <button className="setting-row"><div><Bell size={19} /><span><strong>Notifications</strong><small>Payment and table activity alerts</small></span></div><span className="toggle on"><i /></span></button>
          <button className="setting-row"><div><ShieldCheck size={19} /><span><strong>Privacy & security</strong><small>Manage your data and account access</small></span></div><ChevronRight size={18} /></button>
        </article>
        <article className="card settings-card compact">
          <button className="setting-row"><div><Smartphone size={19} /><span><strong>Connected devices</strong><small>1 active session</small></span></div><ChevronRight size={18} /></button>
          <button className="setting-row logout"><div><LogOut size={19} /><span><strong>Sign out</strong></span></div></button>
        </article>
      </div>
      <aside className="payment-card card">
        <div className="card-heading"><span><CreditCard size={19} /></span><div><h3>Get paid faster</h3><p>Your personal payment QR</p></div></div>
        <div className={`qr-upload ${profile.paymentQr ? 'has-image' : ''}`}>
          {profile.paymentQr ? <img src={profile.paymentQr} alt="Your payment QR code" /> : <><span><QrCode size={44} /></span><strong>Add payment QR</strong><p>Upload your PayNow, DuitNow, Venmo or bank QR.</p></>}
        </div>
        <label className={`primary-button qr-button ${uploadingQr ? 'disabled' : ''}`}><Camera size={17} /> {uploadingQr ? 'Uploading…' : profile.paymentQr ? 'Replace QR code' : 'Upload QR code'}<input type="file" accept="image/*" onChange={uploadQr} disabled={uploadingQr} /></label>
        <p className="privacy-note"><ShieldCheck size={14} /> Only shared when you request payment.</p>
      </aside>
    </section>
  </motion.main>
  <AnimatePresence>{editing && <div className="modal-shell small-shell">
    <motion.button className="modal-backdrop" aria-label="Close profile editor" onClick={() => setEditing(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
    <motion.form className="small-modal profile-edit-modal" aria-labelledby="profile-edit-title" onSubmit={(event) => { event.preventDefault(); saveName(); }} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
      <button type="button" className="icon-button modal-x" aria-label="Close profile editor" onClick={() => setEditing(false)}><X size={19} /></button>
      <span className="feature-icon green"><UserRound size={23} /></span>
      <p className="eyebrow">EDIT PROFILE</p>
      <h2 id="profile-edit-title">What should we call you?</h2>
      <p>This name appears on your profile and shared tables.</p>
      <label className="profile-name-input"><span>Name</span><input autoFocus maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
      <button type="submit" className="primary-button modal-submit" disabled={!name.trim()}>Save changes</button>
    </motion.form>
  </div>}</AnimatePresence>
  </>;
}
