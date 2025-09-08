async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function itemTooltip(row) {
  const bits = [];
  if (row.avg_minute != null) bits.push(`${row.avg_minute}m`);
  if (row.avg_level != null) bits.push(`lvl ${row.avg_level}`);
  if (row.avg_golddiff != null) bits.push(`${row.avg_golddiff >= 0 ? "+" : ""}${row.avg_golddiff}g`);
  if (row.avg_leveldiff != null) bits.push(`${row.avg_leveldiff >= 0 ? "+" : ""}${row.avg_leveldiff} lvl diff`);
  return bits.length ? `Avg: ${bits.join(" • ")}` : "";
}

function sectionWithTooltips(id, rows, nameLabel) {
  const el = document.getElementById(id);
  if (!rows || rows.length === 0) {
    el.innerHTML = "<p class='muted'>No data.</p>";
    return;
  }
  const thead = `<tr><th>${nameLabel}</th><th>Winrate %</th><th>Games</th></tr>`;
  const tbody = rows.map(r => {
    const tip = itemTooltip(r);
    const nameCell = tip ? `<span title="${tip}">${r.name}</span>` : r.name;
    return `<tr><td>${nameCell}</td><td>${r.winrate ?? ""}</td><td>${r.games ?? ""}</td></tr>`;
  }).join("");
  el.innerHTML = `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function qs(name) {
  const u = new URLSearchParams(location.search);
  return u.get(name) || "";
}

function num(n) { return (n===null||n===undefined) ? "" : n; }

function listTable(rows, cols) {
  if (!rows || rows.length === 0) return "<p class='muted'>No data.</p>";
  const thead = "<tr>" + cols.map(c => `<th>${c}</th>`).join("") + "</tr>";
  const tbody = rows.map(r => {
    return "<tr>" + cols.map(c => {
      const key = c.key || c.toLowerCase();
      const val = r[key];
      return `<td>${num(val)}</td>`;
    }).join("") + "</tr>";
  }).join("");
  return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function pills(roles, active, onClick) {
  return roles.map(r => `<button class="pill" data-role="${r}" ${r===active?'style="background:#f6f6f6"':''}>${r}</button>`).join(" ");
}

(async function init() {
  const champions = await loadJSON("./data/champions.json");

  const name = qs("name"); // e.g. "Galio"
  let role = qs("role");   // optional, e.g. "Mid"

  if (!champions[name]) {
    document.getElementById("title").innerText = "Champion not found";
    return;
  }

  const title = document.getElementById("title");
  const rolePills = document.getElementById("rolePills");
  const averages = document.getElementById("averages");

  function renderRolePills() {
    const roles = Object.keys(champions[name].roles || {});
    role = role && roles.includes(role) ? role : (roles[0] || "");
    rolePills.innerHTML = pills(roles, role);
    rolePills.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        role = b.dataset.role;
        history.replaceState(null, "", `?name=${encodeURIComponent(name)}&role=${encodeURIComponent(role)}`);
        render();
      });
    });
  }

  function renderAverages() {
    const r = champions[name].roles[role];
    const kv = [
      ["Games", r.games],
      ["Winrate %", r.winrate],
      ["KDA", r.avg_kda],
      ["DPM", r.avg_dpm],
      ["Game length (m)", r.avg_length],
      ["CS @10", r.avg_cs10],
      ["GoldDiff @10", r.avg_golddiv10],
      ["KP %", r.avg_kp],
    ];
    averages.innerHTML = kv.map(([k,v]) =>
      `<div class="card" style="margin:0"><div class="muted">${k}</div><div style="font-size:20px">${num(v)}</div></div>`
    ).join("");
  }
  
  function section(id, rows, nameLabel = "Name") {
  const el = document.getElementById(id);
  if (!rows || rows.length === 0) { el.innerHTML = "<p class='muted'>No data.</p>"; return; }
  const thead = `<tr><th>${nameLabel}</th><th>Winrate %</th><th>Games</th></tr>`;
  const tbody = rows.map(r => `<tr><td>${r.name ?? ""}</td><td>${r.winrate ?? ""}</td><td>${r.games ?? ""}</td></tr>`).join("");
  el.innerHTML = `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
  }

  function sectionWithTooltips(id, rows, nameLabel) {
  const el = document.getElementById(id);
  if (!rows || rows.length === 0) {
    el.innerHTML = "<p class='muted'>No data.</p>";
    return;
  }
  const cols = ["name","winrate","games"];
  const thead = `<tr><th>${nameLabel}</th><th>Winrate %</th><th>Games</th></tr>`;
  const tbody = rows.map(r => {
    const tip = itemTooltip(r);
    const nameCell = tip ? `<span title="${tip}">${r.name}</span>` : r.name;
    return `<tr><td>${nameCell}</td><td>${r.winrate ?? ""}</td><td>${r.games ?? ""}</td></tr>`;
  }).join("");
  el.innerHTML = `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

  function render() {
  title.innerText = `${name} — ${role}`;
  renderAverages();

  const prof = champions[name].roles[role] || {};

  // NEW: duos (allowed pairs only) and teammates (broad)
  section("duos",      prof.duos          || [], "Partner");
  section("teammates", prof.teammates     || [], "Teammate");

  // REPLACED: show only role-mirrored opponents
  section("opponentsMirror", prof.opponents_mirror || [], "Opponent");

  // Items with tooltips (averages on hover where available)
  sectionWithTooltips("starters",   prof.starter_items  || [], "Starter");
  sectionWithTooltips("trinkets",   prof.trinkets       || [], "Trinket");    // NEW
  sectionWithTooltips("first10",    prof.first10_items  || [], "First 10m");
  sectionWithTooltips("boots",      prof.boots          || [], "Boots");
  sectionWithTooltips("tier3boots", prof.tier3_boots    || [], "Tier 3 Boots");
  sectionWithTooltips("items",      prof.items          || [], "Item");

  // Keep your runes/skill order sections as before
  section("skillorder", prof.skillorder || [], "Order");
  section("runes",      prof.runes      || [], "Runeset");
}

  renderRolePills();
  render();
})();