import React, { useEffect, useMemo, useState } from "react";
import { Link, Routes, Route, useParams, useSearchParams, useLocation } from "react-router-dom";
import { PageFade, AnimatedRoutes, MotionTableRow, AnimatedBar, GlowImg, TableSkeleton, SoftCard } from "../animations";
import m1 from "../assets/mastery/m1.png";
import m2 from "../assets/mastery/m2.png";
import m3 from "../assets/mastery/m3.png";
import m4 from "../assets/mastery/m4.png";
import m5 from "../assets/mastery/m5.png";
import m6 from "../assets/mastery/m6.png";
import m7 from "../assets/mastery/m7.png";
const MASTERY_ICONS = { 1: m1, 2: m2, 3: m3, 4: m4, 5: m5, 6: m6, 7: m7 };

export default function MasteryIcon({ level = 7, size = 42, className = "" }) {
  const L = Math.min(Math.max(1, Number(level) || 7), 7);
  const src = MASTERY_ICONS[L];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={`Mastery ${L}`}
      width={size}
      height={size}
      className={className}
      loading="lazy"
      title={`Mastery ${L}`}
    />
  );
}

// <ChampionIcon name="Aatrox" version={ver} />
