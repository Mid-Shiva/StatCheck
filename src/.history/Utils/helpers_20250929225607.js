export function normalizeRoleKey(r) {
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

export function toDdragonChampId(name) {
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

export function _parsePatchTuple(p) {
  // "15.18" => [15,18], fallback to 0
  if (!p) return [0,0,0];
  const parts = String(p).split(".");
  const nums = parts.map(x => (/^\d+$/.test(x) ? parseInt(x,10) : 0));
  while (nums.length < 3) nums.push(0);
  return nums.slice(0,3);
}
