import React, { useEffect, useMemo, useState } from "react";
import { PageFade, AnimatedRoutes, MotionTableRow, AnimatedBar, GlowImg, TableSkeleton, SoftCard } from "../animations";
import { getJSON} from "../utils/helpers";
import { BASE} from "../utils/constants";
import LeaderboardTable from "./LeaderboardTable";
import { getBestMasteryShare } from "../utils/helpers";

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

export default Home;
