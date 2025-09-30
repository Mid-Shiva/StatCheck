// src/utils/helpers.js

// --- numbers & lookups ---
export function getNum(obj, ...keys) {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

// --- fetch JSON with a tiny safety wrapper ---
export async function getJSON(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText} ${text && `: ${text.slice(0,120)}`}`);
  }
  return res.json();
}

// --- strings / formatting helpers (safe defaults) ---
export function prettySpell(name) {
  if (!name) return "";
  // Turn e.g. "Flash" or "SummonerFlash" into "Flash"
  const s = String(name).trim();
  return s.replace(/^Summoner/i, "");
}

export function normName(raw) {
  const trimmed = (raw ?? "").toString().trim();
  if (!trimmed) return "Aatrox";
  let s = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/['’`´.]/g, "")         // quotes/periods
    .replace(/[^A-Za-z0-9 ]+/g, " "); // other punct -> space
  s = s.replace(/\b(\w)/g, (_, c) => c.toUpperCase()).replace(/\s+/g, "");
  return s || "Aatrox";
}

// Map lane/position variants to canonical role keys
export function normalizeRoleKey(role, fallbackLane = null) {
  const raw = (role ?? "").toString().trim().toUpperCase();
  if (["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"].includes(raw)) return raw;
  if (raw === "MID" || raw === "MIDDLE_LANE") return "MIDDLE";
  if (raw === "SUPPORT" || raw === "SUP" || raw === "UTILITY_LANE") return "UTILITY";
  if (raw === "ADC" || raw === "CARRY" || raw === "DUO_CARRY" || raw === "BOTTOM_LANE" || raw === "BOT") return "BOTTOM";
  if (raw === "JNG") return "JUNGLE";
  if (raw === "TOP_LANE") return "TOP";
  if (fallbackLane) {
    const ln = String(fallbackLane).trim().toUpperCase();
    if (["TOP", "JUNGLE", "MIDDLE", "BOTTOM"].includes(ln)) {
      return raw === "DUO_SUPPORT" || raw === "SUPPORT" ? "UTILITY" : ln;
    }
    if (ln === "MID") return "MIDDLE";
    if (ln === "BOT") return "BOTTOM";
  }
  return null;
}

// For code paths that try to build DDragon numeric IDs.
// If you only have string IDs, just return null and let the caller fall back.
export function toDdragonChampId(maybeId) {
  const n = Number(maybeId);
  return Number.isFinite(n) ? n : null;
}

// e.g. "14.21" -> [14, 21]
export function _parsePatchTuple(v) {
  const m = String(v ?? "").match(/(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}