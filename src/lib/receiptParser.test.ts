import assert from 'node:assert/strict';
import test from 'node:test';
import { detectReceiptCurrency, parseReceiptText } from './receiptParser';

const luckBrosReceipt = `
Luck Bros Kopi
HORIZON MIRACLES SDN. BHD.
NO. 9, TINGKAT BAWAH DAN SATU
JALAN BALAI POLIS, CITY CENTRE
50000, KUALA LUMPUR
SST ID: W10-2003-32000031
WhatsApp: +60 12-610 8856
INVOICE
INVOICE NO: LBK-PST-C01/52941 []: 026
QTY ITEM RM
*** Dine In ***
1 #301 Classic Hainanese Chicken Chop 19.90
经典海南鸡扒
2 #101 Signature Nasi Lemak Ayam 33.80
招牌炸鸡椰浆饭
1 #910 Teh Tower 18.90
奶茶塔
1 #235 Salted Egg Chicken Rice 16.90
金黄咸蛋鸡盖饭
1 #151 Mi Sedaap Ayam Panggong 16.90
招牌炸鸡Mi Sedaap
6 SubTotal 106.40
Service Charge@10%: 10.64
Service Tax@6%: 6.38
Rounding Adj -0.02
Net Total 123.40
CREDIT CARD 123.40
Tax Summary
SST 106.40 6.38
`;

test('parses a bilingual Malaysian restaurant receipt', () => {
  const receipt = parseReceiptText(luckBrosReceipt, .97);

  assert.equal(receipt.merchant, 'Luck Bros Kopi');
  assert.equal(receipt.currency, 'MYR');
  assert.ok(receipt.currencyConfidence >= .9);
  assert.deepEqual(receipt.items, [
    { name: 'Classic Hainanese Chicken Chop', quantity: 1, unitPrice: 19.9 },
    { name: 'Signature Nasi Lemak Ayam', quantity: 2, unitPrice: 16.9 },
    { name: 'Teh Tower', quantity: 1, unitPrice: 18.9 },
    { name: 'Salted Egg Chicken Rice', quantity: 1, unitPrice: 16.9 },
    { name: 'Mi Sedaap Ayam Panggong', quantity: 1, unitPrice: 16.9 },
  ]);
  assert.equal(receipt.receiptSubtotal, 106.4);
  assert.equal(receipt.serviceCharge, 10.64);
  assert.equal(receipt.tax, 6.38);
  assert.equal(receipt.discount, 0);
  assert.equal(receipt.roundingAdjustment, -.02);
  assert.equal(receipt.receiptTotal, 123.4);
  assert.deepEqual(receipt.warnings, []);
});

test('does not treat Chinese translations as CNY evidence', () => {
  const currency = detectReceiptCurrency('HORIZON MIRACLES SDN. BHD. KUALA LUMPUR\nQTY ITEM RM\n经典海南鸡扒\nSST 6%');
  assert.equal(currency.code, 'MYR');
  assert.ok(currency.confidence >= .9);
});
