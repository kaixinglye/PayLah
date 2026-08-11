import type { BillItem } from '../types';

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function itemLineTotal(unitPrice: number, quantity: number) {
  return roundMoney(unitPrice * Math.max(1, quantity));
}

export function unitPriceFromLineTotal(lineTotal: number, quantity: number) {
  return roundMoney(lineTotal / Math.max(1, quantity));
}

export function claimedQuantityFor(item: BillItem, personId: string) {
  if (item.claimedQuantities) return item.claimedQuantities[personId] || 0;
  if (!item.claimedBy.includes(personId)) return 0;
  return item.quantity / Math.max(1, item.claimedBy.length);
}

export function claimedItemAmount(item: BillItem, personId: string) {
  return roundMoney(item.price * claimedQuantityFor(item, personId));
}

export function totalClaimedQuantity(item: BillItem) {
  if (item.claimedQuantities) return Object.values(item.claimedQuantities).reduce((sum, quantity) => sum + quantity, 0);
  return item.claimedBy.length ? item.quantity : 0;
}

export function withClaimedQuantity(item: BillItem, personId: string, requestedQuantity: number): BillItem {
  const claimedQuantities = item.claimedQuantities
    ? { ...item.claimedQuantities }
    : Object.fromEntries(item.claimedBy.map((id) => [id, claimedQuantityFor(item, id)]));
  const claimedByOthers = Object.entries(claimedQuantities).reduce((sum, [id, quantity]) => id === personId ? sum : sum + quantity, 0);
  const available = Math.max(0, item.quantity - claimedByOthers);
  const quantity = Math.max(0, Math.min(Math.floor(requestedQuantity), available));

  if (quantity) claimedQuantities[personId] = quantity;
  else delete claimedQuantities[personId];

  return {
    ...item,
    claimedBy: Object.keys(claimedQuantities).filter((id) => claimedQuantities[id] > 0),
    claimedQuantities,
  };
}
