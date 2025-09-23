import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useParams, useSearchParams } from "react-router-dom";
import {
  ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell
} from "recharts";

const BASE = import.meta.env.BASE_URL; // "/" in dev, "/StatCheck/" on GitHub Pages

const fmtPct = x => (x == null ? "–" : (x * 100).toFixed(2) + "%");
const fmt1 = x => (x == null ? "–" : Number(x).toFixed(1));
const fmt2 = x => (x == null ? "–" : Number(x).toFixed(2));
const fmt4 = x => (x == null ? "–" : Number(x).toFixed(4));
const fmtInt = n => (n == null ? "–" : new Intl.NumberFormat().format(n));

const prettySpell = (s) => {
  if (!s) return "–";
  const m = {
    flash: "Flash", ignite: "Ignite", teleport: "Teleport", tp: "Teleport",
    ghost: "Ghost", cleanse: "Cleanse", barrier: "Barrier",
    heal: "Heal", exhaust: "Exhaust", smite: "Smite"
  };
  const k = String(s).toLowerCase().trim();
  return m[k] || s;
};

// ---- DDragon helpers (icons) ----
const DDRAGON_VER_FALLBACK = "15.18.1";
const MF_ICON =
  "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png";

// --- Champion ID mapping (very forgiving) ---
const CHAMP_ID_EXCEPT = {
  "Aurelion Sol": "AurelionSol",
  "Bel'Veth": "Belveth",
  "Cho'Gath": "Chogath",
  "Dr. Mundo": "DrMundo",
  "Jarvan IV": "JarvanIV",
  "Kai'Sa": "Kaisa",   // straight apostrophe
  "Kai’Sa": "Kaisa",   // curly apostrophe
  "Kha'Zix": "Khazix",
  "Kha’Zix": "Khazix",
  "LeBlanc": "Leblanc",
  "Lee Sin": "LeeSin",
  "Master Yi": "MasterYi",
  "Miss Fortune": "MissFortune",
  "Nunu & Willump": "Nunu",
  "Renata Glasc": "Renata",
  "Tahm Kench": "TahmKench",
  "Twisted Fate": "TwistedFate",
  "Vel'Koz": "Velkoz",
  "Vel’Koz": "Velkoz",
  "Wukong": "MonkeyKing",
  "Xin Zhao": "XinZhao",
  "Kog'Maw": "KogMaw",
  "Kog’Maw": "KogMaw",
};

const normName = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// Champion name → DDragon file id (best-effort)
function toDdragonChampId(name) {
  if (!name) return "Aatrox";
  const trimmed = String(name).trim();

  // known exceptions first
  if (CHAMP_ID_EXCEPT[trimmed]) return CHAMP_ID_EXCEPT[trimmed];

  // normalize: remove accents & punctuation, TitleCase then strip spaces
  let s = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")      // accents
    .replace(/['’`´.]/g, "")              // quotes/periods
    .replace(/[^A-Za-z0-9 ]+/g, " ");     // other punct to space
  s = s.replace(/\b(\w)/g, (_, c) => c.toUpperCase()).replace(/\s+/g, "");
  return s || "Aatrox";
}

// Get latest DDragon version (cached), fallback if offline
function useDdragonVersion() {
  const [ver, setVer] = useState(null);
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", { cache: "no-store" });
        const arr = await res.json();
        if (!ignore) setVer(arr?.[0] || DDRAGON_VER_FALLBACK);
      } catch {
        if (!ignore) setVer(DDRAGON_VER_FALLBACK);
      }
    })();
    return () => { ignore = true; };
  }, []);
  return ver || DDRAGON_VER_FALLBACK;
}



// <ChampionIcon name="Aatrox" version={ver} />
function ChampionIcon({ name, version, size = 20, className = "" }) {
  const [ver, setVer] = useState(version || DDRAGON_VER_FALLBACK);
  const [triedFallback, setTriedFallback] = useState(false);

  const id = toDdragonChampId(name);
  const src = `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${id}.png`;

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`rounded ${className}`}
      loading="lazy"
      onError={() => {
        // If current version 404s, fall back to a known-good one and log the URL
        if (!triedFallback && ver !== DDRAGON_VER_FALLBACK) {
          console.warn("ChampionIcon 404, falling back:", src);
          setVer(DDRAGON_VER_FALLBACK);
          setTriedFallback(true);
        } else {
          console.error("ChampionIcon failed for", name, "URL:", src);
        }
      }}
      title={name}
    />
  );
}

// Map normalized item name → numeric id (e.g. "platedsteelcaps" -> "3047")
function useItemIndex(version) {
  const [idx, setIdx] = useState(null);
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`, { cache: "force-cache" });
        const json = await res.json();
        const map = new Map();
        for (const [id, it] of Object.entries(json?.data || {})) {
          const key = normName(it?.name || "");
          if (key && !map.has(key)) map.set(key, id);
        }
        map.set("boots", "1001"); // Tier-1 "Boots"
        setIdx(map);
      } catch {
        if (!ignore) setIdx(null);
      }
    })();
    return () => { ignore = true; };
  }, [version]);
  return idx;
}

// <ItemIcon name="Plated Steelcaps" version={ver} itemIndex={idx} />
function ItemIcon({ name, version, itemIndex, size = 20, className = "" }) {
  if (!name) return null;
  const key = normName(name);
  if (key === "magicalfootwear") {
    return <img src={MF_ICON} alt="" width={size} height={size} className={className} loading="lazy" />;
  }
  if (key === "noboots") {
    return <div className={`w-[${size}px] h-[${size}px] rounded bg-neutral-800 grid place-items-center text-[10px] text-neutral-300 ${className}`}>—</div>;
  }
  const id = itemIndex?.get(key);
  if (id) {
    const src = `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`;
    return <img src={src} alt="" width={size} height={size} className={`rounded ${className}`} loading="lazy" />;
  }
  const initials = name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return <div className={`w-[${size}px] h-[${size}px] rounded bg-neutral-800 grid place-items-center text-[10px] text-neutral-300 ${className}`}>{initials}</div>;
}


async function getJSON(path, fallback) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    return await res.json();
  } catch (e) {
    console.warn("JSON load failed:", e);
    return fallback;
  }
}

function Card({ label, value, dark = false }) {
  const box =
    dark
      ? "bg-neutral-900 border border-neutral-800 text-neutral-100"
      : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800";
  const labelCls = dark ? "text-neutral-400" : "text-neutral-500 dark:text-neutral-400";
  const valueCls = dark ? "text-neutral-50" : "";
  return (
    <div className={`${box} rounded p-4 shadow-sm`}>
      <div className={`text-sm ${labelCls}`}>{label}</div>
      <div className={`text-2xl font-bold ${valueCls}`}>{value}</div>
    </div>
  );
}

function Chart({title, children}) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded p-3 shadow-sm h-64">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="h-[calc(100%-1.5rem)]">{children}</div>
    </div>
  );
}

function LeaderboardTable({ rows }) {
  // Ban% fix: divide source value by 10 before turning to %
  const fmtBan   = x => (x == null ? "–" : ((x / 10) * 100).toFixed(2) + "%");
  const fmtPick  = x => (x == null ? "–" : (x * 100).toFixed(2) + "%");
  const fmtKDA   = x => (x == null ? "–" : (x * 10).toFixed(2));
  const fmt1     = x => (x == null ? "–" : Number(x).toFixed(1));
  const fmt2     = x => (x == null ? "–" : Number(x).toFixed(2));
  const fmtInt   = n => (n == null ? "–" : new Intl.NumberFormat().format(n));
  const fmtCS10  = x => (x == null ? "–" : Number(x).toFixed(2));
  const fmtCSD10 = x => (x == null ? "–" : Number(x).toFixed(2));
  const ddVersion = useDdragonVersion();
  const CHAMP_ICON_SIZE = 40; // try 28–32

  const gradeFromIdx = (idx = 0) => {
  if (idx >= 90) return "S";
  if (idx >= 75) return "A";
  if (idx >= 60) return "B";
  if (idx >= 40) return "C";
  return "D";
  };
  const gradeClass = (g) => ({
    S: "bg-emerald-900/30 border-emerald-700 text-emerald-300",
    A: "bg-blue-900/30 border-blue-700 text-blue-300",
    B: "bg-indigo-900/30 border-indigo-700 text-indigo-300",
    C: "bg-amber-900/30 border-amber-700 text-amber-300",
    D: "bg-rose-900/30 border-rose-700 text-rose-300",
  }[g] || "bg-neutral-800 border-neutral-700 text-neutral-200");

  const COLUMNS = [
  { key: "tier", label: "Tier", align: "left", accessor: r => r.score, // sort by EB score
    render: r => {
      const g = gradeFromIdx(r.scoreIdx);
      return (
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded border ${gradeClass(g)}`}>{g}</span>
          <div className="w-20 h-2 rounded bg-neutral-800 overflow-hidden">
            <div
              className="h-2 bg-blue-500"
              style={{ width: `${Math.max(0, Math.min(100, r.scoreIdx ?? 0))}%` }}
            />
          </div>
          {(() => {
            const idx = Math.max(0, Math.min(100, r.scoreIdx ?? 0));
            return (
              <span
                className="text-xs px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200"
                title="Games-weighted rank (0–100). Higher = better; heavily favors more games."
              >
                TierScore {idx}
              </span>
            );
          })()}
        </div>
      );
    },
    sortable: true
  },
    { key: "champ", label: "Champion", align: "left", accessor: r => r.champion,
      render: r => (
        <Link
          className="text-blue-600 hover:underline"
          to={`/champions/${r.championSlug || r.champion?.toLowerCase?.().replace(/[^a-z0-9]+/g,"")}`}
        >
          <span className="inline-flex items-center gap-3">
            <ChampionIcon name={r.champion} version={ddVersion} size={CHAMP_ICON_SIZE} className="shrink-0" />
            <span className="text-[15px]">{r.champion}</span>
          </span>
        </Link>
      ),
    },
    { key: "games", label: "Games", align: "right", accessor: r => r.games, render: r => fmtInt(r.games), sortable: true  },
    { key: "win",   label: "Win%",  align: "right", accessor: r => r.winRate, render: r => fmtPct(r.winRate), sortable: true  },
    { key: "pick",  label: "Pick%", align: "right", accessor: r => r.pickRate, render: r => fmtPick(r.pickRate), sortable: true },
    { key: "uban",  label: "Unique Ban%", align: "right", accessor: r => r.banRateUnique, render: r => fmtBan(r.banRateUnique), sortable: true  },
    { key: "ban",   label: "Ban%",        align: "right", accessor: r => r.banRate,        render: r => fmtBan(r.banRate),        sortable: true  },       
    { key: "kda",   label: "KDA",   align: "right", accessor: r => r.kdaAvg,           render: r => fmtKDA(r.kdaAvg),             sortable: true  },
    { key: "gd5",   label: "GD@5",  align: "right", accessor: r => r.goldDiffAt5Avg,   render: r => fmt1(r.goldDiffAt5Avg),       sortable: true  },
    { key: "gd10",  label: "GD@10", align: "right", accessor: r => r.goldDiffAt10Avg,  render: r => fmt1(r.goldDiffAt10Avg),      sortable: true  },
    { key: "cs10",  label: "CS@10", align: "right", accessor: r => r.csAt10Avg,        render: r => fmtCS10(r.csAt10Avg),         sortable: true  },
    { key: "csd10", label: "CSD@10",align: "right", accessor: r => r.csDiffAt10Avg,    render: r => fmtCSD10(r.csDiffAt10Avg),    sortable: true  },
    { key: "dpm",   label: "DPM",   align: "right", accessor: r => r.dpmAvg,           render: r => fmt1(r.dpmAvg),               sortable: true  },
    { key: "kp",    label: "KP",    align: "right", accessor: r => r.kpAvg,            render: r => fmtPct(r.kpAvg),              sortable: true  },
  ];

  const [sortKey, setSortKey] = useState("pick");
  const [sortDir, setSortDir] = useState("desc");

  const sortedRows = useMemo(() => {
    const col = COLUMNS.find(c => c.key === sortKey);
    if (!col) return rows || [];
    const arr = [...(rows || [])];
    arr.sort((a,b) => {
      const A = col.accessor(a, 0);
      const B = col.accessor(b, 0);
      if (A == null && B == null) return 0;
      if (A == null) return 1;
      if (B == null) return -1;
      if (A < B) return sortDir === "asc" ? -1 : 1;
      if (A > B) return sortDir === "asc" ? 1  : -1;
      if (a.games !== b.games) return sortDir === "asc" ? (a.games - b.games) : (b.games - a.games);
      return (a.champion || "").localeCompare(b.champion || "");
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const onSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortIcon = (key) => (key !== sortKey ? <span className="opacity-30">↕</span> : (sortDir === "asc" ? <span>▲</span> : <span>▼</span>));

  return (
    <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-800/50">
          <tr className="text-left">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={`px-3 py-2 font-medium select-none ${c.align === "right" ? "text-right" : ""} ${c.sortable ? "cursor-pointer hover:underline" : ""}`}
                onClick={c.sortable ? () => onSort(c.key) : undefined}
                title={c.sortable ? "Click to sort" : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label} {c.sortable && sortIcon(c.key)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r, i) => (
            <tr
              key={r.champion + "_" + i}
              className="border-t border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            >
              {COLUMNS.map((c) => (
                <td key={c.key} className={`px-3 py-2 tabular-nums ${c.align === "right" ? "text-right" : ""}`}>
                  {c.render ? c.render(r, i) : (r[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChampionPage() {
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
  const toPct = (x) => x == null ? "–" : `${(x*100).toFixed(1)}%`;

  // --- Mastery split (Best/Best2/Best3/Top5/BelowTop5) ---
  const MasteryTable = ({ mastery, totalGames }) => {
    if (!mastery) return null;

    const headers = [
      ["BestMastery",     "Best Mastery"],
      ["Best2Mastery",    "Best 2 Mastery"],
      ["Best3Mastery",    "Best 3 Mastery"],
      ["BestTop5Mastery", "Best Top 5 Mastery"],
      ["BelowTop5Mastery","Below Top 5 Mastery"],
    ];

    const toPct0 = (x) => x == null ? "–" : `${(x*100).toFixed(0)}%`;
    const toPct1 = (x) => x == null ? "–" : `${(x*100).toFixed(1)}%`;

    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
        <div className="text-sm font-semibold mb-2">By Player Mastery</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-neutral-300">
              <tr>
                {headers.map(([key, label]) => (
                  <th key={key} className="px-2 py-1">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Winrate row */}
              <tr className="border-t border-neutral-800">
                {headers.map(([key]) => (
                  <td key={key} className="px-2 py-1 tabular-nums">
                    {toPct1(mastery?.[key]?.winRate)}
                  </td>
                ))}
              </tr>
              {/* Share row */}
              <tr className="border-t border-neutral-800">
                {headers.map(([key]) => (
                  <td key={key} className="px-2 py-1 tabular-nums">
                    {toPct0(mastery?.[key]?.share)}
                    {typeof mastery?.[key]?.games === "number" && (
                      <span className="opacity-60"> · {new Intl.NumberFormat().format(mastery[key].games)} games</span>
                    )}
                  </td>
                ))}
              </tr>
              {/* Avg ChampMasteryPer row (not shown for BelowTop5Mastery) */}
              <tr className="border-t border-neutral-800">
                {headers.map(([key]) => (
                  <td key={key} className="px-2 py-1 tabular-nums">
                    {key === "BelowTop5Mastery"
                      ? "–"
                      : (mastery?.[key]?.avgChampMasteryPer == null
                          ? "–"
                          : Number(mastery[key].avgChampMasteryPer).toFixed(0))}
                  </td>
                ))}
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

function MatchupTable({ title, rows }) {
  const int = (x) => (x==null ? "–" : new Intl.NumberFormat().format(Math.round(x)));
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
      <div className="text-sm font-semibold mb-2">{title}</div>
      {Array.isArray(rows) && rows.length ? (
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-300">
            <tr>
              <th className="px-2 py-1">Opponent</th>
              <th className="px-2 py-1 text-right">Games</th>
              <th className="px-2 py-1 text-right">Tier</th>
              <th className="px-2 py-1 text-right">Winrate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={i} className="border-t border-neutral-800">
                <td className="px-2 py-1">
                  <div className="flex items-center gap-2">
                    <ChampionIcon name={m.enemy} version={ddVersion} size={36} />
                    <span>{m.enemy}</span>
                  </div>
                </td>
                <td className="px-2 py-1 text-right tabular-nums">{int(m.games)}</td>
                 <td className="px-2 py-1 text-right">
                   <span className={`text-xs px-2 py-0.5 rounded border ${
                     (m.vsIdx >= 90) ? "bg-emerald-900/30 border-emerald-700 text-emerald-300" :
                     (m.vsIdx >= 75) ? "bg-blue-900/30 border-blue-700 text-blue-300" :
                     (m.vsIdx >= 60) ? "bg-indigo-900/30 border-indigo-700 text-indigo-300" :
                     (m.vsIdx >= 40) ? "bg-amber-900/30 border-amber-700 text-amber-300" :
                                       "bg-rose-900/30 border-rose-700 text-rose-300"
                   }`}>
                     {m.vsIdx >= 90 ? "S" : m.vsIdx >= 75 ? "A" : m.vsIdx >= 60 ? "B" : m.vsIdx >= 40 ? "C" : "D"}
                   </span>
                 </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {m.games ? ((m.wins / m.games) * 100).toFixed(1) + "%" : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-sm opacity-70">No matchup data.</div>
      )}
    </div>
  );
}

const LegendaryTables = ({ data }) => {
  if (!Array.isArray(data) || data.length === 0) return null;

  const slotTitle = (slotIdx) => {
  if (slotIdx === 1) return "First Item";
  if (slotIdx === 2) return "Second Item";
  if (slotIdx === 3) return "Third Item";
  if (slotIdx === 4) return "Fourth Item";
  if (slotIdx === 5) return "Fifth Item";
  if (slotIdx === 6) return "Sixth Item";
  return `Legendary – Slot ${slotIdx}`;
};

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.map((slot, si) => (
        <ItemTable key={si} title={slotTitle(slot.slot)} rows={slot.options || []} />
      ))}
    </div>
  );
};

function combineAcrossPatches(allData, role) {
  if (!allData) return null;

  const acc = {
    games: 0, wins: 0,
    avgGameLengthMin_sum: 0,
    avgKills_sum: 0, avgDeaths_sum: 0, avgAssists_sum: 0,
    avgGoldDiffAt5_sum: 0, avgGoldDiffAt10_sum: 0,
    avgCsAt10_sum: 0, avgCsDiffAt10_sum: 0, avgDPM_sum: 0, avgKP_sum: 0,
    teamFBTowerRate_num: 0, teamFBTowerRate_den: 0,
    opponents: {},
    mastery: {
      BestMastery:       { games: 0, wins: 0, sum: 0, cnt: 0 },
      Best2Mastery:      { games: 0, wins: 0, sum: 0, cnt: 0 },
      Best3Mastery:      { games: 0, wins: 0, sum: 0, cnt: 0 },
      BestTop5Mastery:   { games: 0, wins: 0, sum: 0, cnt: 0 },
      BelowTop5Mastery:  { games: 0, wins: 0, sum: 0, cnt: 0 }, // sum/cnt unused
    },
    shardsGrid: [ {}, {}, {} ],
    summonerCombos: {},
    items: { starter:{}, support:{}, boots:{}, footwear_games:0, footwear_sum_time:0, first10:{}, legendary:[] }
  };

  const sum = (a,b)=> (a||0)+(b||0);

  for (const p of Object.keys(allData)) {
    const r = allData[p]?.[role];
    if (!r) continue;

    const g = r.games || 0;
    const w = r.wins  || 0;
    acc.games += g; acc.wins += w;

    const addW = (key, val)=> { if (val!=null) acc[key] += val*g; };
    addW("avgGameLengthMin_sum", r.avgGameLengthMin);
    addW("avgKills_sum", r.avgKills);
    addW("avgDeaths_sum", r.avgDeaths);
    addW("avgAssists_sum", r.avgAssists);
    addW("avgGoldDiffAt5_sum", r.avgGoldDiffAt5);
    addW("avgGoldDiffAt10_sum", r.avgGoldDiffAt10);
    addW("avgCsAt10_sum", r.avgCsAt10);
    addW("avgCsDiffAt10_sum", r.avgCsDiffAt10);
    addW("avgDPM_sum", r.avgDPM);
    addW("avgKP_sum", r.avgKP);
    if (r.teamFBTowerRate!=null && g) { acc.teamFBTowerRate_num += r.teamFBTowerRate*g; acc.teamFBTowerRate_den += g; }

    // mastery buckets
    if (pr.mastery) {
      for (const key of Object.keys(acc.mastery)) {
        const mm = pr.mastery[key];
        if (!mm) continue;
        const g = mm.games || 0;
        const wr = mm.winRate == null ? null : Number(mm.winRate);
        const avg = m.avgChampMasteryPer == null ? "–" : m.avgChampMasteryPer.toFixed(1)

        acc.mastery[key].games += g;
        if (wr != null) acc.mastery[key].wins += Math.round(wr * g);
        if (avg != null && g > 0) { acc.mastery[key].sumAvg += avg * g; acc.mastery[key].denAvg += g; }
      }
    }
    // Opponents (games + wins)
    (r.opponents || []).forEach(o => {
      const name = o.opponentChamp;
      const cur = acc.opponents[name] || { games: 0, wins: 0 };
      cur.games += o.games || 0;
      // prefer explicit wins; else infer from winRate*games
      cur.wins  += (o.wins != null) ? o.wins : Math.round((o.winRate || 0) * (o.games || 0));
      acc.opponents[name] = cur;
    });

    // Shards
    (r.shardsGrid||[]).forEach((slot,si)=>{
      (slot.options||[]).forEach(opt=>{
        const cur = acc.shardsGrid[si][opt.name] || {games:0,wins:0};
        cur.games += opt.games||0;
        if (opt.winRate!=null) cur.wins += Math.round((opt.winRate||0)*(opt.games||0));
        acc.shardsGrid[si][opt.name] = cur;
      });
    });

    // Summoner combos
    (r.summonerCombosTop||[]).forEach(c=>{
      const key = (c.spells||[]).join("|");
      if (!key) return;
      const obj = acc.summonerCombos[key] || {games:0,wins:0,sumUses:[]};
      const g2 = c.games||0;
      obj.games += g2;
      if (c.winRate!=null) obj.wins += Math.round(c.winRate*g2);
      (c.avgUses||[]).forEach((u,i)=>{ obj.sumUses[i]=(obj.sumUses[i]||0)+(u||0)*g2; });
      acc.summonerCombos[key]=obj;
    });

    // Items
    const I = r.items||{};
    const bump = (map,row)=>{
      const cur = map[row.item] || {games:0,wins:0,avg:{time_s:0,player_level:0,player_level_diff_frac:0,player_gold_dif:0,team_gold_diff:0}};
      const g3 = row.games||0;
      cur.games += g3;
      if (row.winRate!=null) cur.wins += Math.round(row.winRate*g3);
      if (row.avg){
        cur.avg.time_s += (row.avg.time_s||0)*g3;
        cur.avg.player_level += (row.avg.player_level||0)*g3;
        cur.avg.player_level_diff_frac += (row.avg.player_level_diff_frac||0)*g3;
        cur.avg.player_gold_dif += (row.avg.player_gold_dif||0)*g3;
        cur.avg.team_gold_diff += (row.avg.team_gold_diff||0)*g3;
      }
      map[row.item]=cur;
    };

    (I.starter||[]).forEach(rw=>bump(acc.items.starter,rw));
    (I.support||[]).forEach(rw=>bump(acc.items.support,rw));
    (I.boots?.options||[]).forEach(rw=>bump(acc.items.boots,rw));
    if (I.boots?.footwear){
      const shareG = Math.round((I.boots.footwear.share||0)*g);
      acc.items.footwear_games += shareG;
      acc.items.footwear_sum_time += (I.boots.footwear.avg_time_s||0)*shareG;
    }
    (I.first10||[]).forEach(rw=>bump(acc.items.first10,rw));
    (I.legendary||[]).forEach((slot,si)=>{
      if (!acc.items.legendary[si]) acc.items.legendary[si]={};
      (slot.options||[]).forEach(rw=>bump(acc.items.legendary[si],rw));
    });
  }

  const toRows = (map,total)=> Object.entries(map).map(([item,v])=>{
    const g=v.games||0, wr=g? v.wins/g : null;
    const avg=v.avg?{
      time_s: g? v.avg.time_s/g : null,
      player_level: g? v.avg.player_level/g : null,
      player_level_diff_frac: g? v.avg.player_level_diff_frac/g : null,
      player_gold_dif: g? v.avg.player_gold_dif/g : null,
      team_gold_diff: g? v.avg.team_gold_diff/g : null,
    }:undefined;
    const share = total? g/total : 0;
    return { item, games:g, share, winRate:wr, avg };
  }).filter(r=> (r.share??0) >= 0.01).sort((a,b)=> b.games-a.games);

  const shardsGrid = acc.shardsGrid.map(slotMap=>{
    const options = Object.entries(slotMap).map(([name,v])=>{
      const g=v.games||0; return {name, games:g, winRate: g? v.wins/g:null};
    }).sort((a,b)=> b.games-a.games);
    return { options };
  });

  const opponentsList = Object.entries(acc.opponents).map(([name, v]) => ({
    opponentChamp: name,
    games: v.games,
    wins: v.wins,
    winRate: v.games ? v.wins / v.games : null,
  }));

  const combos = Object.entries(acc.summonerCombos).map(([key,v])=>{
    const games=v.games||0, winRate=games? v.wins/games:null;
    const spells=key.split("|").filter(Boolean);
    const avgUses=v.sumUses.map(u=> games? u/games:null);
    return { spells, games, winRate, avgUses };
  }).sort((a,b)=> b.games-a.games).slice(0,5);

  return {
    games: acc.games,
    wins: acc.wins,
    winRate: acc.games? acc.wins/acc.games : null,
    avgGameLengthMin: acc.games? acc.avgGameLengthMin_sum/acc.games : null,
    avgKills:         acc.games? acc.avgKills_sum/acc.games : null,
    avgDeaths:        acc.games? acc.avgDeaths_sum/acc.games : null,
    avgAssists:       acc.games? acc.avgAssists_sum/acc.games : null,
    avgGoldDiffAt5:   acc.games? acc.avgGoldDiffAt5_sum/acc.games : null,
    avgGoldDiffAt10:  acc.games? acc.avgGoldDiffAt10_sum/acc.games : null,
    avgCsAt10:        acc.games? acc.avgCsAt10_sum/acc.games : null,
    avgCsDiffAt10:    acc.games? acc.avgCsDiffAt10_sum/acc.games : null,
    avgDPM:           acc.games? acc.avgDPM_sum/acc.games : null,
    avgKP:            acc.games? acc.avgKP_sum/acc.games : null,
    teamFBTowerRate:  acc.teamFBTowerRate_den ? acc.teamFBTowerRate_num/acc.teamFBTowerRate_den : null,
    opponents: opponentsList,
    shardsGrid,
    mastery: (() => {
      const out = {};
      const totalG = acc.games || 0;
      for (const key of Object.keys(acc.mastery)) {
        const m = acc.mastery[key];
        const g = m.games || 0;
        const w = m.wins || 0;
        out[key] = {
          games: g,
          share: totalG ? g / totalG : 0,
          winRate: g ? w / g : null,
          // no average for BelowTop5Mastery (will render as "–")
          ...(key === "BelowTop5Mastery"
            ? {}
            : { avgChampMasteryPer: (m.denAvg ? (m.sumAvg / m.denAvg) : null) })
        };
      }
      return out;
    })(),
    summonerCombosTop: combos,
    items: {
      starter: toRows(acc.items.starter, acc.games),
      support: toRows(acc.items.support, acc.games),
      boots: {
        options: toRows(acc.items.boots, acc.games),
        footwear: acc.items.footwear_games>0 ? {
          share: acc.games? acc.items.footwear_games/acc.games : 0,
          avg_time_s: acc.items.footwear_games? acc.items.footwear_sum_time/acc.items.footwear_games : null
        } : null
      },
      first10: toRows(acc.items.first10, acc.games),
      legendary: (acc.items.legendary||[]).map((m,i)=>({
        slot: i+1,
        options: toRows(m, acc.games)
      }))
    }
  };
}

  useEffect(() => {
    (async () => {
      setLoading(true);
      const j = await getJSON(`${BASE}data/champions/${slug}.json`, null);
      setMeta(j?.meta || null);
      setData(j?.data || null);
      const p = search.get("patch") || (j?.meta?.patches?.[0] || "");
      const r = search.get("role")  || ((j?.meta?.roles || [])[0]?.role || "ALL");
      setPatch(p); setRole(r);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    const next = new URLSearchParams(search);
    if (patch) next.set("patch", patch);
    if (role)  next.set("role",  role);
    setSearch(next, { replace: true });
  }, [patch, role]);

  const cur = useMemo(() => {
    if (!data) return null;
    if (patch === "__ALL__") return combineAcrossPatches(data, role);
    return data[patch]?.[role] || null;
  }, [data, patch, role]);

  // --- MATCHUPS: compute EB score (heavily games-weighted) ---
  function matchupScore(wins, games, prior = (cur?.winRate ?? 0.5), K = 800) {
    const alpha = prior * K, beta = (1 - prior) * K;
    return (wins + alpha) / (games + alpha + beta);
  }

  // require real opponent data; skip if we don't have wins nor winRate
  const rawOpp = Array.isArray(cur?.opponents) ? cur.opponents : [];

  // normalize rows and compute score
  const scoredOpp = rawOpp
    .filter(o => o && o.opponentChamp && (o.games || 0) > 0 && (o.wins != null || o.winRate != null))
    .map(o => {
      const games = o.games || 0;
      const wins  = (o.wins != null) ? o.wins : Math.round((o.winRate || 0) * games);
      const wr    = games ? wins / games : null;         // observed WR for display
      const score = matchupScore(wins, games, cur?.winRate ?? 0.5, 800);
      return { enemy: o.opponentChamp, games, wins, winRate: wr, vsScore: score };
    });

  // build a 0..100 index to grade
  const sMin = Math.min(...scoredOpp.map(x => x.vsScore));
  const sMax = Math.max(...scoredOpp.map(x => x.vsScore));
  const span = (isFinite(sMin) && isFinite(sMax) && sMax > sMin) ? (sMax - sMin) : 1;

  const withIdx = scoredOpp.map(x => ({
    ...x,
    vsIdx: Math.round(100 * (x.vsScore - sMin) / span)
  }));

  // grading like the leaderboard
  const gradeFromIdx = (idx = 0) => {
    if (idx >= 90) return "S";
    if (idx >= 75) return "A";
    if (idx >= 60) return "B";
    if (idx >= 40) return "C";
    return "D";
  };

  // order: Best by score desc; Worst by score asc
  const best10  = [...withIdx].sort((a,b) => (b.vsScore - a.vsScore) || (b.games - a.games)).slice(0, 10);
  const MIN_WORST_GAMES = Math.max(10, Math.round(0.02 * (cur?.games || 0))); // 2% of champ games, at least 10

  const worstSorted = [...withIdx].sort(
    (a,b) => (a.vsScore - b.vsScore) || (b.games - a.games)
  );

  // first take rows with enough games
  let worst10 = worstSorted.filter(r => (r.games || 0) >= MIN_WORST_GAMES).slice(0, 10);

  // if we didn’t get 10 yet, relax the floor gradually (keeps order by EB score)
  if (worst10.length < 10) {
    const half = Math.max(5, Math.floor(MIN_WORST_GAMES / 2));
    const add = worstSorted.filter(r => (r.games || 0) >= half && !worst10.includes(r))
                          .slice(0, 10 - worst10.length);
    worst10 = worst10.concat(add);
  }
  if (worst10.length < 10) {
    const add = worstSorted.filter(r => !worst10.includes(r))
                          .slice(0, 10 - worst10.length);
    worst10 = worst10.concat(add);
  }
  const pct = (x) => (x==null ? "–" : (x*100).toFixed(2)+"%");
  const num = (x, d=2) => (x==null ? "–" : Number(x).toFixed(d));
  const int = (x) => (x==null ? "–" : new Intl.NumberFormat().format(Math.round(x)));

  const rolesOver5 = (meta?.roles || []).filter(r => (r.pickShare || 0) >= 0.05);
  const showRoleSwitch = rolesOver5.length >= 1 && (meta?.roles || []).length > 1;

  // helper to render shard grid (3 columns, top 3 options per slot)
  const ShardGrid = ({ grid }) => {
  if (!Array.isArray(grid) || grid.length !== 3) return null;

  // Build 3 rows of [slot1[i], slot2[i], slot3[i]]
  const rows = [0, 1, 2].map(i => [
    grid[0]?.options[i],
    grid[1]?.options[i],
    grid[2]?.options[i],
  ]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border border-neutral-800">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((opt, ci) => (
                <td
                  key={ci}
                  className="border border-neutral-800 p-2 text-sm align-top"
                >
                  <div className="font-medium">{opt?.name || "—"}</div>
                  <div className="text-xs text-neutral-400">
                    {opt?.winRate == null
                      ? "–"
                      : `${(opt.winRate * 100).toFixed(0)}% WR`}{" "}
                    • {opt?.games || 0} games
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

  return (
  <div className="min-h-screen bg-neutral-950 text-neutral-100">
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
    {/* Header */}
    <div className="flex flex-wrap items-center gap-3">
      <Link className="text-sm text-blue-600 hover:underline" to="/">← Back</Link>
      <div className="flex items-center gap-3">
        <ChampionIcon
          name={displayName}
          version={ddVersion}
          size={CHAMP_HEADER_ICON_SIZE}
          className="shrink-0 shadow-sm"
        />
        <div className="leading-tight">
          <div className="text-2xl font-bold text-neutral-100">{displayName}</div>
          <div className="text-sm text-neutral-400">
            {patch === "__ALL__" ? "All patches" : `Patch ${patch}`} • Role {role}
          </div>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <label className="text-sm">Patch:</label>
        <select
        value={patch}
        onChange={e => setPatch(e.target.value)}
        className="bg-neutral-900 text-neutral-100 border border-neutral-700 rounded p-2"
      >
        <option value="__ALL__">All patches</option>   {/* <-- add this */}
        {(meta?.patches || []).map(p => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      </div>
    </div>

    {showRoleSwitch && (
      <div className="flex flex-wrap gap-2">
        {rolesOver5.map(r => (
          <button key={r.role}
          className={`px-3 py-1.5 rounded-full border text-sm ${
            role===r.role
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-neutral-900 border-neutral-800 text-neutral-200 hover:bg-neutral-800"
          }`}            onClick={()=>setRole(r.role)}>
            {r.role} <span className="opacity-60">({pct(r.pickShare)})</span>
          </button>
        ))}
      </div>
    )}

    <div className="text-sm text-neutral-500">
      {loading ? "Loading…" : (cur ? `${patch === "__ALL__" ? "All patches" : `Patch ${patch}`} • Role ${role}` : "No data for this selection")}
    </div>

    {/* KPIs */}
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card dark label="Winrate" value={pct(cur?.winRate)} />
      <Card dark label="Avg Game Length" value={cur?.avgGameLengthMin ? (cur.avgGameLengthMin.toFixed(1)+"m") : "–"} />
      <Card dark label="Avg K/D/A" value={`${int(cur?.avgKills)} / ${int(cur?.avgDeaths)} / ${int(cur?.avgAssists)}`} />
      <Card dark label="KP" value={pct(cur?.avgKP)} />
    </section>
    {/* Mastery split */}
    {cur?.mastery && (
      <MasteryTable mastery={cur.mastery} totalGames={cur.games} />
    )}

    {/* Two-column content */}
    <section className="grid gap-4 lg:grid-cols-3">
      {/* Lane metrics */}
      <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
        <Card dark label="GD@5" value={num(cur?.avgGoldDiffAt5,1)} />
        <Card dark label="GD@10" value={num(cur?.avgGoldDiffAt10,1)} />
        <Card dark label="CS@10" value={num(cur?.avgCsAt10,2)} />
        <Card dark label="CSD@10" value={num(cur?.avgCsDiffAt10,2)} />
        <Card dark label="DPM" value={num(cur?.avgDPM,1)} />
        <Card dark label="Team FB Tower WR" value={cur?.teamFBTowerRate != null ? (cur.teamFBTowerRate*100).toFixed(1)+"%" : "–"} />
      </div>

      {/* Runes + Summoners + Shards */}
      <div className="space-y-4">
        {/* Summoner Spells — Top 5 combos */}
        <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
          <div className="text-sm font-semibold mb-2">Summoner Spells</div>
          {Array.isArray(cur?.summonerCombosTop) && cur.summonerCombosTop.length ? (
            <ol className="text-sm space-y-2 list-decimal list-inside">
              {cur.summonerCombosTop.slice(0,5).map((c, i) => {
                const spells = (c.spells || []).map(prettySpell);
                const uses = c.avgUses || [];
                return (
                  <li key={i} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">
                        {((c.winRate ?? 0) * 100).toFixed(0)}% WR <span className="opacity-70">• {fmtInt(c.games)} games</span>
                      </div>
                    </div>
                    {spells.map((name, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div>{name}</div>
                        <div className="opacity-80">
                          {uses[idx] != null ? `${(uses[idx]).toFixed(1)} avg uses` : "–"}
                        </div>
                      </div>
                    ))}
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="text-sm opacity-70">No summoner data</div>
          )}
        </div>

        {/* Runes — Top 5 paths */}
        <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
          <div className="text-sm font-semibold mb-2">Most common rune paths (Top 5)</div>
          {Array.isArray(cur?.runePathsTop) && cur.runePathsTop.length ? (
            <ol className="text-sm space-y-1 list-decimal list-inside">
              {cur.runePathsTop.slice(0,5).map((rp, i) => (
                <li key={i} className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{rp.keystone || "—"}</div>
                    <div className="opacity-80">{[rp.rune1, rp.rune2, rp.rune3].filter(Boolean).join(" • ") || "—"}</div>
                    <div className="opacity-80">Sub: {[rp.subRune1, rp.subRune2].filter(Boolean).join(" • ") || "—"}</div>
                  </div>
                  <div className="shrink-0 text-right">{(rp.share*100).toFixed(1)}%</div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-sm opacity-70">No rune path data</div>
          )}
        </div>

        {/* Shards — 3×3 grid (top 3 per slot) */}
        <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
          <div className="text-sm font-semibold mb-2">Shard Choices</div>
          {Array.isArray(cur?.shardsGrid) && cur.shardsGrid.length === 3 ? (
            <ShardGrid grid={cur.shardsGrid} />
          ) : (
            <div className="text-sm opacity-70">No shard data</div>
          )}
        </div>
      </div>
    </section>

    {/* Matchups */}
    {(best10.length || worst10.length) ? (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Matchups</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <MatchupTable title="Best matchups (by TierScore)" rows={best10} />
          <MatchupTable title="Worst matchups (by TierScore)" rows={worst10} />
        </div>
      </section>
    ) : null}

    {/* Items */}
    <section className="space-y-4">
      <ItemTable title="Starter Items" rows={cur?.items?.starter || []} />
      {Array.isArray(cur?.items?.support) && cur.items.support.length > 0 && (
        <ItemTable title="Support Item" rows={cur.items.support} />
      )}
      {/* Boots (tiered) */}
      <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
        <div className="text-sm font-semibold mb-2">Boots</div>

        {cur?.items?.bootsTiered ? (
          <>
            <ItemTable title="Tier 1 Boots" rows={cur.items.bootsTiered.tier1 || []} />
            <div className="h-3" />
            <ItemTable title="Tier 2 Boots" rows={cur.items.bootsTiered.tier2 || []} />
            <div className="h-3" />
            <ItemTable title="Tier 3 Boots" rows={cur.items.bootsTiered.tier3 || []} />
          </>
        ) : (
          // Fallback for older JSONs without bootsTiered
          <>
            {cur?.items?.boots?.footwear ? (
              <div className="text-xs mb-2 text-neutral-300">
                Magical Footwear: {pct0(cur.items.boots.footwear.share)} • Avg time {fmtTime(cur.items.boots.footwear.avg_time_s)}
              </div>
            ) : null}
            <ItemTable title="Boots – Options" rows={cur?.items?.boots?.options || []} />
          </>
        )}
      </div>

      <ItemTable title="First 10 min Items" rows={cur?.items?.first10 || []} />
      <LegendaryTables data={cur?.items?.legendary || []} />
    </section>

    
    </div>
  </div>
);
}

function Home() {
  // ----- existing "overall" section (KPI + charts) -----
  const [kpi, setKpi] = useState(null);
  const [trend, setTrend] = useState(null);
  const [champs, setChamps] = useState(null);
  const [loadingOverall, setLoadingOverall] = useState(true);

  // Combine multiple leaderboards_{patch}.json into one across all patches
  function combineLeaderboardsAcrossPatches(arrOfBoards) {
    // role -> champKey -> accumulator
    const rolesMap = {};
    const rolePatchMatches = {}; // role -> total "matches" weight across all patches (≈ sumGames/2 per patch)

    // 1) pass through each patch board
    for (const board of (arrOfBoards || [])) {
      if (!board || !board.roles) continue;

      for (const role of Object.keys(board.roles)) {
        const rows = board.roles[role] || [];
        if (!rolesMap[role]) rolesMap[role] = {};
        if (!rolePatchMatches[role]) rolePatchMatches[role] = 0;

        // per-patch matches weight ~ sumGames/2 (2 champs per match for a given role)
        const sumGamesThisPatchRole = rows.reduce((s, r) => s + (r.games || 0), 0);
        const matchesW = sumGamesThisPatchRole / 2;
        rolePatchMatches[role] += matchesW;

        for (const r of rows) {
          const key = r.championSlug || String(r.champion || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
          let acc = rolesMap[role][key];
          if (!acc) {
            acc = rolesMap[role][key] = {
              champion: r.champion,
              championSlug: key,
              games: 0,
              // numerators for weighted metrics
              wins_sum: 0,
              kda_sum: 0,
              gd5_sum: 0,
              gd10_sum: 0,
              cs10_sum: 0,
              csd10_sum: 0,
              dpm_sum: 0,
              kp_sum: 0,
              // ban rates use matches weight (patch-level), not champ games
              ban_num: 0, ban_den: 0,
              uban_num: 0, uban_den: 0,
            };
          }

          const g = r.games || 0;
          acc.games += g;
          acc.wins_sum += (r.winRate != null ? r.winRate : 0) * g;
          acc.kda_sum  += (r.kdaAvg  != null ? r.kdaAvg  : 0) * g;
          acc.gd5_sum  += (r.goldDiffAt5Avg  ?? 0) * g;
          acc.gd10_sum += (r.goldDiffAt10Avg ?? 0) * g;
          acc.cs10_sum += (r.csAt10Avg       ?? 0) * g;
          acc.csd10_sum+= (r.csDiffAt10Avg   ?? 0) * g;
          acc.dpm_sum  += (r.dpmAvg          ?? 0) * g;
          acc.kp_sum   += (r.kpAvg           ?? 0) * g;

          // Ban% & Unique Ban% — weight by per-patch matches (same weight for all champs in that role)
          if (matchesW > 0) {
            if (r.banRate != null)       { acc.ban_num  += r.banRate       * matchesW; acc.ban_den  += matchesW; }
            if (r.banRateUnique != null) { acc.uban_num += r.banRateUnique * matchesW; acc.uban_den += matchesW; }
          }
        }
      }
    }

    // 2) finalize: convert maps into arrays; compute pickRate afterwards
    const out = { roles: {} };
    for (const role of Object.keys(rolesMap)) {
      const arr = Object.values(rolesMap[role]).map(acc => {
        const g = acc.games || 0;
        return {
          champion: acc.champion,
          championSlug: acc.championSlug,
          games: g,
          winRate: g ? acc.wins_sum / g : null,
          kdaAvg:  g ? acc.kda_sum  / g : null,
          goldDiffAt5Avg:  g ? acc.gd5_sum  / g : null,
          goldDiffAt10Avg: g ? acc.gd10_sum / g : null,
          csAt10Avg:       g ? acc.cs10_sum / g : null,
          csDiffAt10Avg:   g ? acc.csd10_sum/ g : null,
          dpmAvg:          g ? acc.dpm_sum  / g : null,
          kpAvg:           g ? acc.kp_sum   / g : null,
          // these two are still *fractions* (0..1); your table formats them
          banRate:        acc.ban_den  ? acc.ban_num  / acc.ban_den  : null,
          banRateUnique:  acc.uban_den ? acc.uban_num / acc.uban_den : null,
          pickRate: 0, // fill next
        };
      });

      // compute pickRate using total games across champs in the combined dataset
      const totalGamesRole = arr.reduce((s, r) => s + (r.games || 0), 0);
      for (const r of arr) r.pickRate = totalGamesRole ? (r.games / totalGamesRole) : 0;

      out.roles[role] = arr;
    }

    return out;
  }

  useEffect(() => {
    (async () => {
      setLoadingOverall(true);
      const [a,b,c] = await Promise.all([
        getJSON(`${BASE}data/overall_kpi.json`, { games:0, uniquePlayers:0, uniqueChampions:0, avgGameLengthMin:0 }),
        getJSON(`${BASE}data/trend.json`, []),
        getJSON(`${BASE}data/champs.json`, []),
      ]);
      setKpi(a); setTrend(b); setChamps(c); setLoadingOverall(false);
    })();
  }, []);

  const top5 = useMemo(()=> (champs || []).slice(0,5), [champs]);

  // ----- leaderboards (patch + role) -----
  const [patches, setPatches] = useState([]);
  const [patch, setPatch] = useState("");
  const [roles, setRoles] = useState(["ALL","TOP","JUNGLE","MIDDLE","BOTTOM","UTILITY"]);
  const [role, setRole] = useState("ALL");
  const [boards, setBoards] = useState(null);
  const [loadingBoards, setLoadingBoards] = useState(true);

  useEffect(() => {
    (async () => {
      const idx = await getJSON(`${BASE}data/leaderboards_index.json`, { patches: [], roles: [] });
      setPatches(idx.patches || []);
      if (idx.roles && idx.roles.length) setRoles(idx.roles);
      const first = (idx.patches || [])[0] || "";
      setPatch(first);
    })();
  }, []);

  useEffect(() => {
    if (!patch) { setBoards(null); return; }
    (async () => {
      setLoadingBoards(true);
      if (patch === "__ALL__") {
        // load every patch and combine
        const files = await Promise.all(
          (patches || []).map(p => getJSON(`${BASE}data/leaderboards_${p}.json`, null))
        );
        const combined = combineLeaderboardsAcrossPatches(files);
        setBoards(combined);
      } else {
        const data = await getJSON(`${BASE}data/leaderboards_${patch}.json`, null);
        setBoards(data);
      }
      setLoadingBoards(false);
    })();
  }, [patch, patches]);

  // Heavily games-weighted score
function ebScore(p, n, mu, K = 800) {
  // K=800 means ~equal weight at 800 games; increase K to weight games even more
  return (n * (p ?? 0) + K * mu) / (n + K);
}

const currentRows = useMemo(() => {
  if (!boards?.roles) return [];
  const base = boards.roles[role] || [];

  // global mean winrate (weighted by games)
  const totalGames = base.reduce((s, r) => s + (r.games || 0), 0);
  const totalWins  = base.reduce((s, r) => s + (r.games || 0) * (r.winRate || 0), 0);
  const mu = totalGames ? totalWins / totalGames : 0.5;

  // EB score (heavily games-weighted)
  const K = 800; // ↑ to lean even more on games
  const withScore = base.map(r => ({
    ...r,
    score: ( (r.games || 0) * (r.winRate || 0) + K * mu ) / ((r.games || 0) + K),
  }));

  // Build an index (0–100) & delta vs avg (pp)
  const sMin = Math.min(...withScore.map(r => r.score ?? Infinity));
  const sMax = Math.max(...withScore.map(r => r.score ?? -Infinity));
  const span = (isFinite(sMin) && isFinite(sMax) && sMax > sMin) ? (sMax - sMin) : 1;

  const scored = withScore.map(r => ({
    ...r,
    scoreIdx: Math.round(100 * ((r.score ?? mu) - sMin) / span),    // 0..100 index
    scoreDeltaPP: ((r.score ?? mu) - mu) * 100,                      // +/- pp vs avg
  }));

  // optional floor by games
  const filtered = scored.filter(r => (r.games || 0) >= 100);

  // sort by EB score (not by the displayed index text)
  filtered.sort((a, b) => (b.score - a.score) || (b.games - a.games));

  return filtered;
}, [boards, role]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* header */}
      <header className="sticky top-0 bg-white/70 dark:bg-neutral-900/70 backdrop-blur border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="font-semibold text-lg">StatCheck <span className="text-neutral-500 dark:text-neutral-400">/ Overall + Leaderboards</span></h1>
          <a className="ml-auto text-sm text-blue-600 hover:underline" href="https://github.com/mid-shiva/StatCheck" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {/* KPI cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Games" value={kpi ? fmtInt(kpi.games) : "–"} />
          <Card label="Unique Players" value={kpi ? fmtInt(kpi.uniquePlayers) : "–"} />
          <Card label="Unique Champions" value={kpi ? fmtInt(kpi.uniqueChampions) : "–"} />
          <Card label="Avg Game Length" value={kpi ? (kpi.avgGameLengthMin.toFixed(1) + "m") : "–"} />
        </section>

        {/* charts */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Chart title="Games & Players over Time">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend || []} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="games" stroke="#60a5fa" fill="url(#g1)" strokeWidth={2} />
                <Line type="monotone" dataKey="players" stroke="#34d399" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Chart>

          <Chart title="Top 5 — Pick Rate">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="champion" />
                <YAxis tickFormatter={v => (v*100).toFixed(0) + "%"} />
                <Tooltip formatter={v => fmtPct(v)} />
                <Bar dataKey="pickRate">
                  {top5.map((_, i) => <Cell key={i} fill={["#60a5fa","#34d399","#fbbf24","#f472b6","#a78bfa"][i%5]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Chart>

          <Chart title="Winrate Share (Top 5)">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="winRate" data={top5} nameKey="champion" cx="50%" cy="50%" outerRadius={80}>
                  {top5.map((_, i) => <Cell key={i} fill={["#60a5fa","#34d399","#fbbf24","#f472b6","#a78bfa"][i%5]} />)}
                </Pie>
                <Tooltip formatter={v => fmtPct(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Chart>
        </section>

        {/* --- Leaderboards --- */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Leaderboards</h2>
            {/* patch selector */}
            <label className="text-sm">Patch:</label>
            <select className="border rounded px-2 py-1 bg-neutral-900 border-neutral-800" value={patch} onChange={e=>setPatch(e.target.value)}>
              <option value="__ALL__">All patches</option>
              {(patches || []).map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* role selector */}
            <label className="text-sm ml-2">Role:</label>
            <select className="bg-neutral-900 text-neutral-100 border border-neutral-700 rounded p-2" value={role} onChange={e=>setRole(e.target.value)}>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="text-sm text-neutral-500">{loadingBoards ? "Loading…" : `${currentRows.length} champions`}</div>

          <LeaderboardTable rows={currentRows} />
        </section>
      </main>
    </div>
  );
}

function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/champions/:slug" element={<ChampionPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;