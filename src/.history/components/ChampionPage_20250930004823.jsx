import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

export default function ChampionPage() {
  const { slug } = useParams();
  const [search, setSearch] = useSearchParams();

  const [patch, setPatch] = useState(search.get("patch") || "__ALL__");
  const [role, setRole]   = useState(search.get("role")  || "ALL");

  useEffect(() => {
    // keep URL in sync (optional)
    setSearch(prev => {
      const q = new URLSearchParams(prev);
      q.set("patch", patch);
      q.set("role", role);
      return q;
    }, { replace: true });
  }, [patch, role, setSearch]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-2xl font-bold">Champion: {slug}</div>

        {/* Simple controls (placeholder) */}
        <div className="flex items-center gap-2">
          <label className="text-sm">Patch:</label>
          <select
            value={patch}
            onChange={(e) => setPatch(e.target.value)}
            className="bg-neutral-900 text-neutral-100 border border-neutral-700 rounded p-2"
          >
            <option value="__ALL__">All patches</option>
          </select>

          <label className="text-sm ml-4">Role:</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-neutral-900 text-neutral-100 border border-neutral-700 rounded p-2"
          >
            <option value="ALL">ALL</option>
            <option value="TOP">TOP</option>
            <option value="JUNGLE">JUNGLE</option>
            <option value="MIDDLE">MIDDLE</option>
            <option value="BOTTOM">BOTTOM</option>
            <option value="UTILITY">UTILITY</option>
          </select>
        </div>

        <div className="text-sm text-neutral-400">
          Page wiring OK — replace this with your real content once everything compiles.
        </div>
      </div>
    </div>
  );
}