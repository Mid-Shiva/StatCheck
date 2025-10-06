import { useEffect, useMemo, useState, } from "react";
import { BrowserRouter, Routes, Route, Link, useParams, useSearchParams, useLocation } from "react-router-dom";
import { PageFade, AnimatedRoutes, MotionTableRow, AnimatedBar, GlowImg, TableSkeleton, SoftCard } from "./animations";

// Mastery icons (bundled from src/assets/mastery)
import m1 from "./assets/mastery/m1.png";
import m2 from "./assets/mastery/m2.png";
import m3 from "./assets/mastery/m3.png";
import m4 from "./assets/mastery/m4.png";
import m5 from "./assets/mastery/m5.png";
import m6 from "./assets/mastery/m6.png";
import m7 from "./assets/mastery/m7.png";

const MASTERY_ICONS = { 1: m1, 2: m2, 3: m3, 4: m4, 5: m5, 6: m6, 7: m7 };



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

function normalizeRoleKey(r) {
  if (!r) return r;
  if (r === "MID") return "MIDDLE";
  if (r === "SUPPORT") return "UTILITY";
  return r;
}

// ---- DDragon helpers (icons) ----
const DDRAGON_VER_FALLBACK = "15.18.1";
const MF_ICON =
  "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png";

// --- Champion ID mapping (very forgiving) ---
const CHAMP_ID_EXCEPT = {
  "FiddleSticks": "Fiddlesticks",
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

// load mastery icons from disk
function MasteryIcon({ level = 7, size = 42, className = "" }) {
  const L = Math.min(Math.max(1, Number(level) || 7), 7);
  const src = MASTERY_ICONS[L];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={`Mastery ${L}`}
      width={size}
      height={size}
      className={className}
      loading="lazy"
      title={`Mastery ${L}`}
    />
  );
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

// Build Map<runeName, absoluteIconUrl> from runesReforged.json
function useRunesIndex(version) {
  const [idx, setIdx] = useState(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        // This file isn't versioned by path for images, but we read the data by version anyway
        const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/runesReforged.json`;
        const res = await fetch(url, { cache: "force-cache" });
        const trees = await res.json();

        // Flatten all runes across all trees & slots
        const map = new Map();
        for (const tree of trees || []) {
          for (const slot of tree.slots || []) {
            for (const r of slot.runes || []) {
              // r.name (e.g. "Press the Attack"), r.icon (e.g. "perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png")
              const name = r?.name;
              const icon = r?.icon;
              if (!name || !icon) continue;

              // rune images live under /cdn/img/, not /cdn/<ver>/
              const full = `https://ddragon.leagueoflegends.com/cdn/img/${icon.replace(/^\/?/, "")}`;
              if (!map.has(name)) map.set(name, full);
            }
          }
        }
        if (!ignore) setIdx(map);
      } catch {
        if (!ignore) setIdx(null);
      }
    })();
    return () => { ignore = true; };
  }, [version]);

  return idx;
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

function SpellIcon({ name, version, size = 22, className = "" }) {
  if (!name) return null;
  const map = {
    Flash: "SummonerFlash",
    Ignite: "SummonerDot",
    Teleport: "SummonerTeleport",
    Ghost: "SummonerHaste",
    Cleanse: "SummonerBoost",
    Barrier: "SummonerBarrier",
    Heal: "SummonerHeal",
    Exhaust: "SummonerExhaust",
    Smite: "SummonerSmite",
  };
  const id = map[prettySpell(name)];
  if (!id) return <span className={`inline-block w-[${size}px] h-[${size}px] rounded bg-neutral-800 ${className}`} />;
  const src = `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${id}.png`;
  return <img src={src} alt={name} width={size} height={size} className={`rounded ${className}`} loading="lazy" />;
}


function RuneKeystoneIcon({ keystone, version, size = 32, className = "" }) {
  if (!keystone) return null;

  // optional generic fallback badge by path (nice to keep)
  const KEYSTONE_TO_PATH = {
    "Press the Attack": "Precision", "Lethal Tempo": "Precision",
    "Fleet Footwork": "Precision",  "Conqueror": "Precision",
    "Electrocute": "Domination", "Predator": "Domination",
    "Hail of Blades": "Domination", "Dark Harvest": "Domination",
    "Summon Aery": "Sorcery", "Arcane Comet": "Sorcery", "Phase Rush": "Sorcery",
    "Grasp of the Undying": "Resolve", "Aftershock": "Resolve", "Guardian": "Resolve",
    "Glacial Augment": "Inspiration", "Unsealed Spellbook": "Inspiration", "First Strike": "Inspiration",
  };
  const fallbackPath = KEYSTONE_TO_PATH[keystone];
  const fallbackSrc = fallbackPath
    ? `https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/${fallbackPath}/${fallbackPath}.png`
    : null;

  // use the real icon from the JSON
  const runesIndex = useRunesIndex(version);
  const icon = runesIndex?.get(keystone);

  
  // show nothing if we have neither (keystone typo, etc.)
  if (!icon && !fallbackSrc) return null;

  return (
    <img
      src={icon || fallbackSrc}
      alt={keystone}
      width={size}
      height={size}
      className={`rounded ${className}`}
      loading="lazy"
      onError={(e) => {
        if (icon && fallbackSrc) {
          e.currentTarget.onerror = null;
          e.currentTarget.src = fallbackSrc;
        }
      }}
      title={keystone}
    />
  );
}
function RuneIcon({ name, version, size = 32, className = "" }) {
  if (!name) return null;
  const runesIndex = useRunesIndex(version);
  const src = runesIndex?.get(name);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`rounded ${className}`}
      loading="lazy"
      title={name}
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}



function RunePathsTable({ rows, version }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
      <div className="text-sm font-semibold mb-2">Rune Paths (Top 5)</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-300">
            <tr>
              {[
                <th key="k"  className="px-2 py-1">Keystone</th>,
                <th key="p"  className="px-2 py-1">Primary</th>,
                <th key="s"  className="px-2 py-1">Sub</th>,
                <th key="wr" className="px-2 py-1 text-right">WR</th>,
                <th key="sh" className="px-2 py-1 text-right">Share</th>,
              ]}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((rp, i) => {
              const g  = Number(rp?.games) || 0;
              const w  = (rp?.wins != null) ? Number(rp.wins)
                        : (typeof rp?.winRate === "number" && g ? rp.winRate * g : 0);
              const wr = g > 0
                ? (rp?.winRate != null ? rp.winRate : w / g)
                : null;

              return (
                <tr key={i} className="border-t border-neutral-800 align-top">
                  <td className="px-2 py-1">
                    <div className="inline-flex items-center gap-2">
                      <RuneKeystoneIcon keystone={rp.keystone} version={version} size={40} />
                      <span className="font-medium">{rp.keystone || "—"}</span>
                    </div>
                  </td>

                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {[rp.rune1, rp.rune2, rp.rune3].filter(Boolean).map((nm, j) => (
                        <span key={j} className="inline-flex items-center gap-1">
                          <RuneIcon name={nm} version={version} />
                          <span>{nm}</span>
                          {j < 2 ? <span className="opacity-40">•</span> : null}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-2 py-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {[rp.subRune1, rp.subRune2].filter(Boolean).map((nm, j) => (
                        <span key={j} className="inline-flex items-center gap-1">
                          <RuneIcon name={nm} version={version} />
                          <span>{nm}</span>
                          {j === 0 && rp.subRune2 ? <span className="opacity-40">•</span> : null}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* NEW WR% cell */}
                  <td className="px-2 py-1 text-right tabular-nums">
                    {wr == null ? "–" : (wr * 100).toFixed(1) + "%"}
                  </td>

                  {/* existing Share cell */}
                  <td className="px-2 py-1 text-right tabular-nums">
                    {rp?.share == null ? "–" : (rp.share * 100).toFixed(1) + "%"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Compact stats table for lane metrics
function CompactStatsTable({ rows }) {
  // rows: [{label, value, title?}]
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
      <div className="text-sm font-semibold mb-2">Lane & Combat Metrics</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-300">
            <tr>
              {rows.map((r, i) => (
                <th key={i} className="px-2 py-1">{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {rows.map((r, i) => (
                <td key={i} className="px-2 py-1 tabular-nums" title={r.title || r.label}>
                  {r.value}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// number getter that tolerates alternate keys
const getNum = (obj, ...keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
};


function FirstItemComparison({ data, version, itemIndex }) {
  if (!data || typeof data !== "object") return null;

  const statLabels = {
    gamesNext: "Games",
    winRate: "Winrate",
    noSecondPct: "No 2nd %",
    noSecondWr: "No 2nd WR",
    time_min: "Time (min)",
    player_level: "PL",
    player_gold_dif: "Gold Δ (P)",
    team_gold_diff: "Gold Δ (Team)",
    magicDamageDone: "Magic Δ",
    magicDamageDoneToChampions: "Magic→Champs Δ",
    magicDamageTaken: "Magic Taken Δ",
    physicalDamageDone: "Physical Δ",
    physicalDamageDoneToChampions: "Physical→Champs Δ",
    physicalDamageTaken: "Physical Taken Δ",
    totalDamageDone: "Total Δ",
    totalDamageDoneToChampions: "Total→Champs Δ",
    totalDamageTaken: "Total Taken Δ",
  };

  const rows = Object.entries(data).map(([name, v]) => {
    const gFirst = Number(v?.games) || 0;
    const hasNext = v && Object.prototype.hasOwnProperty.call(v, "next_games");
    const gNext  = hasNext ? (Number(v?.next_games) || 0) : null;
    const gCurN  = hasNext ? (Number(v?.curr_with_next_games) || gNext || 0) : null;
    

    const avgFrom = (obj, g, ...sumKeys) => (g > 0 ? (getNum(obj, ...sumKeys) ?? 0) / g : null);

    // keep-as-is (averaged over games that *did* buy a second item when available)
    const time_min   = hasNext ? avgFrom(v, gCurN, "curr_with_next_sum_time_s") : avgFrom(v, gFirst, "sum_time_s");
    const player_lvl = hasNext ? avgFrom(v, gCurN, "curr_with_next_sum_player_level") : avgFrom(v, gFirst, "sum_player_level");
    const gold_p     = hasNext ? avgFrom(v, gCurN, "curr_with_next_sum_player_gold_dif") : avgFrom(v, gFirst, "sum_player_gold_dif");
    const gold_team  = hasNext ? avgFrom(v, gCurN, "curr_with_next_sum_team_gold_diff") : avgFrom(v, gFirst, "sum_team_gold_diff");
    const pl_diff_f  = hasNext
      ? avgFrom(v, gCurN, "curr_with_next_sum_pl_diff_frac", "curr_with_next_sum_player_level_diff_frac")
      : avgFrom(v, gFirst, "sum_pl_diff_frac");

    const delta = (nextKey, ...curAltKeys) => {
      if (!hasNext || !(gNext > 0 && gCurN > 0)) return null;
      const n = avgFrom(v, gNext, nextKey);
      const c = avgFrom(v, gCurN, ...curAltKeys);
      return (n == null || c == null) ? null : (n - c);
    };

    // deltas (Next − Current)
    const magic             = delta("next_sum_magicDamageDone",            "curr_with_next_sum_magicDamageDone");
    const magicChamps       = delta("next_sum_magicDamageDoneToChampions", "curr_with_next_sum_magicDamageDoneToChampions");
    const magicTaken        = delta("next_sum_magicDamageTaken",           "curr_with_next_sum_magicDamageTaken");

    const phys              = delta("next_sum_physicalDamageDone",            "curr_with_next_sum_physicalDamageDone");
    const physChamps        = delta("next_sum_physicalDamageDoneToChampions", "curr_with_next_sum_physicalDamageDoneToChampions");
    const physTaken         = delta("next_sum_physicalDamageTaken",           "curr_with_next_sum_physicalDamageTaken");

    const total             = delta("next_sum_totalDamageDone",            "curr_with_next_sum_totalDamageDone");
    const totalChamps       = delta("next_sum_totalDamageDoneToChampions", "curr_with_next_sum_totalDamageDoneToChampions", "curr_with_next_sum_totalDamageToChampions");
    const totalTaken        = delta("next_sum_totalDamageTaken",           "curr_with_next_sum_totalDamageTaken");
        // --- wins & winrates (robust to different exporter key names) ---
    const winsFirst = getNum(v, "wins", "sum_wins", "sumWin", "sumWins");
    const winsNext  = hasNext ? getNum(v, "next_wins", "next_sum_wins", "wins_next") : null;
    const winsCurN  = hasNext ? getNum(v, "curr_with_next_wins", "curr_with_next_sum_wins", "curr_with_next_wins_sum") : null;

    const winRate = (gFirst > 0 && typeof winsFirst === "number") ? winsFirst / gFirst : null;

    // early-ended (no 2nd item) group
    const gNo2   = (hasNext && gFirst > 0 && gCurN != null) ? (gFirst - gCurN) : null;
    const wNo2   = (hasNext && typeof winsFirst === "number" && winsCurN != null) ? (winsFirst - winsCurN) : null;
    const noSecondWr = (gNo2 && wNo2 != null && gNo2 > 0) ? (wNo2 / gNo2) : null;

    return {
      name,
      hasNext,
      gamesFirst: gFirst,
      gamesNext: gNext,
      noSecondPct: (hasNext && gFirst > 0) ? (1 - (gNext / gFirst)) : null,
      winRate,
      noSecondWr,
      

      time_min: time_min != null ? time_min / 60 : null,
      player_level: player_lvl,
      player_gold_dif: gold_p,
      team_gold_diff: gold_team,
      player_level_diff_frac: pl_diff_f,

      magicDamageDone: magic,
      magicDamageDoneToChampions: magicChamps,
      magicDamageTaken: magicTaken,

      physicalDamageDone: phys,
      physicalDamageDoneToChampions: physChamps,
      physicalDamageTaken: physTaken,

      totalDamageDone: total,
      totalDamageDoneToChampions: totalChamps,
      totalDamageTaken: totalTaken,
    };
  });

  if (!rows.length) return null;

  // FIX: sort/cutoff by gamesFirst, not games
  rows.sort((a, b) => (b.gamesFirst || 0) - (a.gamesFirst || 0));
  const top = rows[0];
  if (!top || (top.gamesFirst || 0) <= 0) return null;
  const cutoff = top.gamesFirst * 0.10;

  const filtered = rows
    .filter(r => (r.gamesNext || 0) > 0)         // only first items that actually led to a 2nd item
    .filter(r => (r.gamesFirst || 0) >= cutoff); // prominence filter

  if (!filtered.length) return null;

  const fmt = (x, d=1) => (x == null ? "–" : Number(x).toFixed(d));
  const fmtInt = (n) => (n == null ? "–" : new Intl.NumberFormat().format(n));

  // --- Per-stat ranking with stronger, clearer styling ---
// NOTE: lower is better ONLY for the "time_min" row; everything else: higher is better.
const rankByStat = {};
const statKeys = Object.keys(statLabels);

for (const key of statKeys) {
  // Collect finite values for the visible columns
  const pairs = filtered
    .map((it, idx) => ({ idx, val: it[key] }))
    .filter(p => typeof p.val === "number" && Number.isFinite(p.val));

  if (pairs.length < 2) continue;

  const lowerIsBetter = key === "time_min";

  // Sort so that index 0 is ALWAYS the "best" for this row
  pairs.sort((a, b) => {
    return lowerIsBetter ? (a.val - b.val) : (b.val - a.val);
  });

  const bestIdx   = pairs[0]?.idx ?? null;                 // winner
  const secondIdx = pairs[1]?.idx ?? null;                 // runner-up
  const worstIdx  = pairs[pairs.length - 1]?.idx ?? null;  // lowest rank

  rankByStat[key] = { bestIdx, secondIdx, worstIdx };
}

// Stronger visual differentiation, single calm hue
const rankClass = (key, colIndex) => {
  const r = rankByStat[key];
  if (!r) return "";
  if (colIndex === r.bestIdx) {
    return "bg-emerald-500 text-white font-bold rounded-md shadow-md ring-2 ring-emerald-400";
  }
  if (colIndex === r.secondIdx) {
    return "bg-emerald-500/15 text-emerald-200 rounded-md ring-1 ring-emerald-400/40";
  }
  if (colIndex === r.worstIdx) {
    return "text-neutral-500 italic";
  }
  return "";
};

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-3 mt-3">
      <div className="text-sm font-semibold mb-2">
        First Item Comparison
      </div>
       {/* PIVOTED TABLE */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-300">
            <tr>
              <th className="px-2 py-1">Stat</th>
              {filtered.map(r => (
                <th key={r.name} className="px-2 py-1 text-right">
                  <div className="inline-flex items-center gap-1">
                    <ItemIcon name={r.name} version={version} itemIndex={itemIndex} size={20}/>
                    {r.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(statLabels).map(([key, label]) => (
              <tr key={key} className="border-t border-neutral-800">
                <td className="px-2 py-1 font-medium">{label}</td>
                {filtered.map((r, j) => {
                  let display;
                  const raw = r[key];

                  if (key === "noSecondPct" && raw != null) {
                    display = (raw * 100).toFixed(1) + "%";
                  } else if (key === "winRate") {
                     display = (typeof raw === "number") ? (raw * 100).toFixed(1) + "%" : "–";
                  } else if (key === "noSecondWr") {
                    display = (typeof raw === "number") ? (raw * 100).toFixed(1) + "%" : "–";
                  } else if (raw != null) {
                    const digits = key.includes("time") || key.includes("level") ? 2 : 0;
                    display = Number(raw).toFixed(digits);
                  } else {
                    display = "–";
                  }

                  return (
                    <td
                      key={r.name}
                      className={`px-2 py-1 text-right tabular-nums ${rankClass(key, j)}`}
                      title={raw == null ? "" : `${label} — ${r.name}`}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function ShardIcon({ name, size = 20, className = "" }) {
  if (!name) return null;

  // normalize (strip spaces, punctuation, case)
  const key = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "");

  // List candidates (first one that loads wins)
  const CANDIDATES = {
    adaptiveforce:            ["StatModsAdaptiveForceIcon"],
    attackspeed:              ["StatModsAttackSpeedIcon"],
    abilityhaste:             ["StatModsAbilityHasteIcon", "StatModsCDRScalingIcon", "StatModsCooldownReductionIcon"],
    movespeed:                ["StatModsMovementSpeedIcon"],
    tenacityandslowresist:    ["StatModsTenacityIcon"],
    health:                   ["StatModsHealthPlusIcon", "StatModsHealthIcon"],
    healthscaling:            ["StatModsHealthScalingIcon"],
  };

  const files = CANDIDATES[key];
  if (!files || !files.length) return null;

  const [idx, setIdx] = useState(0);
  const src = `https://ddragon.leagueoflegends.com/cdn/img/perk-images/StatMods/${files[idx]}.png`;

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`rounded ${className}`}
      loading="lazy"
      title={name}
      onError={() => {
        if (idx + 1 < files.length) setIdx(idx + 1);
      }}
    />
  );
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

function Card({ label, value, dark = false, dense = false }) {
  const box =
    dark
      ? "bg-neutral-900 border border-neutral-800 text-neutral-100"
      : "bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800";
  const labelCls = dark ? "text-neutral-400" : "text-neutral-500 dark:text-neutral-400";
  const valueCls = dark ? "text-neutral-50" : "";
  const pad = dense ? "p-3" : "p-4";
  const valueSize = dense ? "text-xl" : "text-2xl";
  return (
    <div className={`${box} rounded-xl ${pad} shadow-sm ring-1 ring-neutral-200/60 dark:ring-neutral-800/60`}>
      <div className={`text-sm ${labelCls}`}>{label}</div>
      <div className={`${valueSize} font-bold ${valueCls}`}>{value}</div>
    </div>
  );
}

const OTP_THRESH = 0.65; // 80%

// Prefer exporter fields if present; otherwise derive
// Prefer exporter fields if present; otherwise derive
const getBestMasteryShare = (r) => {
  if (!r) return null;

  // exporter may already mark an OTP row
  if (r.otp === true) return 1;

  // explicit share from exporter or nested mastery block
  if (r.bestMasteryShare != null) return Number(r.bestMasteryShare);
  if (r?.mastery?.BestMastery?.share != null) return Number(r.mastery.BestMastery.share);

  // derive from top-level counts (role-filtered leaderboard rows often have these)
  const bestTop = r?.bestMasteryGames;
  const total   = r?.games;
  if (Number.isFinite(bestTop) && Number.isFinite(total) && total > 0) {
    return bestTop / total;
  }

  // final fallback from nested counts if present
  const bestNested = r?.mastery?.BestMastery?.games;
  if (Number.isFinite(bestNested) && Number.isFinite(total) && total > 0) {
    return bestNested / total;
  }

  return null;
};

// --- OTP share lazy fetch (per champ/role/patch) ---
const _otpCache = new Map();

function _parsePatchTuple(p) {
  // "15.18" => [15,18], fallback to 0
  if (!p) return [0,0,0];
  const parts = String(p).split(".");
  const nums = parts.map(x => (/^\d+$/.test(x) ? parseInt(x,10) : 0));
  while (nums.length < 3) nums.push(0);
  return nums.slice(0,3);
}
function useOtpShare(slug, patch, role) {
  const [share, setShare] = useState(null);

  useEffect(() => {    
    if (!slug || !role || !patch) { setShare(null); return; }
    const rKey = normalizeRoleKey(role);
    const fileSlug = String(slug).toLowerCase();
    let cancelled = false;
    const key = `${fileSlug}|${patch}|${rKey}`;
    if (_otpCache.has(key)) {
      setShare(_otpCache.get(key));
      return;
    }
    (async () => {
      let s = null;
      try {
        const j = await getJSON(`${BASE}data/champions/${fileSlug}.json`, null);
        const data = j?.data;
        if (!data) { s = null; return; }

        const pickShareFromRoleBucket = (bucket) => {
          if (!bucket) return null;
          if (bucket?.mastery?.BestMastery?.share != null) return Number(bucket.mastery.BestMastery.share);
          // derive if games are present
          const g = bucket?.games || 0;
          const bestG = bucket?.mastery?.BestMastery?.games ?? bucket?.bestMasteryGames;
          if (Number.isFinite(bestG) && g > 0) return bestG / g;
          return null;
        };

        if (patch === "__ALL__") {
          // Weight across all patches by games for this role
          let best = 0, total = 0;
          for (const [p, byRole] of Object.entries(data)) {
            const bucket = byRole?.[rKey];
            if (!bucket) continue;
            const g = bucket?.games || 0;
            const bestG = bucket?.mastery?.BestMastery?.games ?? bucket?.bestMasteryGames ?? Math.round((bucket?.mastery?.BestMastery?.share ?? 0) * g);
            best += (bestG || 0);
            total += g;
          }
          s = total > 0 ? best / total : null;
        } else {
          // exact patch, else nearest previous, else latest available
          let bucket = data?.[patch]?.[rKey];
          
if (!bucket) {
  // choose the closest patch that actually has this role bucket
  const tgt = _parsePatchTuple(patch);
  let bestKey = null;
  let bestDist = Infinity;
  for (const pKey of Object.keys(data)) {
    const br = data?.[pKey]?.[role];
    if (!br) continue;
    const cand = _parsePatchTuple(pKey);
    const dist = Math.abs(cand[0]-tgt[0]) * 10000 + Math.abs(cand[1]-tgt[1]) * 100 + Math.abs(cand[2]-tgt[2]);
    if (dist < bestDist) { bestDist = dist; bestKey = pKey; }
  }
  bucket = bestKey ? data[bestKey][rKey] : null;
}
s = pickShareFromRoleBucket(bucket);
        }
      } catch (e) {
        // ignore; keep s = null
        console?.debug?.("OTP share fetch failed", slug, patch, role, e);
      } finally {
        if (!cancelled) {
          _otpCache.set(key, s);
          setShare(s);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [slug, patch, role]);

  return share;
}

function OtpBadge({ slug, patch, role, exportShare, exportOtp, fallbackOtpFromAll }) {
  const fetchedShare = useOtpShare(slug, patch, role);
  // Prefer exporter provided share when it exists (e.g., ALL rows)
  // pick the strongest signal:
  //  - exporter 'otp' wins outright
  //  - otherwise use the max of fetchedShare and exportShare (ignoring 0/NaN)
  const shares = [];
  if (typeof fetchedShare === "number" && !Number.isNaN(fetchedShare)) shares.push(fetchedShare);
  if (typeof exportShare === "number" && exportShare > 0) shares.push(exportShare);
  const share = shares.length ? Math.max(...shares) : null;

  const isOTP =
   exportOtp === true ||
    fallbackOtpFromAll === true ||
    (share != null && share >= OTP_THRESH);
  if (!isOTP) return null;
  const pct = share != null ? Math.round(share * 100) : null;
  return (
    <span
      className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-500/60 bg-amber-500/10 text-amber-300"
      title={pct != null ? `Best mastery players account for ${pct}% of games in this role` : "OTP"}
    >
      OTP
    </span>
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

function LeaderboardTable({ rows, role, patch, otpFromAllBySlug }) {
  // Ban% fix: divide source value by 10 before turning to %
  const fmtBan   = x => (x == null ? "–" : ((x / 10) * 100).toFixed(2) + "%");
  const fmtPick  = x => (x == null ? "–" : (x * 100).toFixed(2) + "%");
  const fmtKDA   = x => (x == null ? "–" : (x * 10).toFixed(2));
  const fmt1     = x => (x == null ? "–" : Number(x).toFixed(1));
  const fmtCS10  = x => (x == null ? "–" : Number(x).toFixed(2));
  const fmtCSD10 = x => (x == null ? "–" : Number(x).toFixed(2));
  const fmtInt   = n => (n == null ? "–" : new Intl.NumberFormat().format(n));

  const ddVersion = useDdragonVersion();
  const CHAMP_ICON_SIZE = 40;
  const [search, setSearch] = useState("");

  // friendlier grade cutoffs (more S/A)
  const gradeFromIdx = (idx = 0) => {
    if (idx >= 85) return "S";
    if (idx >= 70) return "A";
    if (idx >= 55) return "B";
    if (idx >= 35) return "C";
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
    {
      key: "tier", label: "Tier", align: "left", accessor: r => r.score,
      render: r => {
        const g = gradeFromIdx(r.scoreIdx);
        const idx = Math.max(0, Math.min(100, r.scoreIdx ?? 0));
        return (
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded border ${gradeClass(g)}`}>{g}</span>
            <AnimatedBar value={idx} label={`TierScore ${idx}`} />
          </div>
        );
      },
      sortable: true
    },
    {
      key: "champ", label: "Champion", align: "left",
      render: r => {
        const share = getBestMasteryShare(r);        

        return (
          <Link
            className="text-blue-600 hover:underline"
            to={`/champions/${r.championSlug || r.champion?.toLowerCase?.().replace(/[^a-z0-9]+/g,"")}`}
          >
            <span className="inline-flex items-center gap-2">
              <ChampionIcon name={r.champion} version={ddVersion} size={CHAMP_ICON_SIZE} className="shrink-0" />
              <span className="text-[15px]">{r.champion}</span>
              <OtpBadge
                slug={r.championSlug || r.champion?.toLowerCase?.().replace(/[^a-z0-9]+/g,"")}
                patch={patch}
                role={role}
                exportShare={getBestMasteryShare(r)}  
                exportOtp={r.otp}
                fallbackOtpFromAll={
                  !!otpFromAllBySlug?.[
                    r.championSlug ||
                    r.champion?.toLowerCase?.().replace(/[^a-z0-9]+/g, "")
                  ]
                }
              />
            </span>
          </Link>
        );
      },
    },
    { key: "games", label: "Games", align: "right", accessor: r => r.games,                render: r => fmtInt(r.games),        sortable: true },
    { key: "win",   label: "Win%",  align: "right", accessor: r => r.winRate,              render: r => (r.winRate==null?"–":(r.winRate*100).toFixed(2)+"%"), sortable: true },
    { key: "pick",  label: "Pick%", align: "right", accessor: r => r.pickRate,             render: r => fmtPick(r.pickRate),    sortable: true },
    { key: "uban",  label: "Unique Ban%", align: "right", accessor: r => r.banRateUnique,  render: r => fmtBan(r.banRateUnique),sortable: true },
    { key: "ban",   label: "Ban%",        align: "right", accessor: r => r.banRate,       render: r => fmtBan(r.banRate),      sortable: true },
    { key: "kda",   label: "KDA",   align: "right", accessor: r => r.kdaAvg,               render: r => fmtKDA(r.kdaAvg),       sortable: true },
    { key: "gd5",   label: "GD@5",  align: "right", accessor: r => r.goldDiffAt5Avg,       render: r => fmt1(r.goldDiffAt5Avg), sortable: true },
    { key: "gd10",  label: "GD@10", align: "right", accessor: r => r.goldDiffAt10Avg,      render: r => fmt1(r.goldDiffAt10Avg),sortable: true },
    { key: "cs10",  label: "CS@10", align: "right", accessor: r => r.csAt10Avg,            render: r => fmtCS10(r.csAt10Avg),   sortable: true },
    { key: "csd10", label: "CSD@10",align: "right", accessor: r => r.csDiffAt10Avg,        render: r => fmtCSD10(r.csDiffAt10Avg), sortable: true },
    { key: "dpm",   label: "DPM",   align: "right", accessor: r => r.dpmAvg,               render: r => fmt1(r.dpmAvg),         sortable: true },
    { key: "kp",    label: "KP",    align: "right", accessor: r => r.kpAvg,                render: r => (r.kpAvg==null?"–":(r.kpAvg*100).toFixed(2)+"%"), sortable: true },
  ];

  const [sortKey, setSortKey] = useState("tier");
  const [sortDir, setSortDir] = useState("desc");

  // filter by search
  const filteredRows = useMemo(() => {
    const base = Array.isArray(rows) ? rows : [];
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(r => (r.champion || "").toLowerCase().includes(q));
  }, [rows, search]);

  // sort
  const sortedRows = useMemo(() => {
    const col = COLUMNS.find(c => c.key === sortKey);
    if (!col) return filteredRows || [];
    const arr = [...(filteredRows || [])];
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
  }, [filteredRows, sortKey, sortDir]);

  const onSort = (key) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };
  const sortIcon = (key) => (key !== sortKey ? <span className="opacity-30">↕</span> : (sortDir === "asc" ? <span>▲</span> : <span>▼</span>));

  // ---- UI ----
  return (
    <section className="max-w-6xl mx-auto w-full px-3">
      {/* Search bar */}
      <div className="p-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search champion..."
          className="px-3 py-1.5 border rounded text-sm w-60
                     bg-white dark:bg-neutral-800
                     border-neutral-300 dark:border-neutral-700
                     text-neutral-900 dark:text-neutral-100"
        />
      </div>

      {/* Table wrapper */}
      <div className="mt-2 w-full overflow-x-auto">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800
                        rounded-xl shadow-sm ring-1 ring-neutral-200/60 dark:ring-neutral-800/60">
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
                <MotionTableRow
                  key={r.champion + "_" + i}
                  className="border-t border-neutral-200 dark:border-neutral-800
                            odd:bg-neutral-50/40 dark:odd:bg-neutral-900/20
                            hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={`px-3 py-2 tabular-nums ${c.align === "right" ? "text-right" : ""}`}>
                      {c.render ? c.render(r, i) : (r[c.key] ?? "")}
                    </td>
                  ))}
                </MotionTableRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

const fmtPct1 = (x) => (x == null ? "–" : (x * 100).toFixed(1) + "%");
const fmtInt1  = (n) => (n == null ? "–" : new Intl.NumberFormat().format(n));
// Load the per-champion players JSON produced by export_best_players.py
async function loadChampionPlayers(BASE, slug, patch, role) {
  // File path written by export_best_players.py:
  const url = `${BASE}data/champions/${slug}_players.json`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();

    // shape: { meta, data: { patch: { ROLE: { bestTop5, mostByGamesTop5 }}}}
    const byPatch = j?.data || {};

    // Try exact (patch, role), then (patch, "ALL"), then (closest patch, role), then anything we find
    const roleKey = (role || "ALL").toUpperCase();

    const exact = byPatch?.[patch]?.[roleKey];
    if (exact) return exact;

    const samePatchAll = byPatch?.[patch]?.ALL;
    if (samePatchAll) return samePatchAll;

    // pick the newest available patch as a fallback
    const patches = Object.keys(byPatch || {});
    if (patches.length) {
      // naive newest: sort like semantic-ish “15.18” → [15,18]
      const parseP = (p) => String(p).split(".").map(x => (/\d+/.test(x) ? +x : -1));
      patches.sort((a,b) => {
        const A = parseP(a), B = parseP(b);
        // compare major, then minor, then patch
        return (B[0]-A[0]) || (B[1]-A[1]) || ((B[2]||0)-(A[2]||0));
      });

      for (const p of [patch, ...patches]) {
        if (byPatch?.[p]?.[roleKey]) return byPatch[p][roleKey];
        if (byPatch?.[p]?.ALL) return byPatch[p].ALL;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function BestPlayersTables({ BASE, slug, patch, role }) {
  const [block, setBlock] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let ignore = false;
    (async () => {
      setStatus("loading");
      const data = await loadChampionPlayers(BASE, slug, patch, role);
      if (!ignore) {
        setBlock(data);
        setStatus("done");
      }
    })();
    return () => { ignore = true; };
  }, [BASE, slug, patch, role]);

  if (status === "loading") {
    return (
      <div className="mt-6">
        {/* If you have a shared skeleton, use it. Otherwise keep this simple placeholder. */}
        <div className="h-24 rounded border border-neutral-800 bg-neutral-900 animate-pulse" />
      </div>
    );
  }
  if (!block || ((!block.bestTop5 || block.bestTop5.length === 0) && (!block.mostByGamesTop5 || block.mostByGamesTop5.length === 0))) {
    return null;
  }

  const Table = ({ title, rows }) => (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
      <div className="text-sm font-semibold mb-2">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-300">
            <tr>
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Tag</th>
              <th className="px-2 py-1 text-right">Games</th>
              <th className="px-2 py-1 text-right">WR%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={`${p.name}-${p.tag}-${i}`} className="border-t border-neutral-800">
                <td className="px-2 py-1">{p.name || "—"}</td>
                <td className="px-2 py-1 text-neutral-300">{p.tag || "—"}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmtInt1(p.games)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmtPct1(p.winRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section className="grid md:grid-cols-2 gap-3 mt-6">
      {block.bestTop5?.length ? <Table title="Best Players" rows={block.bestTop5} /> : null}
      {block.mostByGamesTop5?.length ? <Table title="Top Contributors (by games)" rows={block.mostByGamesTop5} /> : null}
    </section>
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

<BestPlayersTables
  BASE={BASE}
  slug={slug}
  patch={patch}
  role={role}
/>

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

// Canonical shard order for ALL-patch aggregation (row 1..3)
const SHARDS_CANON = [
  // Offense
  ["Adaptive Force", "Attack Speed", "Ability Haste"],
  // Flex
  ["Adaptive Force", "Move Speed", "Health Scaling"],
  // Defense  ← this is the row you asked about
  ["Health", "Tenacity and Slow Resist", "Health Scaling"]
];

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
    runePathsMap: new Map(),
    mastery: {
      BestMastery:       { games: 0, wins: 0, sumAvg: 0, denAvg: 0 },
      Best2Mastery:      { games: 0, wins: 0, sumAvg: 0, denAvg: 0 },
      Best3Mastery:      { games: 0, wins: 0, sumAvg: 0, denAvg: 0 },
      BestTop5Mastery:   { games: 0, wins: 0, sumAvg: 0, denAvg: 0 },
      BelowTop5Mastery:  { games: 0, wins: 0, sumAvg: 0, denAvg: 0 }, 
    },
    shardsGrid: [ {}, {}, {} ],
    summonerCombos: {},
    items: {
      starter: {},
      support: {},
      boots: {},                 
      footwear_games: 0,
      footwear_sum_time: 0,
      boots_t1: {},              
      boots_t2: {},
      boots_t3: {},
      first10: {},
      legendary: [],
      first_item: {}
    }
  };
  

  const sum = (a,b)=> (a||0)+(b||0);

  for (const p of Object.keys(allData)) {
    const r = allData[p]?.[role];
    if (!r) continue;

    const g = r.games || 0;
    const w = r.wins  || 0;
    acc.games += g; acc.wins += w;

    // rune paths (weight by champ games in that patch)
    if (Array.isArray(r.runePathsTop) && g > 0) {
      for (const rp of r.runePathsTop) {
        // Many JSONs only have share (fraction of this champ's games). Turn it into games weight.
        const rpGames = Math.max(0, Number(rp?.share || 0)) * g;
        if (rpGames <= 0) continue;

        // Make a stable key so identical paths merge
        const key = [
          rp.keystone || "",
          rp.rune1 || "", rp.rune2 || "", rp.rune3 || "",
          rp.subRune1 || "", rp.subRune2 || ""
        ].join("|");

        const cur = acc.runePathsMap.get(key) || {
          keystone: rp.keystone || null,
          rune1: rp.rune1 || null, rune2: rp.rune2 || null, rune3: rp.rune3 || null,
          subRune1: rp.subRune1 || null, subRune2: rp.subRune2 || null,
          games: 0,
          wins: 0, // only used if your JSON has winRate per path; fine if it stays 0
        };

        const bt = r?.items?.bootsTiered;
        if (bt) {
          const addTier = (tierRows, target) => {
            for (const row of (tierRows || [])) {
              const name = row?.name || row?.item || row?.id || "";
              if (!name) continue;
              const g = Number(row?.games || 0);
              // prefer explicit wins; else derive from winRate * games
              const w = (row?.wins != null)
                ? Number(row.wins)
                : ((row?.winRate != null && g) ? Number(row.winRate) * g : 0);

              if (!acc.items[target][name]) acc.items[target][name] = { games: 0, wins: 0 };
              acc.items[target][name].games += g;
              acc.items[target][name].wins  += w;
            }
          };

          addTier(bt.tier1, "boots_t1");
          addTier(bt.tier2, "boots_t2");
          addTier(bt.tier3, "boots_t3");
        }

        // (optional legacy: if this per-patch bucket only had the old boots table)
        const legacyBoots = r?.items?.boots?.options;
        if (legacyBoots && (!bt || (!bt.tier1 && !bt.tier2 && !bt.tier3))) {
          for (const row of legacyBoots) {
            const name = row?.name || "";
            if (!name) continue;
            const g = Number(row?.games || 0);
            const w = (row?.wins != null)
              ? Number(row.wins)
              : ((row?.winRate != null && g) ? Number(row.winRate) * g : 0);

            if (!acc.items.boots[name]) acc.items.boots[name] = { games: 0, wins: 0 };
            acc.items.boots[name].games += g;
            acc.items.boots[name].wins  += w;
          }
        }

        cur.games += rpGames;

        // If per-path winRate exists in your JSON, weight it too:
        if (rp.winRate != null) cur.wins += rp.winRate * rpGames;

        acc.runePathsMap.set(key, cur);
      }
    }
    

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
    if (r.mastery) {
      for (const key of Object.keys(acc.mastery)) {
        const mm = r.mastery[key];
        if (!mm) continue;
        const g2 = mm.games || 0;
        acc.mastery[key].games += g2;
        const w2 = (mm.wins != null) ? Number(mm.wins)
                : (typeof mm.winRate === "number" ? mm.winRate * g2 : 0);
        acc.mastery[key].wins += w2;
        if (mm.avgChampMasteryPer != null) {
          // accumulate for a weighted average
          acc.mastery[key].sumAvg = (acc.mastery[key].sumAvg || 0) + Number(mm.avgChampMasteryPer) * g2;
          acc.mastery[key].denAvg = (acc.mastery[key].denAvg || 0) + g2;
        }
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

    const fi = r?.items?.first_item;
    if (fi && typeof fi === "object") {
      for (const [itemName, obj] of Object.entries(fi)) {
        if (!acc.items.first_item[itemName]) acc.items.first_item[itemName] = {};
        const dst = acc.items.first_item[itemName];
        for (const [k, v] of Object.entries(obj || {})) {
          if (typeof v === "number" && Number.isFinite(v)) {
            dst[k] = (dst[k] || 0) + v;          // sum counters/sums (e.g., games, next_games, *_sum_*)
          } else if (!(k in dst)) {
            dst[k] = obj[k];                     // carry non-numbers through once if present
          }
        }
      }
  }

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

  const shardsGrid = acc.shardsGrid.map((slotMap, slotIdx) => {
    const order = new Map((SHARDS_CANON[slotIdx] || []).map((n, i) => [n, i]));
    const options = Object.entries(slotMap).map(([name, v]) => {
      const g = v.games || 0;
      return { name, games: g, winRate: g ? v.wins / g : null };
    });

    // Primary: canonical order; Fallback: keep unknowns at the end by popularity
    options.sort((a, b) => {
      const ai = order.has(a.name) ? order.get(a.name) : 999;
      const bi = order.has(b.name) ? order.get(b.name) : 999;
      if (ai !== bi) return ai - bi;
      return (b.games || 0) - (a.games || 0);
    });

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
    runePathsTop: Array.from(acc.runePathsMap.entries())
      .sort((a,b)=> (b[1].games - a[1].games))
      .slice(0,5)
      .map(([key, cur]) => {
        const [keystone, r1, r2, r3, sr1, sr2] = key.split("|").map(x => (x || null));
        return {
          keystone, rune1: r1, rune2: r2, rune3: r3, subRune1: sr1, subRune2: sr2,
          games: cur.games,
          wins: cur.wins,
          share: acc.games ? (cur.games / acc.games) : 0,
          winRate: cur.games > 0 ? (cur.wins / cur.games) : null,
        };
      }),
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
          wins: w, // <-- add this so the table can derive WR when winRate is missing
          share: totalG ? g / totalG : 0,
          winRate: g ? w / g : null,
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

      // NEW: tiered boots in ALL-patches view
      bootsTiered: {
        tier1: toRows(acc.items.boots_t1, acc.games),
        tier2: toRows(acc.items.boots_t2, acc.games),
        tier3: toRows(acc.items.boots_t3, acc.games),
      },

      // keep legacy for compatibility (unused if bootsTiered exists)
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
      
      })),
      first_item: acc.items.first_item
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

  // Safe defaults so "__ALL__" never crashes if a section is missing
  const C = useMemo(() => ({
    games: 0,
    wins: 0,
    winRate: null,

    // sections that are often missing in "__ALL__" until exporter/UI are aligned
    opponents: [],
    mastery: null,
    items: {},                 // { starter, support, boots:{tier1,tier2,footwear}, first10min, legendary:{...} }
    shardsGrid: [[], [], []],  // 3 rows

    ...(cur || {})
  }), [cur]);
  // --- MATCHUPS: compute EB score (heavily games-weighted) ---
  // --- MATCHUPS: compute EB score (light smoothing, follows observed WR) ---
  function matchupScore(wins, games, prior = 0.5, K = 50) {
    const alpha = prior * K, beta = (1 - prior) * K;
    return games > 0 ? (wins + alpha) / (games + alpha + beta) : prior;
  }

  // require real opponent data; skip if we don't have wins nor winRate
  const rawOpp =
    Array.isArray(C?.opponents) ? C.opponents :
    Array.isArray(C?.topOpponents) ? C.topOpponents.map(o => ({
      opponentChamp: o.opponentChamp,
      games: o.games,
      wins: Math.round((C?.winRate ?? 0.5) * (o.games || 0)),
    })) : [];  
  
  
  // Our DB already stores *our* wins in o.wins.
  // So do NOT subtract; just use o.wins directly.
  const scoredOpp = (Array.isArray(rawOpp) ? rawOpp : [])
    .filter(o => o && o.opponentChamp && (o.games || 0) > 0 && (o.wins != null))
    .map(o => {
      const games   = o.games || 0;
      const wins    = o.wins  || 0;        // <- our wins directly from DB
      const wr      = games ? wins / games : null;  // our WR vs that champ
      const vsScore = matchupScore(wins, games, 0.5, 50); // light smoothing
      return { enemy: o.opponentChamp, games, wins, winRate: wr, vsScore };
    });

  // Global scale for Tier letters
  const sMin = Math.min(...scoredOpp.map(x => x.vsScore));
  const sMax = Math.max(...scoredOpp.map(x => x.vsScore));
  const span = (isFinite(sMin) && isFinite(sMax) && sMax > sMin) ? (sMax - sMin) : 1;
  const MIN_MATCHUP_GAMES_PRIMARY = 50; // cap
  const MIN_MATCHUP_GAMES_SECOND  = 10; // soft fallback
  const MIN_MATCHUP_GAMES_FRACTION = 0.01; // 1% of this champ's total games

  const withIdx = scoredOpp.map(x => ({
    ...x,
    vsIdx: Math.round(100 * (x.vsScore - sMin) / span)
  }));

  // champ games for dynamic thresholding
  const champGames = C?.games || 0;
  // use the *smaller* of (fixed cap, % of this champ's games),
  // but never below the SECOND floor
  const dynPrimary = Math.max(
    MIN_MATCHUP_GAMES_SECOND,
    Math.min(MIN_MATCHUP_GAMES_PRIMARY, Math.round(champGames * MIN_MATCHUP_GAMES_FRACTION))
  );

// 1) Apply game floors ONCE to decide eligibility
const primary = withIdx.filter(r => (r.games || 0) >= dynPrimary);
let pool = primary.length
  ? primary
  : withIdx.filter(r => (r.games || 0) >= MIN_MATCHUP_GAMES_SECOND);

// If we *still* have too few rows, fall back to *all* opponents
if (pool.length < 8) pool = withIdx;

  // 2) Sort once by our score (desc = best first, tie-break by more games)
  const sortedDesc = [...pool].sort(
    (a, b) => (b.vsScore - a.vsScore) || (b.games - a.games)
  );

  // 3) Size for each list
  const N = Math.min(10, Math.floor(sortedDesc.length / 2));

  // 4) Enforce sign on WR for each table
  let positivesDesc = sortedDesc.filter(r => (r.winRate ?? 0.5) > 0.5);
  let negativesDesc = sortedDesc.filter(r => (r.winRate ?? 0.5) < 0.5);

  // 4a) If positives are too few, re-check with *all* opponents (ignoring floors) but still keep sign
  if (positivesDesc.length < Math.min(5, N)) {
    const allSorted = [...withIdx].sort((a,b)=>(b.vsScore-a.vsScore)||(b.games-a.games));
    positivesDesc = allSorted.filter(r => (r.winRate ?? 0.5) > 0.5);
  }
  if (negativesDesc.length < Math.min(5, N)) {
    const allSorted = [...withIdx].sort((a,b)=>(b.vsScore-a.vsScore)||(b.games-a.games));
    negativesDesc = allSorted.filter(r => (r.winRate ?? 0.5) < 0.5);
  }

  const best10  = positivesDesc.slice(0, N);
  const worst10 = [...negativesDesc.slice(-N)].reverse();

  // helper to render shard grid (3 columns, top 3 options per slot)
  const ShardGrid = ({ grid }) => {
  if (!Array.isArray(grid) || grid.length !== 3) return null;

  const ROW_TITLES = ["Offense", "Flex", "Defense"];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border border-neutral-800 text-sm">
        <thead className="bg-neutral-800/40">
          <tr>
            <th className="border border-neutral-800 px-2 py-1 text-left text-xs text-neutral-300">
              Slot
            </th>
            <th className="border border-neutral-800 px-2 py-1 text-center text-xs text-neutral-300">
              1st
            </th>
            <th className="border border-neutral-800 px-2 py-1 text-center text-xs text-neutral-300">
              2nd
            </th>
            <th className="border border-neutral-800 px-2 py-1 text-center text-xs text-neutral-300">
              3rd
            </th>
          </tr>
        </thead>
        <tbody>
          {ROW_TITLES.map((title, rowIdx) => {
            const opts = grid[rowIdx]?.options?.slice(0, 3) || [];
            return (
              <tr key={title}>
                {/* Left label cell */}
                <td className="border border-neutral-800 px-2 py-1 font-semibold">
                  {title}
                </td>

                {/* Up to 3 options side by side */}
                {Array.from({ length: 3 }).map((_, colIdx) => {
                  const opt = opts[colIdx];
                  return (
                    <td
                      key={colIdx}
                      className="border border-neutral-800 px-2 py-1 text-center align-top"
                    >
                      {opt ? (
                        <div className="flex flex-col items-center gap-1">
                          <ShardIcon name={opt?.name} size={32} />
                          <span className="text-xs">{opt?.name}</span>
                          <span className="text-[11px] text-neutral-400">
                            {opt?.winRate == null
                              ? "–"
                              : `${(opt.winRate * 100).toFixed(0)}%`} •{" "}
                            {opt?.games || 0}
                          </span>
                        </div>
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
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
          <div className="text-2xl font-bold text-neutral-100 inline-flex items-center gap-2">
           {displayName}
           {(() => {
             const share = cur?.mastery?.BestMastery?.share; // fraction 0..1 in current role
             const isOTP = share != null && share >= OTP_THRESH;
             return isOTP ? (
               <span
                 className="text-[11px] px-1.5 py-0.5 rounded-full border border-amber-500/60 bg-amber-500/10 text-amber-300"
                 title={`Best mastery players account for ${(share*100).toFixed(0)}% of games in this role`}
               >
                 OTP
               </span>
             ) : null;
           })()}
         </div>
          <div className="text-sm text-neutral-400">
            {patch === "__ALL__" ? "All patches" : `Patch ${patch}`} • Role {role} • {int(C?.games || cur?.games || 0)} games
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
    <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      {/* LEFT COLUMN: compact metrics + rune paths table */}
      <div className="space-y-4">
        <CompactStatsTable
          rows={[
            { label: "GD@5",           value: num(cur?.avgGoldDiffAt5,1) },
            { label: "GD@10",          value: num(cur?.avgGoldDiffAt10,1) },
            { label: "CS@10",          value: num(cur?.avgCsAt10,2) },
            { label: "CSD@10",         value: num(cur?.avgCsDiffAt10,2) },
            { label: "DPM",            value: num(cur?.avgDPM,1) },
            { label: "Team FB Tower",  value: (cur?.teamFBTowerRate != null ? (cur.teamFBTowerRate*100).toFixed(1)+"%" : "–") },
          ]}
        />

        <RunePathsTable rows={cur?.runePathsTop || []} version={ddVersion} />
      </div>      

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
                        {((c.winRate ?? 0) * 100).toFixed(0)}% WR{" "}
                        <span className="opacity-70">• {fmtInt(c.games)} games</span>
                      </div>
                      <div className="opacity-80">
                        {uses.map((u, j) => (u != null ? u.toFixed(1) : "–")).join(" / ")} avg uses
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {spells.map((name, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1">
                          <SpellIcon name={name} version={ddVersion} />
                          <span>{name}</span>
                          {idx === 0 && spells.length === 2 && <span className="opacity-40 mx-1">+</span>}
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="text-sm opacity-70">No summoner data</div>
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
    {/* Bottom of page: First Item Comparison */}
    <div className="mt-6">
      <FirstItemComparison
        data={cur?.items?.first_item}
        version={ddVersion}
        itemIndex={itemIndex}
      />
    </div>    
    
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
              best_mastery_games_sum: 0,
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
          acc.best_mastery_games_sum += (r.bestMasteryGames || 0);
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
        const bestG = acc.best_mastery_games_sum || 0;        
        const bestShare = g ? bestG / g : 0; 
        return {
          champion: acc.champion,
          championSlug: acc.championSlug,
          games: g,
          bestMasteryGames: acc.best_mastery_games_sum,             
          bestMasteryShare: g ? acc.best_mastery_games_sum / g : 0,
          otp: bestShare >= OTP_THRESH, 
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

  const otpFromAllBySlug = useMemo(() => {
    const map = Object.create(null);
    const allRows = boards?.roles?.ALL || [];
    for (const r of allRows) {
      const share = getBestMasteryShare(r);
      const isOtp = r?.otp === true || (share != null && share >= OTP_THRESH);
      if (isOtp && r?.championSlug) map[r.championSlug] = true;
    }
    return map;
  }, [boards]);

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


const currentRows = useMemo(() => {
  if (!boards?.roles) return [];
  const base = boards.roles[role] || [];

  const totalGames = base.reduce((s, r) => s + (r.games || 0), 0);
  const totalWins  = base.reduce((s, r) => s + (r.games || 0) * (r.winRate || 0), 0);
  const mu = totalGames ? totalWins / totalGames : 0.5;

  const K = 2000;
  const withScore = base.map(r => ({
    ...r,
    score: ( (r.games || 0) * (r.winRate || 0) + K * mu ) / ((r.games || 0) + K),
  }));

  const sMin = Math.min(...withScore.map(r => r.score ?? Infinity));
  const sMax = Math.max(...withScore.map(r => r.score ?? -Infinity));
  const span = (isFinite(sMin) && isFinite(sMax) && sMax > sMin) ? (sMax - sMin) : 1;

  const scored = withScore.map(r => ({
    ...r,
    scoreIdx: Math.round(100 * ((r.score ?? mu) - sMin) / span),
    scoreDeltaPP: ((r.score ?? mu) - mu) * 100,
  }));

  const filtered = scored.filter(r => (r.games || 0) >= 100);
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
      {/* --- Leaderboards --- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Leaderboards</h2>
          <label className="text-sm">Patch:</label>
          <select className="border rounded px-2 py-1 bg-neutral-900 border-neutral-800" value={patch} onChange={e=>setPatch(e.target.value)}>
            <option value="__ALL__">All patches</option>
            {(patches || []).map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <label className="text-sm ml-2">Role:</label>
          <select className="bg-neutral-900 text-neutral-100 border border-neutral-700 rounded p-2" value={role} onChange={e=>setRole(e.target.value)}>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

       {loadingBoards ? (
          <TableSkeleton rows={8} cols={8} />
        ) : (
          <LeaderboardTable
            rows={currentRows}
            role={role}
            patch={patch}
            otpFromAllBySlug={otpFromAllBySlug}
          />
        )}
      </section>
    </main>
    </div>
  );
}

function AppRouter() {
  const location = useLocation();

  return (
    <AnimatedRoutes location={location}>
      <Routes location={location}>
        <Route
          path="/"
          element={
            <PageFade>
              <Home /> {/* see Section 3 to keep your data-driven table here */}
            </PageFade>
          }
        />
        <Route
          path="/champions/:slug"
          element={
            <PageFade>
              <ChampionPage />
            </PageFade>
          }
        />
      </Routes>
    </AnimatedRoutes>
  );
}

export default AppRouter;