import { useState, useEffect } from "react";
export function useDdragonVersion() {  
  const [ver, setVer] = useState(null);
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", { cache: "no-store" });
        const arr = await res.json();
        if (!ignore) setVer(arr?.[0] || DDRAGON_VER_FALLBACK);
      } catch {
        if (!ignore) setVer(DDRAGON_VER_FALLBACK);
      }
    })();
    return () => { ignore = true; };
  }, []);
  return ver || DDRAGON_VER_FALLBACK;
}

// load mastery icons from disk
