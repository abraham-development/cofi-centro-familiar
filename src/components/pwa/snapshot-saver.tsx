"use client";

import { useEffect } from "react";

import { type OfflineSnapshot, readSnapshot, snapshotKey } from "@/lib/pwa/snapshot";

/** Receives only the small projection produced after server authorization. */
export function SnapshotSaver({ snapshot }: { snapshot: OfflineSnapshot }) {
  useEffect(() => {
    if (!navigator.onLine) return;
    try {
      // A delayed render from a previous request must not replace fresher data.
      const key = snapshotKey(snapshot.actor);
      const previous = readSnapshot(localStorage.getItem(key), Date.now());
      if (previous?.identity === snapshot.identity && previous.familyId === snapshot.familyId && previous.savedAt > snapshot.savedAt) return;
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch { /* The live app still works with blocked or full storage. */ }
  }, [snapshot]);
  return null;
}
