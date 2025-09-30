export const BASE = import.meta.env.BASE_URL;

export const DDRAGON_VER_FALLBACK = "15.18.1";

export const MF_ICON =
  "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/MagicalFootwear/MagicalFootwear.png";

export const CHAMP_ID_EXCEPT = {
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

export const I = r.items||{};

export const C = useMemo(() => ({
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

export const MIN_MATCHUP_GAMES_PRIMARY = 50;

const MIN_MATCHUP_GAMES_SECOND  = 10;

export const MIN_MATCHUP_GAMES_FRACTION = 0.01;

export const N = Math.min(10, Math.floor(sortedDesc.length / 2));

export const ROW_TITLES = ["Offense", "Flex", "Defense"];

