// Service history is the OWNER's own data (what they did, when, at what
// mileage) — not curated reference content, so it doesn't belong in
// src/data/*.ts alongside vehicle specs and guides. For now it lives in the
// browser's localStorage (see src/lib/serviceHistory.ts); the shape below is
// designed to move into a real per-user database untouched once accounts
// exist — swap the storage layer, keep this type and the UI.

export interface ServiceEntry {
  id: string;
  date: string; // yyyy-mm-dd
  mileage: number;
  title: string; // e.g. "Engine Oil & Filter Change" or a custom description
  guideId?: string; // set when the entry was picked from this vehicle's guide list
  notes?: string;
  loggedAt: string; // ISO timestamp, when the entry was saved
}
