import { useEffect, useMemo, useState, } from "react";
import { BrowserRouter, Routes, Route, Link, useParams, useSearchParams, useLocation } from "react-router-dom";
import { PageFade, AnimatedRoutes, MotionTableRow, AnimatedBar, GlowImg, TableSkeleton, SoftCard } from "./animations";
import MasteryIcon from "./components/MasteryIcon";
import ChampionIcon from "./components/ChampionIcon";
import ItemIcon from "./components/ItemIcon";
import SpellIcon from "./components/SpellIcon";
import RuneKeystoneIcon from "./components/RuneKeystoneIcon";
import RuneIcon from "./components/RuneIcon";
import RunePathsTable from "./components/RunePathsTable";
import CompactStatsTable from "./components/CompactStatsTable";
import ShardIcon from "./components/ShardIcon";
import Card from "./components/Card";
import OtpBadge from "./components/OtpBadge";
import Chart from "./components/Chart";
import LeaderboardTable from "./components/LeaderboardTable";
import ChampionPage from "./components/ChampionPage";
import MatchupTable from "./components/MatchupTable";
import Home from "./components/Home";
import AppRouter from "./components/AppRouter";

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
function FirstItemComparison({ data, version, itemIndex }) {
  if (!data || typeof data !== "object") return null;

  const statLabels = {
    gamesNext: "Games",
    noSecondPct: "No 2nd %",
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

    return {
      name,
      hasNext,
      gamesFirst: gFirst,
      gamesNext: gNext,
      noSecondPct: (hasNext && gFirst > 0) ? (1 - (gNext / gFirst)) : null,

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
      BelowTop5Mastery:  { games: 0, wins: 0, sumAvg: 0, denAvg: 0 }, // avg not shown later
    },
    shardsGrid: [ {}, {}, {} ],
    summonerCombos: {},
    items: {
      starter: {},
      support: {},
      boots: {},                 // legacy “final boots” catcher (kept)
      footwear_games: 0,
      footwear_sum_time: 0,
      // NEW: hold tiered boots while aggregating
      boots_t1: {},              // map: name -> { games, wins }
      boots_t2: {},
      boots_t3: {},
      first10: {},
      legendary: []
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

