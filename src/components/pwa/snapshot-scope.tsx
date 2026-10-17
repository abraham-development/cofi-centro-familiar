"use client";

import { useEffect } from "react";

import { clearSnapshot, readSnapshot, snapshotKey } from "@/lib/pwa/snapshot";

/** Clear a previous family's copy even when switching outside the home page. */
export function SnapshotScope({ identity, familyId }: { identity: string; familyId: string }) {
  useEffect(() => {
    try {
      const saved = readSnapshot(localStorage.getItem(snapshotKey("adult")), Date.now());
      if (saved && (saved.identity !== identity || saved.familyId !== familyId)) clearSnapshot("adult");
    } catch { /* Storage unavailable. */ }
  }, [identity, familyId]);
  return null;
}
