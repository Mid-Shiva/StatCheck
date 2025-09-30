// Minimal, self-contained constants used by a few components.
// Expand later as needed.

export const DDRAGON_VER_FALLBACK = "14.10.1"; // any valid DDragon version is fine
export const BASE = "";                         // set to your base path if you had one

// Lightweight placeholder icon so ItemIcon can render without importing image assets here.
export const MF_ICON =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>" +
  "<rect width='32' height='32' fill='%23222222'/>" +
  "<text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' " +
  "font-size='12' fill='%23cccccc'>?</text>" +
  "</svg>";