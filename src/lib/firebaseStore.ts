import { signInAnonymously } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, where, writeBatch, type Unsubscribe } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, isFirebaseConfigured, storage } from '../firebase';
import type { BillSession, DiningGroup, Notification, Profile } from '../types';

export type CloudSyncState = 'connecting' | 'synced' | 'offline';

interface FirebaseHandlers {
  onProfile: (profile: Profile) => void;
  onSessions: (sessions: BillSession[]) => void;
  onGroups: (groups: DiningGroup[]) => void;
  onNotifications: (notifications: Notification[]) => void;
  onStatus: (status: CloudSyncState, message?: string) => void;
}

let activeUid = '';

function cloudId(uid: string, localId: string) {
  return `${uid}_${localId}`.replace(/[^A-Za-z0-9_-]/g, '_');
}

function profileData(profile: Profile) {
  return {
    name: profile.name,
    handle: profile.handle,
    initials: profile.initials,
    currency: profile.currency,
    paymentQr: profile.paymentQr || null,
    updatedAt: new Date().toISOString(),
  };
}

function sessionData(session: BillSession, uid: string) {
  return { ...session, hostId: uid, participantIds: [uid], updatedAt: new Date().toISOString() };
}

function groupData(group: DiningGroup, uid: string) {
  return { ...group, adminId: uid, memberIds: [uid], updatedAt: new Date().toISOString() };
}

function notificationData(notification: Notification, uid: string) {
  return { ...notification, profileId: uid, updatedAt: new Date().toISOString() };
}

function friendlyFirebaseError(error: unknown) {
  const value = error as { code?: string; message?: string };
  if (value.code === 'auth/operation-not-allowed' || value.code === 'auth/admin-restricted-operation') return 'Enable Anonymous sign-in in Firebase Authentication to activate cloud sync.';
  if (value.code === 'permission-denied' || value.code === 'firestore/permission-denied') return 'Publish the included Firestore rules to the named database to activate cloud sync.';
  if (value.code === 'unavailable' || value.code === 'firestore/unavailable') return 'Firebase is temporarily unreachable. Cloud data cannot be loaded.';
  return value.message || 'Firebase could not connect. Cloud data cannot be loaded.';
}

const demoIds = {
  history: new Set(['session-1', 'session-2', 'session-3', 'session-4']),
  groups: new Set(['g1', 'g2', 'g3']),
  notifications: new Set(['n1', 'n2', 'n3']),
};

async function prepareAccount(uid: string, initialProfile: Profile) {
  if (!db) return;
  const firestore = db;
  const accountRef = doc(firestore, 'profiles', uid);
  const account = await getDoc(accountRef);
  if (account.data()?.demoDataClearedAt) return;

  const [history, groups, notifications] = await Promise.all([
    getDocs(query(collection(firestore, 'history'), where('participantIds', 'array-contains', uid))),
    getDocs(query(collection(firestore, 'groups'), where('memberIds', 'array-contains', uid))),
    getDocs(query(collection(firestore, 'notifications'), where('profileId', '==', uid))),
  ]);
  const batch = writeBatch(firestore);
  history.docs.forEach((entry) => { if (demoIds.history.has(String(entry.data().id))) batch.delete(entry.ref); });
  groups.docs.forEach((entry) => { if (demoIds.groups.has(String(entry.data().id))) batch.delete(entry.ref); });
  notifications.docs.forEach((entry) => { if (demoIds.notifications.has(String(entry.data().id))) batch.delete(entry.ref); });
  const now = new Date().toISOString();
  if (account.exists()) batch.set(accountRef, { demoDataClearedAt: now, updatedAt: now }, { merge: true });
  else batch.set(accountRef, { ...profileData(initialProfile), createdAt: now, demoDataClearedAt: now });
  await batch.commit();
}

export async function connectFirebaseStore(initialProfile: Profile, handlers: FirebaseHandlers): Promise<Unsubscribe> {
  if (!isFirebaseConfigured || !auth || !db) {
    handlers.onStatus('offline', 'Firebase configuration is missing. Cloud data cannot be loaded.');
    return () => undefined;
  }

  handlers.onStatus('connecting');
  try {
    const credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth);
    const uid = credential.user.uid;
    activeUid = uid;
    const accountRef = doc(db, 'profiles', uid);
    await prepareAccount(uid, initialProfile);

    const ready = new Set<string>();
    let failed = false;
    const markReady = (name: string) => {
      ready.add(name);
      if (!failed && ready.size === 4) handlers.onStatus('synced');
    };
    const fail = (error: unknown) => {
      failed = true;
      handlers.onStatus('offline', friendlyFirebaseError(error));
    };

    const unsubscribers = [
      onSnapshot(accountRef, (snapshot) => {
        if (snapshot.exists()) handlers.onProfile(snapshot.data() as Profile);
        markReady('profile');
      }, fail),
      onSnapshot(query(collection(db, 'history'), where('participantIds', 'array-contains', uid)), (snapshot) => {
        const sessions = snapshot.docs.map((entry) => entry.data() as BillSession).sort((a, b) => +new Date(b.date) - +new Date(a.date));
        handlers.onSessions(sessions);
        markReady('history');
      }, fail),
      onSnapshot(query(collection(db, 'groups'), where('memberIds', 'array-contains', uid)), (snapshot) => {
        handlers.onGroups(snapshot.docs.map((entry) => entry.data() as DiningGroup));
        markReady('groups');
      }, fail),
      onSnapshot(query(collection(db, 'notifications'), where('profileId', '==', uid)), (snapshot) => {
        handlers.onNotifications(snapshot.docs.map((entry) => entry.data() as Notification));
        markReady('notifications');
      }, fail),
    ];

    return () => { unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  } catch (error) {
    activeUid = '';
    handlers.onStatus('offline', friendlyFirebaseError(error));
    return () => undefined;
  }
}

async function safeWrite(write: () => Promise<void>) {
  if (!activeUid || !db) return false;
  try { await write(); return true; } catch (error) { console.warn('Firebase write failed.', error); return false; }
}

export function saveCloudProfile(profile: Profile) {
  return safeWrite(() => setDoc(doc(db!, 'profiles', activeUid), profileData(profile), { merge: true }));
}

export function saveCloudSession(session: BillSession) {
  return safeWrite(() => setDoc(doc(db!, 'history', cloudId(activeUid, session.id)), sessionData(session, activeUid), { merge: true }));
}

export function saveCloudGroup(group: DiningGroup) {
  return safeWrite(() => setDoc(doc(db!, 'groups', cloudId(activeUid, group.id)), groupData(group, activeUid), { merge: true }));
}

export function saveCloudNotification(notification: Notification) {
  return safeWrite(() => setDoc(doc(db!, 'notifications', cloudId(activeUid, notification.id)), notificationData(notification, activeUid), { merge: true }));
}

export async function uploadCloudPaymentQr(file: File) {
  if (!activeUid || !storage) return null;
  const extension = file.name.split('.').pop()?.replace(/[^A-Za-z0-9]/g, '') || 'png';
  const objectRef = ref(storage, `profiles/${activeUid}/payment-qr.${extension}`);
  await uploadBytes(objectRef, file, { contentType: file.type || 'image/png' });
  return getDownloadURL(objectRef);
}
