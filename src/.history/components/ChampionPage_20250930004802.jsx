import React, { useEffect, useMemo, useState } from "react";
import { Link, Routes, Route, useParams, useSearchParams, useLocation } from "react-router-dom";
import { PageFade, AnimatedRoutes, MotionTableRow, AnimatedBar, GlowImg, TableSkeleton, SoftCard } from "../animations";
import { useDdragonVersion } from "../hooks/useDdragonVersion";

import { useItemIndex } from "../hooks/useItemIndex";

export default function ChampionPage() {
  const { slug } = useParams();
  const [search, setSearch] = useSearchParams();
  const [meta, setMeta] = useState(null);
  const [data, setData] = useState(null);
  const [patch, setPatch] = useState(search.get("patch") || "");
  const [role, setRole]   = useState(search.get("role")  || "ALL");
  const [loading, setLoading] = useState(true);

  const pct0 = x => (x==null ? "–" : (x*100).toFixed(0)+"%");
  const fmtTime = s => (s==null ? "–" : (s/60).toFixed(1)+"m"); // seconds -> minutes 1dp
  const ddVersion = useDdragonVersion();
  const itemIndex = useItemIndex(ddVersion);
  const CHAMP_HEADER_ICON_SIZE = 60; // try 56–64 if you want bigger
  const displayName = meta?.name || (slug ? slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "");
  const ITEM_ICON_SIZE = 40; // try 28 or 32 if you want larger  
  // --- needed by the JSX below ---
  const pct = (x) => (x == null ? "–" : (x * 100).toFixed(1) + "%");
  const int = (x) =>
    x == null ? "–" : new Intl.NumberFormat().format(Math.round(Number(x)));
  const num = (x, d = 1) =>
    x == null ? "–" : Number(x).toFixed(d);

  // Roles to show as pills (>=5% share); derive from meta first, then fallback to data[patch]
  const rolesOver5 = useMemo(() => {
    const out = [];

    // 1) from meta (if present)
    if (meta?.roles?.length) {
      for (const r of meta.roles) {
        out.push({
          role: r.role,
          pickShare: r.pickShare ?? r.share ?? 0,
        });
      }
    }

    // 2) from data[patch] (fallback / enhance)
    const byRole =
      patch && patch !== "__ALL__" && data?.[patch] ? data[patch] : null;

    if (byRole && typeof byRole === "object") {
      const total = Object.values(byRole).reduce(
        (s, b) => s + (b?.games || 0),
        0
      );
      for (const rKey of Object.keys(byRole)) {
        const share = total ? (byRole[rKey]?.games || 0) / total : 0;
        const i = out.findIndex((x) => x.role === rKey);
        if (i >= 0) {
          if (out[i].pickShare == null) out[i].pickShare = share;
        } else {
          out.push({ role: rKey, pickShare: share });
        }
      }
    }

    // filter + sort
    return out
      .filter((r) => (r.pickShare ?? 0) >= 0.05)
      .sort((a, b) => (b.pickShare ?? 0) - (a.pickShare ?? 0));
  }, [meta, data, patch]);

  const showRoleSwitch = rolesOver5.length > 1;


  // --- Mastery split (Best/Best2/Best3/Top5/BelowTop5) ---
  const MasteryTable = ({ mastery }) => {
    if (!mastery) return null;

    // Column headers (unchanged)
    const headers = [
      ["BestMastery",     "Best"],
      ["Best2Mastery",    "Best 2"],
      ["Best3Mastery",    "Best 3"],
      ["BestTop5Mastery", "Top 5"],
      ["BelowTop5Mastery","Below 5"],
    ];

    const pct0 = (x) => (x == null ? "–" : `${(x * 100).toFixed(0)}%`);
    const pct1 = (x) => (x == null ? "–" : `${(x * 100).toFixed(1)}%`);

    // Totals for shares
    const totalGames = headers.reduce((s, [k]) => s + (mastery?.[k]?.games || 0), 0);

    // "Total mastery" = sum over buckets of (avgChampMasteryPer * games)
    // Note: avgChampMasteryPer is a FRACTION (e.g., 0.050529 for 5.0529%)
    const totalMasteryWeight = headers.reduce((s, [k]) => {
      const m = mastery?.[k];
      const avg = m?.avgChampMasteryPer ?? 0;   // treat missing as 0
      const g   = m?.games || 0;
      return s + avg * g;
    }, 0);

    // Render helper
    // Render helper — return just values, not <td>s
    const cellVals = (renderFn) =>
      headers.map(([key]) => renderFn(mastery?.[key], key)); 

    // column hover state (0..4), null when not hovering
    const [hoveredCol, setHoveredCol] = useState(null);

    // icon/column accent by column index
    const colAccent = (i) => {
      // warm gold for Best, then a subtle gradient through the rest
      return [
        { ring: "ring-amber-400/60", glow: "bg-amber-400/40", text: "text-amber-300" },
        { ring: "ring-violet-400/50", glow: "bg-violet-400/40", text: "text-violet-300" },
        { ring: "ring-sky-400/50",    glow: "bg-sky-400/40",    text: "text-sky-300" },
        { ring: "ring-emerald-400/50",glow: "bg-emerald-400/40",text: "text-emerald-300" },
        { ring: "ring-slate-400/40",  glow: "bg-slate-400/40",  text: "text-slate-300" },
      ][i] || { ring: "ring-slate-400/40", glow: "bg-slate-400/30", text: "text-slate-300" };
    };

    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
        <div className="text-sm font-semibold mb-2">By Player Mastery</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm table-fixed border-collapse">
            <colgroup>
              <col style={{ width: "6rem" }} />
              {[...Array(5)].map((_, i) => <col key={i} />)}
            </colgroup>
          <thead className="text-left text-neutral-300">
            <tr>
              <th scope="col" className="pl-2 pr-1 py-2 align-bottom">By Player Mastery</th>

              {[
                { lvl: 7, label: "Best"   },
                { lvl: 6, label: "Best 2" },
                { lvl: 5, label: "Best 3" },
                { lvl: 4, label: "Top 5"  },
                { lvl: 1, label: "Below 5"},
              ].map((c, i) => {
                const acc = colAccent(i);
                const active = hoveredCol === i;
                return (
                  <th
                    key={c.label}
                    scope="col"
                    className={`p-0 align-bottom transition`}
                    onMouseEnter={() => setHoveredCol(i)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    <div className={`py-2 flex flex-col items-center gap-1 ${active ? "scale-[1.03]" : ""} transition`}>
                      {/* glow + ring around the icon */}
                      <div className="relative">
                        <div className={`absolute -inset-2 rounded-full blur-md ${acc.glow} opacity-20 ${active ? "opacity-80" : ""}`} />
                        <div className={`relative rounded-full ring ${acc.ring} ring-1 p-1`}>
                          <MasteryIcon level={c.lvl} size={50} />
                        </div>
                      </div>
                      <span className={`text-xs ${active ? acc.text : "text-neutral-300"}`}>{c.label}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
            <tbody>
              {/* wr row */}
              <tr className="border-t border-neutral-800">
                <th scope="row" className="pl-2 pr-1 py-1 text-left">WR</th>
                {cellVals((m) => {
                  const g  = m?.games || 0;
                  const wr = (m?.winRate != null) ? m.winRate : (g > 0 && m?.wins != null ? (m.wins / g) : null);
                  return pct1(wr);
                }).map((v, i) => {
                  const active = hoveredCol === i;
                  return (
                    <td key={`wr_${i}`} className={`p-0 ${active ? "bg-neutral-800/60" : ""} transition`}>
                      <div className={`py-1 text-center tabular-nums ${active ? "font-semibold" : ""}`}>{v}</div>
                    </td>
                  );
                })}
              </tr>

              {/* games% row */}
              <tr className="border-t border-neutral-800">
                <th scope="row" className="pl-2 pr-1 py-1 text-left">Games%</th>
                {cellVals((m) => pct0(m?.share)).map((v, i) => {
                const active = hoveredCol === i;
                return (
                  <td key={`gp_${i}`} className={`p-0 ${active ? "bg-neutral-800/60" : ""} transition`}>
                    <div className={`py-1 text-center tabular-nums ${active ? "font-semibold" : ""}`}>{v}</div>
                  </td>
                );
              })}
              </tr>

              {/* mastery% row */}
              <tr className="border-t border-neutral-800">
                <th scope="row" className="pl-2 pr-1 py-1 text-left">Mastery%</th>
                {cellVals((m) => pct0(m?.avgChampMasteryPer)).map((v, i) => {
                  const active = hoveredCol === i;
                  return (
                    <td key={`mp_${i}`} className={`p-0 ${active ? "bg-neutral-800/60" : ""} transition`}>
                      <div className={`py-1 text-center tabular-nums ${active ? "font-semibold" : ""}`}>{v}</div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const ItemTable = ({ title, rows }) => {
  // filter again on the client defensively (in case older JSONs don’t filter)
  const safeRows = Array.isArray(rows) ? rows.filter(r => (r.share ?? 0) >= 0.01) : [];
  const displayName =
  meta?.name ||
  (slug ? slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "");
  if (safeRows.length === 0) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-300">
            <tr>
              <th className="px-2 py-1">Item</th>
              <th className="px-2 py-1 text-right">Games</th>
              <th className="px-2 py-1 text-right">Winrate</th>
            </tr>
          </thead>
          <tbody>
            {safeRows.map((r,i) => {
              const a = r.avg || {};
              const tooltip = [
                `Avg buy time: ${fmtTime(a.time_s)}`,
                `Avg player level: ${a.player_level==null?"–":a.player_level.toFixed(1)}`,
                `Avg level diff (frac): ${a.player_level_diff_frac==null?"–":a.player_level_diff_frac.toFixed(3)}`,
                `Avg player gold diff: ${a.player_gold_dif==null?"–":a.player_gold_dif.toFixed(0)}`,
                `Avg team gold diff: ${a.team_gold_diff==null?"–":a.team_gold_diff.toFixed(0)}`
              ].join("\n");
              return (
                <tr key={i} className="border-t border-neutral-800 hover:bg-neutral-800/60">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-3" title={tooltip}>
                      <ItemIcon
                        name={r.item}
                        version={ddVersion}
                        itemIndex={itemIndex}
                        size={ITEM_ICON_SIZE}
                        className="shrink-0"
                      />
                      <span className="text-[15px]">{r.item}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{r.games?.toLocaleString?.() ?? r.games}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {r.winRate == null ? "–" : `${(r.winRate*100).toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
}