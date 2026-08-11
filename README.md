# PayLah — AI-Powered Bill Splitting

Snap a receipt, share a code, and split bills with zero drama.

PayLah is a responsive React application for scanning receipts with Google Cloud Vision OCR, reviewing line items, sharing a live table, claiming shared dishes, and calculating each person's total with proportional tax and service charges. It also includes searchable history, saved dining groups, notifications, automatic receipt-currency detection, and payment QR uploads.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app includes complete demo data and a local-storage fallback, so the non-scanning flows work without credentials. Receipt recognition uses Google Cloud Vision `DOCUMENT_TEXT_DETECTION`, followed by deterministic rules that identify line-item prices, tax, service charge, totals, and receipt currency. Add `GOOGLE_CLOUD_VISION_API_KEY` to `.env` after enabling the Vision API and billing for that Google Cloud project. Add the `VITE_FIREBASE_*` values to initialise Firebase.

## Firebase

The configured Firebase project uses the named Firestore database `ai-studio-2dfe500f-5b93-4dd5-8f91-ed2f1378f950`. PayLah signs visitors in anonymously, seeds their first profile, and synchronises tables, groups, notifications, and profile changes with real-time listeners. Payment QR images are stored in Firebase Storage.

Before cloud sync can start, enable **Anonymous** under Firebase Console → Authentication → Sign-in method. Then publish [firestore.rules](./firestore.rules) to the named database and [storage.rules](./storage.rules) to Storage. History, groups, and notifications are rendered only from live Firebase snapshots; the app shows “Firebase offline” instead of falling back to demo or locally cached records.

## Commands

```bash
npm run dev       # Express + Vite development server
npm run typecheck # TypeScript validation
npm run build     # Frontend and server production bundles
npm run start     # Production server on port 3000
```

## Stack

React 19, TypeScript, Tailwind CSS 4, Motion, Lucide, Vite, Express, Firebase Firestore, and Google Cloud Vision.

Licensed under the Apache License 2.0.
