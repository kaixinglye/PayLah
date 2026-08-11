import { parseReceiptText, type ParsedReceipt } from './receiptParser';

export interface OcrProgress {
  status: string;
  progress: number;
}

interface CloudOcrResult {
  text: string;
  confidence: number;
  provider: 'cloud-vision';
}

interface CloudOcrError {
  error?: string;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The receipt image could not be read.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The receipt image format is not supported.'));
    image.src = dataUrl;
  });
}

async function prepareReceiptImage(dataUrl: string) {
  const image = await loadImage(dataUrl);
  const maxDimension = 2200;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', .94);
}

async function readWithCloudVision(image: string): Promise<CloudOcrResult> {
  let response: Response;
  try {
    response = await fetch('/api/ocr/cloud-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
  } catch {
    throw new Error('Google Cloud Vision could not be reached. Check your connection and try again.');
  }

  const payload = await response.json().catch(() => ({})) as CloudOcrResult & CloudOcrError;
  if (!response.ok) throw new Error(payload.error || 'Google Cloud Vision could not scan this receipt.');
  if (!payload.text?.trim()) throw new Error('Google Cloud Vision did not find any text in this image.');
  return payload;
}

export async function scanReceipt(file: File, onProgress: (progress: OcrProgress) => void): Promise<{ receipt: ParsedReceipt; preview: string; source: 'cloud-vision' }> {
  const preview = await fileToDataUrl(file);
  onProgress({ status: 'Preparing receipt image', progress: .12 });
  const prepared = await prepareReceiptImage(preview);
  onProgress({ status: 'Scanning with Google Cloud Vision', progress: .48 });
  const cloud = await readWithCloudVision(prepared);
  onProgress({ status: 'Finding items, totals and currency', progress: .86 });
  const receipt = parseReceiptText(cloud.text, cloud.confidence);
  onProgress({ status: 'Receipt ready', progress: 1 });
  return { receipt, preview, source: 'cloud-vision' };
}

export function demoReceipt() {
  return parseReceiptText(`
THE GLASSHOUSE
Saturday 08/08/2026 12:42
Truffle Fries                 S$ 14.00
Crab Linguine                 S$ 28.00
Chicken Schnitzel             S$ 26.00
2 x Iced Oat Latte            S$ 12.00
Subtotal                      S$ 80.00
GST                           S$ 5.60
Service Charge                S$ 8.00
TOTAL                         S$ 93.60
Thank you
  `, 96);
}
