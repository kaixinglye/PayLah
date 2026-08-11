import { ArrowLeft, ArrowRight, Camera, Check, CircleDollarSign, Cloud, Image, LoaderCircle, Minus, Plus, ReceiptText, ScanText, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { formatMoney, people } from '../data';
import { demoReceipt, scanReceipt } from '../lib/receiptOcr';
import type { ParsedReceipt } from '../lib/receiptParser';
import { currencySymbol } from '../lib/currencies';
import { itemLineTotal, unitPriceFromLineTotal } from '../lib/billMath';
import type { BillItem, BillSession, DiningGroup } from '../types';

const starterItems: BillItem[] = [
  { id: 'new-1', name: 'Truffle fries', quantity: 1, price: 14, claimedBy: [] },
  { id: 'new-2', name: 'Crab linguine', quantity: 1, price: 28, claimedBy: [] },
  { id: 'new-3', name: 'Chicken schnitzel', quantity: 1, price: 26, claimedBy: [] },
  { id: 'new-4', name: 'Iced oat latte', quantity: 2, price: 6, claimedBy: [] },
];

export function Stepper({ open, onClose, onComplete, presetGroup }: { open: boolean; onClose: () => void; onComplete: (session: BillSession) => void; presetGroup?: DiningGroup | null }) {
  const [step, setStep] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState('');
  const [merchant, setMerchant] = useState('The Glasshouse');
  const [items, setItems] = useState<BillItem[]>(starterItems);
  const [tax, setTax] = useState(5.6);
  const [service, setService] = useState(8);
  const [discount, setDiscount] = useState(0);
  const [roundingAdjustment, setRoundingAdjustment] = useState(0);
  const [currency, setCurrency] = useState('');
  const [currencyConfidence, setCurrencyConfidence] = useState(0);
  const [tableName, setTableName] = useState(presetGroup ? `${presetGroup.name} meal` : 'Saturday lunch');
  const [error, setError] = useState('');
  const [scanStatus, setScanStatus] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanSource, setScanSource] = useState<'cloud-vision' | 'demo'>('cloud-vision');
  const inputRef = useRef<HTMLInputElement>(null);
  const subtotal = useMemo(() => items.reduce((n, item) => n + item.quantity * item.price, 0), [items]);
  const currencyPrefix = currencySymbol(currency);

  const applyReceipt = (data: ParsedReceipt) => {
    setMerchant(data.merchant || 'Scanned receipt');
    setCurrency(data.currencyConfidence >= .7 ? data.currency : '');
    setCurrencyConfidence(data.currencyConfidence || 0);
    setItems(data.items.map((item, index) => ({ id: `scan-${Date.now()}-${index}`, name: item.name || `Item ${index + 1}`, quantity: Number(item.quantity) || 1, price: Number(item.unitPrice) || 0, claimedBy: [] })));
    setTax(data.tax);
    setService(data.serviceCharge);
    setDiscount(data.discount);
    setRoundingAdjustment(data.roundingAdjustment);
  };

  const scanFile = async (file?: File) => {
    if (file && file.size > 10 * 1024 * 1024) { setError('That image is over 10 MB. Choose a smaller receipt photo.'); return; }
    setScanning(true); setError(''); setScanProgress(0); setScanStatus(file ? 'Preparing Google Cloud Vision scan' : 'Loading demo receipt');
    if (file) setPreview(URL.createObjectURL(file));
    try {
      if (file) {
        const result = await scanReceipt(file, ({ status, progress }) => { setScanStatus(status); setScanProgress(progress); });
        setPreview(result.preview);
        setScanSource(result.source);
        applyReceipt(result.receipt);
        if (!result.receipt.items.length) setError('We found text but no reliable line items. Add them manually below or try a clearer photo.');
        else if (!result.receipt.currency || result.receipt.currencyConfidence < .7) setError('The receipt currency could not be verified. Try a clearer photo that includes the currency symbol, code, or merchant address.');
        else if (result.receipt.warnings.length) setError(result.receipt.warnings.slice(0, 2).join(' '));
      } else {
        await new Promise((resolve) => setTimeout(resolve, 650));
        applyReceipt(demoReceipt());
        setScanSource('demo');
      }
      setStep(2);
    } catch (scanError) {
      setItems([]); setTax(0); setService(0); setDiscount(0); setRoundingAdjustment(0);
      setError(scanError instanceof Error ? `${scanError.message} You can enter the items manually.` : 'We could not read this receipt. You can enter the items manually.');
      setStep(2);
    } finally { setScanning(false); setScanStatus(''); }
  };

  const changeItem = (id: string, patch: Partial<BillItem>) => setItems(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const addItem = () => setItems([...items, { id: `item-${Date.now()}`, name: 'New item', quantity: 1, price: 0, claimedBy: [] }]);
  const finish = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    onComplete({
      id: `session-${Date.now()}`, code, name: tableName || 'Untitled split', venue: merchant || 'Receipt', date: new Date().toISOString(),
      currency, status: 'active', items, people: presetGroup?.members || people.slice(0, 1), tax, serviceCharge: service, discount, roundingAdjustment,
    });
    onClose();
  };

  return <AnimatePresence>{open && <div className="modal-shell">
    <motion.button className="modal-backdrop" onClick={onClose} aria-label="Close" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
    <motion.section className="stepper-modal" initial={{ opacity: 0, y: 30, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: .98 }}>
      <header className="stepper-header">
        <button className="icon-button" onClick={step > 1 ? () => setStep(step - 1) : onClose}>{step > 1 ? <ArrowLeft size={20} /> : <X size={20} />}</button>
        <div className="step-dots">{['Receipt', 'Review', 'Share'].map((label, index) => <div key={label} className={step >= index + 1 ? 'active' : ''}><span>{step > index + 1 ? <Check size={13} /> : index + 1}</span><small>{label}</small>{index < 2 && <i />}</div>)}</div>
        <button className="close-text" onClick={onClose}>Save & exit</button>
      </header>

      {step === 1 && <motion.div className="step-content upload-step" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="step-title"><span className="feature-icon coral"><ReceiptText size={23} /></span><p className="eyebrow">STEP 1 OF 3</p><h2>Let’s see the receipt.</h2><p>Snap a clear photo or choose one from your library. We’ll handle the itemising.</p></div>
        <button className={`receipt-drop ${preview ? 'with-preview' : ''}`} onClick={() => inputRef.current?.click()} disabled={scanning}>
          {preview ? <img src={preview} alt="Receipt preview" /> : <>
            <span className="scan-corners"><i /><i /><i /><i /><Camera size={42} /></span>
            <strong>Drop your receipt here</strong><p>or click to browse from your device</p><small>JPG, PNG or HEIC · Max 10 MB</small>
          </>}
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={(event: ChangeEvent<HTMLInputElement>) => scanFile(event.target.files?.[0])} />
        </button>
        {scanning && <div className="scan-progress"><div><span><LoaderCircle className="spin" size={15} /> {scanStatus}</span><strong>{Math.round(scanProgress * 100)}%</strong></div><i><b style={{ width: `${Math.max(4, scanProgress * 100)}%` }} /></i></div>}
        {error && <p className="scan-error">{error}</p>}
        <div className="upload-actions"><button className="secondary-button" onClick={() => inputRef.current?.click()} disabled={scanning}><Image size={18} /> Choose photo</button><button className="primary-button" onClick={() => scanFile()} disabled={scanning}>{scanning ? <><LoaderCircle className="spin" size={18} /> Reading receipt…</> : <><ScanText size={18} /> Try demo receipt</>}</button></div>
        <p className="ai-note"><Cloud size={14} /> Receipt images are sent securely to Google Cloud Vision for text detection, then checked with receipt-specific rules.</p>
      </motion.div>}

      {step === 2 && <motion.div className="step-content review-step" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
        <div className="step-title compact"><span className="feature-icon green"><ScanText size={22} /></span><p className="eyebrow">STEP 2 OF 3</p><h2>Check the details.</h2><p>OCR extracted the text. Make any tweaks before sharing.</p></div>
        <div className="ocr-source"><Cloud size={14} /><span>{scanSource === 'cloud-vision' ? 'Read with Google Cloud Vision' : 'Using the built-in demo receipt'}</span></div>
        {error && <div className="demo-banner"><Sparkles size={16} /> {error}</div>}
        <div className="receipt-fields">
          <div className="merchant-field"><label>MERCHANT</label><input value={merchant} onChange={(e) => setMerchant(e.target.value)} /></div>
          <div className={`currency-field ${currency ? 'detected' : 'unknown'}`}><span>CURRENCY</span><div><CircleDollarSign size={15} /><strong>{currency ? `${currency} · ${currencySymbol(currency)}` : 'Not detected'}</strong><Check size={14} /></div><small>{currency ? `Detected from receipt · ${Math.round(currencyConfidence * 100)}% confidence` : 'Scan a clearer receipt'}</small></div>
        </div>
        <div className="items-editor">
          <div className="items-head"><span>ITEM</span><span>QTY</span><span>LINE TOTAL</span><span /></div>
          {items.map((item) => <div className="editable-item" key={item.id}>
            <input value={item.name} onChange={(e) => changeItem(item.id, { name: e.target.value })} aria-label="Item name" />
            <div className="quantity-control"><button onClick={() => changeItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => changeItem(item.id, { quantity: item.quantity + 1 })}><Plus size={13} /></button></div>
            <label className="price-input"><span>{currencyPrefix}</span><input type="number" min="0" step="0.01" value={itemLineTotal(item.price, item.quantity)} onChange={(e) => changeItem(item.id, { price: unitPriceFromLineTotal(Number(e.target.value), item.quantity) })} /></label>
            <button className="delete-item" onClick={() => setItems(items.filter((i) => i.id !== item.id))}><Trash2 size={16} /></button>
          </div>)}
          <button className="add-line" onClick={addItem}><Plus size={16} /> Add another item</button>
        </div>
        <div className="totals-editor">
          <span>Subtotal <strong>{formatMoney(subtotal, currency)}</strong></span>
          <label>Tax <span>{currencyPrefix} <input type="number" value={tax} min="0" step="0.01" onChange={(e) => setTax(Number(e.target.value))} /></span></label>
          <label>Service charge <span>{currencyPrefix} <input type="number" value={service} min="0" step="0.01" onChange={(e) => setService(Number(e.target.value))} /></span></label>
          <label>Discount <span>− {currencyPrefix} <input type="number" value={discount} min="0" step="0.01" onChange={(e) => setDiscount(Number(e.target.value))} /></span></label>
          {roundingAdjustment !== 0 && <label>Rounding adjustment <span>{currencyPrefix} <input type="number" value={roundingAdjustment} step="0.01" onChange={(e) => setRoundingAdjustment(Number(e.target.value))} /></span></label>}
          <span className="grand-total">Total <strong>{formatMoney(subtotal + tax + service - discount + roundingAdjustment, currency)}</strong></span>
        </div>
        <div className="step-footer"><button className="secondary-button" onClick={() => setStep(1)}>Back</button><button className="primary-button" onClick={() => setStep(3)} disabled={!currency}>Looks good <ArrowRight size={17} /></button></div>
      </motion.div>}

      {step === 3 && <motion.div className="step-content share-step" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
        <div className="step-title"><span className="feature-icon violet"><Upload size={23} /></span><p className="eyebrow">STEP 3 OF 3</p><h2>Name it. Share it. Split it.</h2><p>Give the table a name and we’ll create a code for everyone to join.</p></div>
        <div className="share-card">
          <div className="share-receipt"><ReceiptText size={26} /><div><strong>{merchant}</strong><small>{items.length} items · {formatMoney(subtotal + tax + service - discount + roundingAdjustment, currency)}</small></div><Check size={17} /></div>
          <label className="large-input"><span>TABLE NAME</span><input autoFocus value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="e.g. Saturday lunch" /></label>
          {presetGroup && <div className="preset-group"><span>{presetGroup.emoji}</span><div><small>SPLITTING WITH</small><strong>{presetGroup.name}</strong></div><Check size={17} /></div>}
          <div className="share-explainer"><span><b>1</b><small>Share your code</small></span><i /><span><b>2</b><small>Everyone claims items</small></span><i /><span><b>3</b><small>Settle up</small></span></div>
        </div>
        <button className="primary-button create-table-button" onClick={finish}>Create table <ArrowRight size={18} /></button>
        <p className="ai-note">You can invite more people after creating the table.</p>
      </motion.div>}
    </motion.section>
  </div>}</AnimatePresence>;
}
