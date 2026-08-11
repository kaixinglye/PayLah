export type Tab = 'home' | 'history' | 'groups' | 'profile';
export type SessionStatus = 'active' | 'settled';

export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface BillItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  claimedBy: string[];
  claimedQuantities?: Record<string, number>;
}

export interface BillSession {
  id: string;
  code: string;
  name: string;
  venue: string;
  date: string;
  currency: string;
  status: SessionStatus;
  items: BillItem[];
  people: Person[];
  tax: number;
  serviceCharge: number;
  discount: number;
  roundingAdjustment?: number;
}

export interface DiningGroup {
  id: string;
  name: string;
  emoji: string;
  members: Person[];
  lastActive: string;
  totalSplits: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  type: 'join' | 'payment' | 'system';
}

export interface Profile {
  name: string;
  handle: string;
  initials: string;
  currency: string;
  paymentQr?: string;
}
