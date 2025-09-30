import { useState, useEffect } from "react";
export function useItemIndex(version) {
  const [idx, setIdx] = useState(null);
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`, { cache: "force-cache" });
        const json = await res.json();
        const map = new Map();
        for (const [id, it] of Object.entries(json?.data || {})) {
          const key = normName(it?.name || "");
          if (key && !map.has(key)) map.set(key, id);
        }
        map.set("boots", "1001"); // Tier-1 "Boots"
        setIdx(map);
      } catch {
        if (!ignore) setIdx(null);
      }
    })();
    return () => { ignore = true; };
  }, [version]);
  return idx;
}

// <ItemIcon name="Plated Steelcaps" version={ver} itemIndex={idx} />
