async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function tableHTML(rows, hasRank = true) {
  if (!rows || rows.length === 0) return "<p class='muted'>No data.</p>";
  const cols = ["champion"].concat(hasRank ? ["Rank"] : []).concat(
    ["games","winrate","avg_kda","avg_dpm","avg_length","avg_cs10","avg_golddiv10","avg_kp"].filter(c => c in rows[0])
  );
  const thead = "<tr>" + cols.map(c => `<th>${c.replace(/_/g," ")}</th>`).join("") + "</tr>";
  const tbody = rows.map(r => {
    return "<tr>" + cols.map(c => `<td>${r[c] ?? ""}</td>`).join("") + "</tr>";
  }).join("");
  return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function renderOverall(lb) {
  const normal = lb.overall.normal;
  const experimental = lb.overall.experimental;
  return `
    <div class="section">
      <div class="section-title">Normal Leaderboard (≥500 games)</div>
      ${tableHTML(normal, true)}
    </div>
    <div class="section">
      <div class="section-title">Experimental Picks (&lt;500 games)</div>
      ${tableHTML(experimental, true)}
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

(async function init() {
  const content = document.getElementById("content");
  const roleTabs = document.getElementById("roleTabs");
  const leaderboards = await loadJSON("./data/leaderboards.json");
  // champions.json is available if you want detail pages later:
  // const champions = await loadJSON("./data/champions.json");

  function setActive(btn) {
    [...roleTabs.querySelectorAll("button")].forEach(b => b.classList.toggle("active", b === btn));
  }

  function show(role) {
    if (role === "overall") {
      content.innerHTML = renderOverall(leaderboards);
    } else {
      content.innerHTML = renderRole(leaderboards, role);
    }
  }

  roleTabs.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    setActive(btn);
    show(btn.dataset.role);
  });

  // initial
  show("overall");
})();