import assert from 'node:assert/strict';
import test from 'node:test';
import { claimedItemAmount, claimedQuantityFor, itemLineTotal, totalClaimedQuantity, unitPriceFromLineTotal, withClaimedQuantity } from './billMath';
import type { BillItem } from '../types';

test('shows the receipt line total while retaining the unit price', () => {
  assert.equal(itemLineTotal(16.9, 2), 33.8);
  assert.equal(itemLineTotal(16.9, 1), 16.9);
  assert.equal(unitPriceFromLineTotal(33.8, 2), 16.9);
});

test('lets people claim individual units from a multi-quantity item', () => {
  const item: BillItem = { id: 'item-1', name: 'Iced tea', quantity: 3, price: 4.5, claimedBy: [] };
  const oneForYou = withClaimedQuantity(item, 'you', 1);
  const oneEach = withClaimedQuantity(oneForYou, 'sarah', 1);

  assert.equal(claimedQuantityFor(oneEach, 'you'), 1);
  assert.equal(claimedQuantityFor(oneEach, 'sarah'), 1);
  assert.equal(totalClaimedQuantity(oneEach), 2);
  assert.equal(claimedItemAmount(oneEach, 'you'), 4.5);
});

test('does not let claims exceed the receipt quantity', () => {
  const item: BillItem = { id: 'item-1', name: 'Iced tea', quantity: 2, price: 4.5, claimedBy: [], claimedQuantities: { sarah: 1 } };
  const updated = withClaimedQuantity(item, 'you', 5);

  assert.equal(claimedQuantityFor(updated, 'you'), 1);
  assert.equal(totalClaimedQuantity(updated), 2);
});

test('can clear every unit claimed by a person', () => {
  const item: BillItem = { id: 'item-1', name: 'Nasi lemak', quantity: 2, price: 16.9, claimedBy: ['you'], claimedQuantities: { you: 2 } };
  const updated = withClaimedQuantity(item, 'you', 0);

  assert.equal(claimedQuantityFor(updated, 'you'), 0);
  assert.equal(totalClaimedQuantity(updated), 0);
  assert.deepEqual(updated.claimedBy, []);
});

test('preserves legacy shared-item totals', () => {
  const item: BillItem = { id: 'item-1', name: 'Pizza', quantity: 1, price: 18, claimedBy: ['you', 'sarah'] };

  assert.equal(claimedQuantityFor(item, 'you'), .5);
  assert.equal(claimedItemAmount(item, 'you'), 9);
});
