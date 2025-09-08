async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
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

  function section(id, rows, opts={}) {
    const el = document.getElementById(id);
    const cols = [
      { label: opts.nameLabel || "Name", key: "name" },
      { label: "Winrate %", key: "winrate" },
      { label: "Games", key: "games" }
    ];
    el.innerHTML = listTable(rows, cols.map(c => ({...c, toString(){return c.label;}})));
  }

  function render() {
    title.innerText = `${name} — ${role}`;
    renderAverages();

    const prof = champions[name].roles[role] || {};
    section("teammates", prof.teammates || []);
    section("opponentsBest", prof.opponents_best || [], { nameLabel: "Opponent (best)" });
    section("opponentsWorst", prof.opponents_worst || [], { nameLabel: "Opponent (worst)" });
    section("spells", prof.top_spells || [], { nameLabel: "Spell Pair" });
    section("starters", prof.starter_items || [], { nameLabel: "Starter" });
    section("boots", prof.boots || [], { nameLabel: "Boots" });
    section("tier3boots", prof.tier3_boots || [], { nameLabel: "Tier 3 Boots" });
    section("items", prof.items || [], { nameLabel: "Item" });
    section("skillorder", prof.skillorder || [], { nameLabel: "Order" });
    section("runes", prof.runes || [], { nameLabel: "Runeset" });
  }

  renderRolePills();
  render();
})();