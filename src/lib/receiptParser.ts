export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ParsedReceipt {
  merchant: string;
  currency: string;
  currencyConfidence: number;
  items: ParsedReceiptItem[];
  tax: number;
  serviceCharge: number;
  discount: number;
  roundingAdjustment: number;
  receiptSubtotal?: number;
  receiptTotal?: number;
  confidence: number;
  warnings: string[];
}

const summaryMatchers = {
  subtotal: /\b(sub[\s-]?total|nett?\s+amount|amount\s+before)\b/i,
  tax: /\b(gst|sst|vat|tax|cgst|sgst|igst|service\s+tax|government\s+tax|sales\s+tax|iva|mwst|tva|ppn)\b|^\s*(?:hst|pst)\b/i,
  service: /\b(service\s+charge|svc|service\s+fee)\b/i,
  discount: /\b(discount|voucher|promo|savings?|less)\b/i,
  rounding: /\b(rounding|round(?:ing)?\s+adj(?:ustment)?)\b/i,
  total: /\b(grand\s+total|amount\s+due|total\s+due|net\s+total|total)\b/i,
};

const nonItemMatcher = /\b(cash|change|visa|mastercard|amex|credit\s+card|debit\s+card|card\s+payment|payment|tender|balance|rounding|receipt|invoice|table|server|cashier|thank\s*you|tel|telephone|phone|mobile|call|contact|hotline|whatsapp|fax|www\.|gst\s*(reg|no)|company\s*reg|order\s*(no|#)|transaction|approval|subtotal|total|tax|gst|sst|vat|service|discount|voucher|promo|barcode|upc|ean|reference|ref\s*(no|#)|terminal|merchant\s*id|loyalty|member(?:ship)?|reward|points?|card\s*(no|#))\b/i;
const addressMatcher = /\b(street|road|avenue|boulevard|lane|drive|jalan|jln|lorong|unit|level|floor|building|postcode|postal|zip)\b/i;
const dateMatcher = /(?:\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b)|(?:\b\d{1,2}:\d{2}(?::\d{2})?\b)|(?:\b(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?\b)/i;
const currencyToken = String.raw`(?:S\$|SGD|RM|MYR|US\$|USD|A\$|AUD|C\$|CAD|NZ\$|NZD|HK\$|HKD|CN¥|RMB|CNY|JPY|¥|EUR|€|GBP|£|KRW|₩|THB|฿|IDR|Rp|PHP|₱|INR|₹|AED|VND|₫|\$)`;
const zeroDecimalCurrencies = new Set(['JPY', 'KRW', 'VND', 'IDR']);

interface TrailingAmount {
  amount: number;
  start: number;
  raw: string;
  explicitCurrency: boolean;
  hasDecimalCents: boolean;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseMoney(raw: string): number | null {
  const cleaned = raw
    .replace(/[Oo](?=\d)/g, '0')
    .replace(/[Il](?=\d)/g, '1')
    .replace(/[^\d,.-]/g, '')
    .replace(/(?!^)-/g, '');
  if (!cleaned || !/\d/.test(cleaned)) return null;

  let normalized = cleaned;
  const comma = cleaned.lastIndexOf(',');
  const dot = cleaned.lastIndexOf('.');
  const lastSeparator = Math.max(comma, dot);
  const digitsAfterSeparator = lastSeparator >= 0 ? cleaned.length - lastSeparator - 1 : 0;
  const separatorCount = (cleaned.match(/[,.]/g) || []).length;
  if (separatorCount === 1 && digitsAfterSeparator === 3) normalized = cleaned.replace(/[,.]/g, '');
  else if (comma > dot && cleaned.length - comma - 1 === 2) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else normalized = cleaned.replace(/,/g, '');

  const value = Number(normalized);
  return Number.isFinite(value) ? Math.abs(value) : null;
}

function normalizeOcrAmountGlyphs(line: string) {
  const tail = line.match(/[0-9OoIl][0-9OoIl.,\s]*$/);
  if (!tail || tail.index === undefined) return line;
  const normalizedTail = tail[0].replace(/[Oo]/g, '0').replace(/[Il]/g, '1');
  return `${line.slice(0, tail.index)}${normalizedTail}`;
}

function trailingAmount(rawLine: string): TrailingAmount | null {
  const line = normalizeOcrAmountGlyphs(rawLine);
  const match = line.match(new RegExp(String.raw`(?:^|\s)(?:[-–—]\s*)?(${currencyToken})?\s*(\d{1,3}(?:[,.]\d{3})+[,.]\d{2}|\d{1,7}[,.]\d{2}|\d{1,3}(?:[,.]\d{3})+|\d{2,7})(?:\s*(${currencyToken}))?(?:\s+[A-Z])?\s*$`, 'i'));
  if (!match || match.index === undefined) return null;
  const amount = parseMoney(match[2]);
  return amount === null ? null : {
    amount,
    start: match.index + match[0].indexOf(match[2]),
    raw: match[2],
    explicitCurrency: Boolean(match[1] || match[3]),
    hasDecimalCents: /[,.]\d{2}$/.test(match[2]),
  };
}

function summaryAmount(line: string) {
  const direct = trailingAmount(line);
  if (direct) return direct;
  const withoutRate = line.replace(/(?:@|at)?\s*\d{1,2}(?:[,.]\d+)?\s*%/gi, ' ').replace(/\b(?:incl|included|inclusive)\b/gi, ' ').trim();
  return trailingAmount(withoutRate);
}

function isLikelyMetadataNumber(line: string, trailing: TrailingAmount, includeReceiptLabels = true) {
  if ((includeReceiptLabels && nonItemMatcher.test(line)) || dateMatcher.test(line) || addressMatcher.test(line) || /@|https?:|\.com\b/i.test(line)) return true;
  const digits = line.replace(/\D/g, '');
  const phoneLike = /(?:\+?\d[\s().-]*){7,}/.test(line);
  const longIdentifier = /\b\d{7,}\b/.test(line);
  if (!trailing.explicitCurrency && phoneLike && digits.length >= 7) return true;
  return !trailing.explicitCurrency && !trailing.hasDecimalCents && (phoneLike || longIdentifier || digits.length >= 8);
}

function isPlausibleItemPrice(line: string, trailing: TrailingAmount, currency: string) {
  if (isLikelyMetadataNumber(line, trailing)) return false;
  if (!trailing.explicitCurrency && !trailing.hasDecimalCents && !zeroDecimalCurrencies.has(currency)) return false;
  const maximums: Record<string, number> = { JPY: 10_000_000, KRW: 50_000_000, VND: 100_000_000, IDR: 100_000_000 };
  return trailing.amount > 0 && trailing.amount <= (maximums[currency] || 250_000);
}

export function detectReceiptCurrency(text: string): { code: string; confidence: number } {
  const normalizedText = text
    .replace(/\b5\s*\$(?=\s*\d)/gi, 'S$')
    .replace(/\bS\s+\$(?=\s*\d)/gi, 'S$')
    .replace(/\bS[6G]D\b/gi, 'SGD')
    .replace(/\bR[NM]\b/gi, 'RM')
    .replace(/\bM[YR][RFP]\b/gi, 'MYR');
  const scores: Record<string, number> = {};
  const add = (code: string, pattern: RegExp, weight: number) => {
    const matches = normalizedText.match(pattern)?.length || 0;
    if (matches) scores[code] = (scores[code] || 0) + Math.min(matches, 4) * weight;
  };

  add('SGD', /\bSGD\b|S\$/gi, 12); add('MYR', /\bMYR\b|\bRM\b/gi, 14);
  add('USD', /\bUSD\b|US\$/gi, 12); add('EUR', /\bEUR\b|€/gi, 12); add('GBP', /\bGBP\b|£/gi, 12);
  add('AUD', /\bAUD\b|A\$/gi, 12); add('CAD', /\bCAD\b|C\$/gi, 12); add('NZD', /\bNZD\b|NZ\$/gi, 12);
  add('HKD', /\bHKD\b|HK\$/gi, 12); add('JPY', /\bJPY\b/gi, 12); add('CNY', /\bCNY\b|\bRMB\b|CN¥/gi, 12);
  add('KRW', /\bKRW\b|₩/gi, 12); add('THB', /\bTHB\b|฿/gi, 12); add('IDR', /\bIDR\b|\bRp(?=\s*\d)/gi, 12);
  add('PHP', /\bPHP\b|₱/gi, 12); add('INR', /\bINR\b|₹/gi, 12); add('AED', /\bAED\b/gi, 12); add('VND', /\bVND\b|₫/gi, 12);

  add('SGD', /\bSINGAPORE\b|\bUEN\b|\bPTE\.?\s+LTD\b|\+65\b|\.sg\b/gi, 8);
  add('MYR', /\bMALAYSIA\b|\bSDN\.?\s+BHD\b|\+60\b|\.my\b|\bKUALA\s+LUMPUR\b|\bSELANGOR\b|\bPUTRAJAYA\b|\bPENANG\b|\bJOHOR\b|\bMELAKA\b/gi, 9);
  add('MYR', /\bSST\b/gi, 5);
  add('IDR', /\bINDONESIA\b|\bNPWP\b|\bPAJAK\b|\bPPN\b/gi, 7);
  add('THB', /\bTHAILAND\b|\bVAT\s*(?:7|NO)/gi, 7);
  add('PHP', /\bPHILIPPINES\b|\bTIN\b|\bVATABLE\b/gi, 7);
  add('INR', /\bINDIA\b|\bGSTIN\b|\bCGST\b|\bSGST\b/gi, 7);
  add('AED', /\bUAE\b|UNITED ARAB EMIRATES|\bDUBAI\b|\bABU DHABI\b/gi, 7);
  add('HKD', /\bHONG KONG\b/gi, 7); add('AUD', /\bAUSTRALIA\b|\bABN\b/gi, 7); add('CAD', /\bCANADA\b/gi, 7);
  add('JPY', /[ぁ-んァ-ン]|\bJAPAN\b/gu, 7); add('CNY', /\bCHINA\b|\bPRC\b/gi, 7); add('KRW', /[가-힣]|\bKOREA\b/gu, 7);

  if (/¥/.test(normalizedText)) {
    const likelyCny = /\b(?:CNY|RMB|CHINA|PRC)\b/iu.test(normalizedText);
    const likelyJpy = /\b(?:JPY|JAPAN)\b|[ぁ-んァ-ン]/u.test(normalizedText);
    const likelyMyr = /\b(?:MALAYSIA|MYR|RM|SDN\.?\s+BHD|KUALA\s+LUMPUR)\b|\+60\b|\.my\b/i.test(normalizedText);
    const code = likelyCny ? 'CNY' : likelyJpy ? 'JPY' : likelyMyr ? 'MYR' : /[\u4e00-\u9fff]/u.test(normalizedText) ? 'CNY' : 'JPY';
    scores[code] = (scores[code] || 0) + (likelyCny || likelyJpy ? 8 : 4);
  }
  if (/(?:^|\s)\$(?=\s*\d)/m.test(normalizedText)) {
    const dollarCandidates = Object.keys(scores).filter((code) => ['SGD', 'USD', 'AUD', 'CAD', 'NZD', 'HKD'].includes(code));
    if (dollarCandidates.length === 1) scores[dollarCandidates[0]] += 4;
    else if (!dollarCandidates.length && /\b(?:USA|UNITED STATES)\b/i.test(text)) scores.USD = 8;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { code: '', confidence: 0 };
  const [code, score] = ranked[0];
  const runnerUp = ranked[1]?.[1] || 0;
  if (runnerUp > 0 && score - runnerUp < 4) return { code: '', confidence: 0 };
  return { code, confidence: Math.min(.99, .55 + Math.max(0, score - runnerUp) / 24) };
}

function cleanItemName(value: string) {
  return value
    .replace(/^\s*[-*#]+\s*/, '')
    .replace(/^\s*#?\d{2,6}\s+/, '')
    .replace(/\s+(?:5\s*\$|S\s+\$|R[NM])\s*$/i, '')
    .replace(new RegExp(String.raw`\s+${currencyToken}\s*$`, 'i'), '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[|_]$/g, '')
    .trim();
}

function findMerchant(lines: string[]) {
  const candidate = lines.slice(0, 8).find((line) => {
    const letters = (line.match(/[A-Za-z]/g) || []).length;
    return letters >= 3 && !dateMatcher.test(line) && !nonItemMatcher.test(line) && !/@|\.com\b/i.test(line) && !/^\d/.test(line);
  });
  if (!candidate) return 'Scanned receipt';
  return candidate.replace(/[^A-Za-z0-9&'().\-\s]/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, 70);
}

function reconcileItemsWithPrintedTotal(sourceItems: ParsedReceiptItem[], target?: number) {
  if (!target || target <= 0 || sourceItems.length < 2) return { items: sourceItems, notes: [] as string[] };
  let items = sourceItems.map((item) => ({ ...item }));
  const notes: string[] = [];
  const sum = () => roundMoney(items.reduce((total, item) => total + item.quantity * item.unitPrice, 0));
  const tolerance = Math.max(.1, target * .025);

  if (sum() > target + tolerance) {
    let bestCorrection: { index: number; price: number; difference: number } | null = null;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item.unitPrice < 100) continue;
      const correctedPrice = roundMoney(item.unitPrice / 100);
      const correctedTotal = sum() - item.quantity * item.unitPrice + item.quantity * correctedPrice;
      const difference = Math.abs(correctedTotal - target);
      if (!bestCorrection || difference < bestCorrection.difference) bestCorrection = { index, price: correctedPrice, difference };
    }
    if (bestCorrection && bestCorrection.difference <= Math.max(tolerance, target * .05) && bestCorrection.difference + tolerance < Math.abs(sum() - target)) {
      items[bestCorrection.index].unitPrice = bestCorrection.price;
      notes.push(`Corrected a likely missing decimal in ${items[bestCorrection.index].name}.`);
    }
  }

  while (items.length > 1 && sum() > target + tolerance) {
    const currentDifference = Math.abs(sum() - target);
    const candidates = items.map((item, index) => ({ index, difference: Math.abs(sum() - item.quantity * item.unitPrice - target) })).sort((a, b) => a.difference - b.difference);
    const best = candidates[0];
    if (!best || best.difference + tolerance >= currentDifference) break;
    const [removed] = items.splice(best.index, 1);
    notes.push(`Excluded “${removed.name}” because its amount did not fit the printed receipt total.`);
  }

  return { items, notes };
}

export function parseReceiptText(rawText: string, ocrConfidence = 0): ParsedReceipt {
  const text = rawText.normalize('NFKC').replace(/\r/g, '\n');
  const lines = text.split('\n').map((line) => line.replace(/[\t ]+/g, ' ').trim()).filter(Boolean);
  const detectedCurrency = detectReceiptCurrency(text);
  const currency = detectedCurrency.code;
  let items: ParsedReceiptItem[] = [];
  let receiptSubtotal: number | undefined;
  let receiptTotal: number | undefined;
  let tax = 0;
  let serviceCharge = 0;
  let discount = 0;
  let roundingAdjustment = 0;
  let taxFromSummary = 0;
  let inTaxSummary = false;
  const hasTaxLabel = summaryMatchers.tax.test(text);
  const itemSectionStart = lines.findIndex((line) => /\b(?:qty|quantity)\b.*\bitem\b/i.test(line));
  const itemSectionEnd = itemSectionStart >= 0
    ? lines.findIndex((line, index) => index > itemSectionStart && summaryMatchers.subtotal.test(line))
    : -1;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (/\btax\s+summary\b/i.test(line)) { inTaxSummary = true; continue; }
    const isSummaryLine = summaryMatchers.subtotal.test(line) || summaryMatchers.discount.test(line) || summaryMatchers.rounding.test(line) || summaryMatchers.tax.test(line) || summaryMatchers.service.test(line) || summaryMatchers.total.test(line);
    const trailing = isSummaryLine ? summaryAmount(line) : trailingAmount(line);
    if (!trailing) continue;
    if (!isSummaryLine && isLikelyMetadataNumber(line, trailing, false)) continue;
    if (isSummaryLine && /\b(?:id|registration|reg\.?\s*no|number)\b/i.test(line) && isLikelyMetadataNumber(line, trailing, false)) continue;

    if (summaryMatchers.subtotal.test(line)) { receiptSubtotal = trailing.amount; continue; }
    if (summaryMatchers.discount.test(line)) { discount += trailing.amount; continue; }
    if (summaryMatchers.rounding.test(line)) {
      roundingAdjustment += /[-–—]\s*(?:(?:RM|MYR|S\$|SGD|\$)\s*)?\d/i.test(line) ? -trailing.amount : trailing.amount;
      continue;
    }
    if (summaryMatchers.tax.test(line)) {
      if (inTaxSummary) taxFromSummary += trailing.amount;
      else tax += trailing.amount;
      continue;
    }
    if (summaryMatchers.service.test(line)) { serviceCharge += trailing.amount; continue; }
    if (summaryMatchers.total.test(line)) {
      if (receiptTotal === undefined || trailing.amount > receiptTotal) receiptTotal = trailing.amount;
      continue;
    }
    if (itemSectionStart >= 0 && (lineIndex <= itemSectionStart || (itemSectionEnd >= 0 && lineIndex >= itemSectionEnd))) continue;
    if (!isPlausibleItemPrice(line, trailing, currency)) continue;

    let namePart = cleanItemName(line.slice(0, trailing.start));
    let quantity = 1;
    let unitPrice = trailing.amount;
    const quantityMatch = namePart.match(/^\s*(\d{1,2})\s*(?:x|×|@)\s*(.+)$/i) || namePart.match(/^\s*(\d{1,2})\s+(.{3,})$/);
    if (quantityMatch) {
      quantity = Math.max(1, Number(quantityMatch[1]));
      namePart = cleanItemName(quantityMatch[2]);
      unitPrice = roundMoney(trailing.amount / quantity);
    }

    const letters = (namePart.match(/[A-Za-z]/g) || []).length;
    if (letters < 2 || namePart.length > 90 || trailing.amount <= 0) continue;
    items.push({ name: namePart, quantity, unitPrice });
  }

  if (tax === 0) tax = taxFromSummary;

  if (hasTaxLabel && receiptSubtotal !== undefined) {
    if (receiptTotal !== undefined) {
      const inferredTax = roundMoney(receiptTotal - receiptSubtotal - serviceCharge + discount - roundingAdjustment);
      const taxMismatch = Math.abs(tax - inferredTax) > Math.max(.05, receiptSubtotal * .001);
      if (inferredTax > 0 && inferredTax <= receiptSubtotal * .3 && (tax === 0 || taxMismatch)) tax = inferredTax;
    } else if (tax === 0) {
      const rateMatch = text.match(/\b(?:gst|sst|vat|tax|cgst|sgst|igst|hst|pst)\b[^\n]{0,24}?(\d{1,2}(?:[,.]\d+)?)\s*%/i);
      const rate = rateMatch ? parseMoney(rateMatch[1]) : null;
      if (rate && rate <= 30) tax = roundMoney(receiptSubtotal * rate / 100);
    }
  }

  const targetSubtotal = receiptSubtotal ?? (receiptTotal !== undefined ? roundMoney(receiptTotal - tax - serviceCharge + discount - roundingAdjustment) : undefined);
  const reconciliation = reconcileItemsWithPrintedTotal(items, targetSubtotal);
  items = reconciliation.items;
  const itemSubtotal = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const expectedTotal = roundMoney((receiptSubtotal ?? itemSubtotal) + tax + serviceCharge - discount + roundingAdjustment);
  const warnings: string[] = [...reconciliation.notes];
  let structureScore = 0;

  if (items.length >= 2) structureScore += .42;
  else if (items.length === 1) structureScore += .2;
  else warnings.push('No line items were confidently detected.');

  if (receiptSubtotal !== undefined) {
    const difference = Math.abs(itemSubtotal - receiptSubtotal);
    const tolerance = Math.max(.08, receiptSubtotal * .025);
    if (difference <= tolerance) structureScore += .28;
    else warnings.push(`Detected items differ from the printed subtotal by ${difference.toFixed(2)}.`);
  } else {
    structureScore += items.length ? .08 : 0;
    warnings.push('The printed subtotal was not detected.');
  }

  if (receiptTotal !== undefined) {
    const difference = Math.abs(expectedTotal - receiptTotal);
    const tolerance = Math.max(.1, receiptTotal * .025);
    if (difference <= tolerance) structureScore += .2;
    else warnings.push(`Calculated total differs from the printed total by ${difference.toFixed(2)}.`);
  } else {
    warnings.push('The printed total was not detected.');
  }

  if (findMerchant(lines) !== 'Scanned receipt') structureScore += .1;
  const normalizedOcr = Math.max(0, Math.min(1, ocrConfidence > 1 ? ocrConfidence / 100 : ocrConfidence));
  const confidence = Math.max(0, Math.min(1, roundMoney(structureScore * .7 + normalizedOcr * .3)));

  return {
    merchant: findMerchant(lines), currency, currencyConfidence: detectedCurrency.confidence, items, tax: roundMoney(tax), serviceCharge: roundMoney(serviceCharge), discount: roundMoney(discount), roundingAdjustment: roundMoney(roundingAdjustment),
    receiptSubtotal, receiptTotal, confidence, warnings,
  };
}
