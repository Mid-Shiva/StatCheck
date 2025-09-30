import { useMemo, useState, useEffect } from "react";
export function useOtpShare(slug, patch, role) {
  const [share, setShare] = useState(null);

  useEffect(() => {    
    if (!slug || !role || !patch) { setShare(null); return; }
    const rKey = normalizeRoleKey(role);
    const fileSlug = String(slug).toLowerCase();
    let cancelled = false;
    const key = `${fileSlug}|${patch}|${rKey}`;
    if (_otpCache.has(key)) {
      setShare(_otpCache.get(key));
      return;
    }
    (async () => {
      let s = null;
      try {
        const j = await getJSON(`${BASE}data/champions/${fileSlug}.json`, null);
        const data = j?.data;
        if (!data) { s = null; return; }

        const pickShareFromRoleBucket = (bucket) => {
          if (!bucket) return null;
          if (bucket?.mastery?.BestMastery?.share != null) return Number(bucket.mastery.BestMastery.share);
          // derive if games are present
          const g = bucket?.games || 0;
          const bestG = bucket?.mastery?.BestMastery?.games ?? bucket?.bestMasteryGames;
          if (Number.isFinite(bestG) && g > 0) return bestG / g;
          return null;
        };

        if (patch === "__ALL__") {
          // Weight across all patches by games for this role
          let best = 0, total = 0;
          for (const [p, byRole] of Object.entries(data)) {
            const bucket = byRole?.[rKey];
            if (!bucket) continue;
            const g = bucket?.games || 0;
            const bestG = bucket?.mastery?.BestMastery?.games ?? bucket?.bestMasteryGames ?? Math.round((bucket?.mastery?.BestMastery?.share ?? 0) * g);
            best += (bestG || 0);
            total += g;
          }
          s = total > 0 ? best / total : null;
        } else {
          // exact patch, else nearest previous, else latest available
          let bucket = data?.[patch]?.[rKey];
          
if (!bucket) {
  // choose the closest patch that actually has this role bucket
  const tgt = _parsePatchTuple(patch);
  let bestKey = null;
  let bestDist = Infinity;
  for (const pKey of Object.keys(data)) {
    const br = data?.[pKey]?.[role];
    if (!br) continue;
    const cand = _parsePatchTuple(pKey);
    const dist = Math.abs(cand[0]-tgt[0]) * 10000 + Math.abs(cand[1]-tgt[1]) * 100 + Math.abs(cand[2]-tgt[2]);
    if (dist < bestDist) { bestDist = dist; bestKey = pKey; }
  }
  bucket = bestKey ? data[bestKey][rKey] : null;
}
s = pickShareFromRoleBucket(bucket);
        }
      } catch (e) {
        // ignore; keep s = null
        console?.debug?.("OTP share fetch failed", slug, patch, role, e);
      } finally {
        if (!cancelled) {
          _otpCache.set(key, s);
          setShare(s);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [slug, patch, role]);

  return share;
}
