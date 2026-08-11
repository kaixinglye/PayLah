import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReceiptText } from './receiptParser';

test('does not treat PST inside an invoice identifier as a tax amount', () => {
  const receipt = parseReceiptText(`
Malaysian Cafe SDN. BHD.
KUALA LUMPUR
INVOICE NO: LBK-PST-C01/52941 []: 026
QTY ITEM RM
1 Chicken Rice 106.40
Subtotal 106.40
Service Charge@10% 10.64
Service Tax@6% 6.38
Rounding Adj -0.02
Net Total 123.40
`, .97);

  assert.equal(receipt.tax, 6.38);
  assert.equal(receipt.serviceCharge, 10.64);
  assert.equal(receipt.roundingAdjustment, -.02);
  assert.equal(receipt.receiptTotal, 123.4);
});

test('reconciles an implausible extracted tax against printed receipt totals', () => {
  const receipt = parseReceiptText(`
Cafe
QTY ITEM RM
1 Meal 100.00
Subtotal 100.00
Service Charge 10.00
Tax 26.00
Service Tax 6.00
Net Total 116.00
`, .95);

  assert.equal(receipt.tax, 6);
  assert.equal(receipt.serviceCharge, 10);
  assert.equal(receipt.receiptTotal, 116);
});
