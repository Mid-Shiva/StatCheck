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

  const COLUMNS = [
    { key: "rank",  label: "#", align: "left", accessor: (_r, i) => i+1, render: (_r, i) => i+1, sortable: false },
    { key: "champ", label: "Champion", align: "left", accessor: r => r.champion,
      render: r => <Link className="text-blue-600 hover:underline" to={`/champions/${r.championSlug || r.champion?.toLowerCase?.().replace(/[^a-z0-9]+/g,"")}`}>{r.champion}</Link>,
      sortable: true},
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
                  {c.key === "rank" ? (i + 1) : c.render(r, i)}
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

  const ItemTable = ({ title, rows }) => {
  // filter again on the client defensively (in case older JSONs don’t filter)
  const safeRows = Array.isArray(rows) ? rows.filter(r => (r.share ?? 0) >= 0.01) : [];
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
                  <td className="px-2 py-1">
                    <span title={tooltip}>{r.item}</span>
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
    topOpponents: {},
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

    // Opponents
    (r.topOpponents || []).forEach(o=>{
      acc.topOpponents[o.opponentChamp] = sum(acc.topOpponents[o.opponentChamp], o.games);
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

  const topOpponents = Object.entries(acc.topOpponents)
    .map(([opponentChamp,games])=>({opponentChamp, games}))
    .sort((a,b)=> b.games-a.games).slice(0,10);

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
    topOpponents,
    shardsGrid,
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
      <h1 className="text-2xl font-semibold tracking-tight">{meta?.name || slug}</h1>
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

    {/* Items */}
    <section className="space-y-4">
      <ItemTable title="Starter Items" rows={cur?.items?.starter || []} />
      {Array.isArray(cur?.items?.support) && cur.items.support.length > 0 && (
        <ItemTable title="Support Item" rows={cur.items.support} />
      )}
      {/* Boots */}
      <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
        <div className="text-sm font-semibold mb-2">Boots</div>
        {cur?.items?.boots?.footwear ? (
          <div className="text-xs mb-2 text-neutral-300">
            Magical Footwear: {pct0(cur.items.boots.footwear.share)} • Avg time {fmtTime(cur.items.boots.footwear.avg_time_s)}
          </div>
        ) : null}
        <ItemTable title="Boots – Options" rows={cur?.items?.boots?.options || []} />
      </div>

      <ItemTable title="First 10 min Items" rows={cur?.items?.first10 || []} />
      <LegendaryTables data={cur?.items?.legendary || []} />
    </section>

    {/* Opponents */}
    <section className="bg-neutral-900 border border-neutral-800 rounded p-3">
      <div className="text-sm font-semibold mb-2">Most played vs (Top 10)</div>
      <ol className="text-sm grid sm:grid-cols-2 lg:grid-cols-3 gap-1 list-decimal list-inside">
        {(cur?.topOpponents || []).slice(0,10).map((o,i)=>(
          <li key={i} className="flex justify-between gap-2">
            <span>{o.opponentChamp}</span>
            <span className="text-neutral-400">{fmtInt(o.games)} games</span>
          </li>
        ))}
      </ol>
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

  const currentRows = useMemo(() => {
    if (!boards || !boards.roles) return [];
    return (boards.roles[role] || []).filter(r => (r.games ?? 0) >= 100);
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