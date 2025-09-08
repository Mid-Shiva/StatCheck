// ---- helpers ----
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

// Parse "Champion [Role]" into {champ, role?}.
// Role is only accepted if it’s exactly one of the known roles.
const ROLES = new Set(["Top", "Jgl", "Mid", "Adc", "Sup"]);
function parseChampionAndRole(displayName) {
  const tokens = String(displayName).trim().split(/\s+/);
  if (tokens.length >= 2) {
    const maybeRole = tokens[tokens.length - 1];
    if (ROLES.has(maybeRole)) {
      const champ = tokens.slice(0, -1).join(" ");
      return { champ, role: maybeRole };
    }
  }
  return { champ: displayName.trim(), role: null };
}

function linkChampionCell(name) {
  const { champ, role } = parseChampionAndRole(name);
  const q = new URLSearchParams({ name: champ });
  if (role) q.set("role", role);
  // relative link so it works on GitHub Pages (repo subpath)
  return `<a href="./champion.html?${q.toString()}">${name}</a>`;
}

function tableHTML(rows, hasRank = true) {
  if (!rows || rows.length === 0) return "<p class='muted'>No data.</p>";

  const cols = ["champion"].concat(hasRank ? ["Rank"] : []).concat(
    ["games","winrate","avg_kda","avg_dpm","avg_length","avg_cs10","avg_golddiv10","avg_kp"]
      .filter(c => rows[0] && c in rows[0])
  );

  const thead = "<tr>" + cols
    .map(c => `<th data-col="${c}" class="sortable" role="button" tabindex="0">${c.replace(/_/g," ")}</th>`)
    .join("") + "</tr>";

  const tbody = rows.map(r => {
    return "<tr>" + cols.map(c => {
      const val = r[c] ?? "";
      if (c === "champion") return `<td>${linkChampionCell(val)}</td>`;
      return `<td>${val}</td>`;
    }).join("") + "</tr>";
  }).join("");

  return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function renderOverall(lb) {
  return `
    <div class="section">
      <div class="section-title">Normal Leaderboard (≥500 games)</div>
      ${tableHTML(lb.overall.normal, true)}
    </div>
    <div class="section">
      <div class="section-title">Experimental Picks (&lt;500 games)</div>
      ${tableHTML(lb.overall.experimental, true)}
    </div>
  `;
}

function renderRole(lb, role) {
  const r = lb.by_role[role];
  return `
    <div class="section">
      <div class="section-title">${role} — Normal (≥500 games)</div>
      ${tableHTML(r.normal, true)}
    </div>
    <div class="section">
      <div class="section-title">${role} — Experimental (&lt;500 games)</div>
      ${tableHTML(r.experimental, true)}
    </div>
  `;
}

// ---- sorting ----
function enableSorting(container) {
  const numericCols = new Set(["games","winrate","avg_kda","avg_dpm","avg_length","avg_cs10","avg_golddiv10","avg_kp","Rank"]);

  container.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => sortBy(th));
    th.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sortBy(th); }
    });
  });

  function sortBy(th) {
    const table = th.closest("table");
    const tbody = table.querySelector("tbody");
    const colIndex = Array.from(th.parentNode.children).indexOf(th);
    const colKey = th.dataset.col;
    const isNumeric = numericCols.has(colKey);

    const rows = Array.from(tbody.querySelectorAll("tr"));
    // toggle direction
    const newDir = th.dataset.dir === "asc" ? "desc" : "asc";
    // clear other headers' dir
    th.parentNode.querySelectorAll("th").forEach(x => { if (x !== th) x.dataset.dir = ""; });
    th.dataset.dir = newDir;

    rows.sort((a, b) => {
      let A = a.children[colIndex].innerText;
      let B = b.children[colIndex].innerText;
      if (isNumeric) { A = parseFloat(A) || 0; B = parseFloat(B) || 0; }
      if (A === B) return 0;
      return newDir === "asc" ? (A > B ? 1 : -1) : (A < B ? 1 : -1);
    });

    rows.forEach(r => tbody.appendChild(r));
  }
}

// ---- app init ----
(async function init() {
  const content = document.getElementById("content");
  const roleTabs = document.getElementById("roleTabs");
  const leaderboards = await loadJSON("./data/leaderboards.json");

  function setActive(btn) {
    [...roleTabs.querySelectorAll("button")]
      .forEach(b => b.classList.toggle("active", b === btn));
  }

  function show(role) {
    if (role === "overall") {
      content.innerHTML = renderOverall(leaderboards);
    } else {
      content.innerHTML = renderRole(leaderboards, role);
    }
    enableSorting(content); // (re)attach after each render
  }

  function getInitialRole() {
    const hashRole = location.hash.replace(/^#/, "");
    if (hashRole) return hashRole;
    return localStorage.getItem("activeRole") || "overall";
  }

  function activate(role) {
    const btn = roleTabs.querySelector(`button[data-role="${role}"]`)
              || roleTabs.querySelector(`button[data-role="overall"]`);
    setActive(btn);
    show(role);
    localStorage.setItem("activeRole", role);
    location.hash = role;
  }

  roleTabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    activate(btn.dataset.role);
  });

  activate(getInitialRole());
})();