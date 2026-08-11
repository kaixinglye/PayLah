import type { BillSession, Person, Profile } from './types';
import { currencySymbol } from './lib/currencies';

export const people: Person[] = [
  { id: 'you', name: 'You', color: '#191d18' },
  { id: 'sarah', name: 'Sarah', color: '#ff8c66' },
  { id: 'marcus', name: 'Marcus', color: '#7974e8' },
  { id: 'jamie', name: 'Jamie', color: '#3aa79a' },
];

export const defaultProfile: Profile = {
  name: 'Alex Tan', handle: '@alextan', initials: 'AT', currency: 'SGD',
};

export function sessionTotal(session: BillSession) {
  return session.items.reduce((sum, item) => sum + item.quantity * item.price, 0) + session.tax + session.serviceCharge - session.discount + (session.roundingAdjustment || 0);
}

export function formatMoney(amount: number, currency = 'SGD') {
  const symbol = currencySymbol(currency);
  const zeroDecimal = ['JPY', 'KRW', 'VND', 'IDR'].includes(currency);
  const value = new Intl.NumberFormat('en-SG', { minimumFractionDigits: zeroDecimal ? 0 : 2, maximumFractionDigits: zeroDecimal ? 0 : 2 }).format(Math.abs(amount));
  const spacing = ['MYR', 'IDR', 'AED'].includes(currency) || symbol === currency ? ' ' : '';
  return `${amount < 0 ? '−' : ''}${symbol}${spacing}${value}`;
}
