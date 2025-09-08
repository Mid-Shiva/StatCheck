// champion.js — resilient renderer for champion page

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return res.json();
}

// ---------- utils ----------
function qs(name){ const u=new URLSearchParams(location.search); return u.get(name)||""; }
function num(n){ return (n===null||n===undefined)?"":n; }
function setHTMLIfExists(id,html){ const el=document.getElementById(id); if(el) el.innerHTML=html; }
function escapeHTML(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"); }
function pick(obj, keys, fallback=[]){ if(!obj) return fallback; for(const k of keys){ const v=obj[k]; if(Array.isArray(v)&&v.length) return v; } return fallback; }
function pills(roles,active){ return roles.map(r=>`<button class="pill" data-role="${r}" aria-current="${r===active?'true':'false'}">${r}</button>`).join(" "); }

function itemTooltip(row){
  const bits=[];
  if(row.avg_minute!=null) bits.push(`${row.avg_minute}m`);
  if(row.avg_level!=null) bits.push(`lvl ${row.avg_level}`);
  if(row.avg_golddiff!=null) bits.push(`${row.avg_golddiff>=0?"+":""}${row.avg_golddiff}g`);
  if(row.avg_leveldiff!=null) bits.push(`${row.avg_leveldiff>=0?"+":""}${row.avg_leveldiff} lvl diff`);
  return bits.length?`Avg: ${bits.join(" • ")}`:"";
}

// ---------- item name + minute ----------
function cleanItemName(name){
  let s=String(name||"").trim();
  s=s.replace(/^(?:[-+]?[\d.,]+(?:\s+|[,;]\s*))+/, "");        // leading numerics
  s=s.replace(/,\s*\d+(?:\.\d+)?\s*$/, "");                     // trailing ",3"
  s=s.replace(/\s+\d+(?:[.,]\d+)?(?:\s+[-\d.]+){0,4}\s*$/, ""); // trailing blobs
  s=s.trim();
  if(!/[A-Za-z]/.test(s)) return "";
  return s;
}
function avgBuyMinute(row){
  for(const k of ["avg_minute","avgMinute","avg_min","minute","min","avg_buy_minute"]){
    const v=row?.[k]; if(v!==undefined && v!==null && String(v)!=="") return Number(v);
  }
  const sources=[row?.name,row?.item,row?.display];
  for(const src of sources){
    if(!src) continue;
    const s=String(src);
    const mComma=s.match(/,\s*(\d+(?:\.\d+)?)/); if(mComma) return Number(mComma[1]);
    const mLast=s.match(/(\d+(?:\.\d+)?)(?!.*\d)/); if(mLast) return Number(mLast[1]);
  }
  return null;
}

// ---------- tiny table builder (Name first, numeric right-aligned via CSS) ----------
function tableRanked(rows, cols){
  if(!rows || rows.length===0) return "<p class='muted'>No data.</p>";
  const thead="<tr>"+cols.map(c=>`<th data-col="${c.label??c}">${c.label??c}</th>`).join("")+"</tr>";
  const tbody=rows.map(r=>{
    return "<tr>"+cols.map(c=>{
      const key=c.key ?? c.label?.toLowerCase() ?? String(c).toLowerCase();
      const val=c.render?c.render(r):r[key];
      const isNum=["Rank","games","winrate","avg_kda","avg_dpm","avg_length","avg_cs10","avg_golddiv10","avg_kp","avg_minute"].includes(key);
      return `<td data-key="${key}" class="${isNum?"num":""}">${num(val)}</td>`;
    }).join("")+"</tr>";
  }).join("");
  return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}
function sectionRanked({id,rows,nameLabel="Name"}){
  setHTMLIfExists(id, tableRanked(rows, [
    {label:nameLabel,key:"name"},
    {label:"Winrate %",key:"winrate"},
    {label:"Games",key:"games"}
  ]));
}
function sectionGrouped({id,groups,headingPrefix}){
  const el=document.getElementById(id); if(!el) return;
  if(!groups || Object.keys(groups).length===0){ el.innerHTML="<p class='muted'>No data.</p>"; return; }
  el.innerHTML = Object.entries(groups).map(([role,rows])=>{
    const t = tableRanked(rows, [
      {label:"Name",key:"name"},
      {label:"Winrate %",key:"winrate"},
      {label:"Games",key:"games"},
      {label:"Rank",key:"Rank"}
    ]);
    return `<h4 style="margin:8px 0">${headingPrefix} – ${role}</h4>${t}`;
  }).join("");
}

// Items with minute badge before the name
function sectionItems({id,rows,nameLabel}){
  if(!rows || rows.length===0){ setHTMLIfExists(id,"<p class='muted'>No data.</p>"); return; }
  const cleaned = rows.map(r=>{
    const raw=r.name||r.item||r.display||"";
    const nm=cleanItemName(raw);
    if(!nm) return null;
    const minute = (r.avg_minute!=null)?r.avg_minute:avgBuyMinute({name:raw});
    return {name:nm, avg_minute:minute, winrate:r.winrate, games:r.games};
  }).filter(Boolean);

  if(!cleaned.length){ setHTMLIfExists(id,"<p class='muted'>No data.</p>"); return; }

  const badge = m => (m==null||m==="") ? "" : `<span class="badge">${m}m</span> `;
  const thead = `
    <tr>
      <th>${nameLabel}</th>
      <th data-col="winrate">Winrate %</th>
      <th data-col="games">Games</th>
    </tr>`.trim();

  const tbody = cleaned.map(r=>`
    <tr>
      <td>${badge(r.avg_minute)}${escapeHTML(r.name)}</td>
      <td data-key="winrate" class="num">${num(r.winrate)}</td>
      <td data-key="games" class="num">${num(r.games)}</td>
    </tr>`).join("");

  setHTMLIfExists(id, `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`);
}

// ---------- app ----------
(async function init(){
  const champions = await loadJSON("./data/champions.json");

  // case-insensitive champion match
  const nameParam = qs("name");
  const nameKey = Object.keys(champions).find(k => k.toLowerCase()===nameParam.toLowerCase());
  if(!nameKey){ setHTMLIfExists("title","Champion not found"); return; }
  const name = nameKey;

  // role UI
  let role = qs("role");
  const rolePills = document.getElementById("rolePills");
  const title = document.getElementById("title");
  const averages = document.getElementById("averages");

  function renderRolePills(){
    const roles = Object.keys(champions[name].roles || {});
    role = role && roles.includes(role) ? role : (roles[0]||"");
    if(rolePills){
      rolePills.innerHTML = pills(roles, role);
      rolePills.querySelectorAll("button").forEach(b=>{
        b.addEventListener("click", ()=>{
          role=b.dataset.role;
          history.replaceState(null,"",`?name=${encodeURIComponent(name)}&role=${encodeURIComponent(role)}`);
          render();
          rolePills.querySelectorAll("button").forEach(x=>{
            x.classList.toggle("active", x.dataset.role===role);
            x.setAttribute("aria-current", x.dataset.role===role ? "true" : "false");
          });
        });
      });
    }
  }

  function renderAverages(){
    const r = champions[name].roles[role];
    const kv = [
      ["Games", r.games], ["Winrate %", r.winrate], ["KDA", r.avg_kda], ["DPM", r.avg_dpm],
      ["Game length (m)", r.avg_length], ["CS @10", r.avg_cs10], ["GoldDiff @10", r.avg_golddiv10], ["KP %", r.avg_kp],
    ];
    if(averages){
      averages.innerHTML = kv.map(([k,v]) =>
        `<div class="card" style="margin:0"><div class="muted">${k}</div><div style="font-size:20px">${num(v)}</div></div>`
      ).join("");
    }
  }

  function render(){
    if(title) title.innerText = `${name} — ${role}`;
    renderAverages();

    const prof = champions[name].roles[role] || {};

    // Summoner Spells
    const summSpells = pick(prof, ["summonerSpells","summoner_spells","SummonerSpells","spells","summoners"]);
    const spellsHTML = tableRanked(summSpells, [
      {label:"Spells", key:"name"},
      {label:"Winrate %", key:"winrate"},
      {label:"Games", key:"games"},
    ]);
    setHTMLIfExists("spells", spellsHTML);

    // Duos by role
    const duosByRole = prof.duosByRole || prof.duos_by_role || null;
    if(duosByRole) sectionGrouped({ id:"duosByRole", groups:duosByRole, headingPrefix:"Best Duos" });
    else setHTMLIfExists("duosByRole","<p class='muted'>No data.</p>");

    // Best Other Teammates: exclude roles used by duosByRole
    const matesByRole = prof.teammatesByRole || prof.teammates_by_role || {};
    const excluded = new Set(Object.keys(duosByRole || {}));
    const merged = new Map(); // name -> {games,wins}
    for(const [allyRole, rows] of Object.entries(matesByRole)){
      if(excluded.has(allyRole)) continue;
      for(const r of (rows||[])){
        const nm=r.name||""; const g=+r.games||0; const wr=+r.winrate||0;
        if(!nm || g<=0) continue;
        const cur = merged.get(nm) || {games:0,wins:0};
        cur.games += g; cur.wins += (wr/100)*g;
        merged.set(nm, cur);
      }
    }
    let other = Array.from(merged.values()).map((x,i)=>({
      name: [...merged.keys()][i],
      games: x.games,
      winrate: x.games ? Math.round((x.wins/x.games)*1000)/10 : 0
    }));
    // keep top 10 by games
    other.sort((a,b)=>b.games-a.games); other = other.slice(0,10);
    other.forEach((r,i)=>r.Rank=i+1);
    setHTMLIfExists("otherTeammates", tableRanked(other, [
      {label:"Rank",key:"Rank"},
      {label:"Name",key:"name"},
      {label:"Winrate %",key:"winrate"},
      {label:"Games",key:"games"},
    ]));

    // Opponents
    sectionRanked({ id:"opponentsGood", rows: prof.opponents_good || [], nameLabel:"Opponent" });
    sectionRanked({ id:"opponentsBad",  rows: prof.opponents_bad  || [], nameLabel:"Opponent" });

    // Items
    sectionRanked({ id:"starters", rows: prof.starter_items || [], nameLabel:"Starter" });
    sectionRanked({ id:"trinkets", rows: prof.trinkets || [], nameLabel:"Trinket" });
    sectionItems({ id:"first10", rows: prof.first10_items || prof.first10Items || [], nameLabel:"First 10m" });
    sectionItems({ id:"boots", rows: prof.boots || [], nameLabel:"Boots" });
    sectionItems({ id:"tier3boots", rows: prof.tier3_boots || prof.tier3Boots || [], nameLabel:"Tier 3 Boots" });
    sectionItems({ id:"items", rows: prof.items || prof.coreItems || prof.core_items || [], nameLabel:"Item" });

    // Runes & Skill order
    sectionRanked({ id:"skillorder", rows: prof.skillorder || prof.skillOrder || [], nameLabel:"Order" });
    sectionRanked({ id:"runes", rows: prof.runes || prof.runeSets || [], nameLabel:"Runeset" });
  }

  renderRolePills();
  render();
})();