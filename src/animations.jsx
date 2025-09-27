// animations.jsx — drop‑in helpers to add tasteful motion and polish
// ---------------------------------------------------------------
// Usage guide is at the bottom of this file. Everything here is optional —
// import the bits you want and plug them into your existing components.

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

// 1) Page/container fade + slide — great for route transitions
export function PageFade({ children, y = 16, duration = 0.25 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -y }}
      transition={{ duration, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// 2) AnimatedRoutes — wrap your <Routes/> to animate route changes
//    Place inside a <BrowserRouter>.
export function AnimatedRoutes({ location, children }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// 3) MotionTableRow — subtle lift on hover + smooth resorting with layout
export function MotionTableRow({ children, className = "", ...rest }) {
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.18 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.tr>
  );
}

// 4) AnimatedBar — replace hard jumps with smooth fills
//    Value is 0–100 (percentage). Optional label renders a "TierScore 87" chip.
export function AnimatedBar({ value = 0, label = null }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 rounded bg-neutral-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="h-2 bg-blue-500"
        />
      </div>
      {label ? (
        <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200">
          {label}
        </span>
      ) : null}
    </div>
  );
}

// 5) GlowImg — add a tasteful ring + glow on hover for icons/avatars
export function GlowImg({ className = "", ring = "ring-amber-400/60", glow = "bg-amber-400/40", size = 48, ...props }) {
  return (
    <div className={`relative inline-block`} style={{ width: size, height: size }}>
      <div className={`absolute -inset-2 rounded-full blur-md ${glow} opacity-20`} />
      <img
        {...props}
        width={size}
        height={size}
        className={`rounded-full ring-2 ring-transparent group-hover:${ring} transition duration-300 ${className}`}
      />
    </div>
  );
}

// 6) Skeleton — quick shimmer blocks for loading states
export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-neutral-800/70 rounded ${className}`} />;
}

export function TableSkeleton({ rows = 6, cols = 6 }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
      <div className="text-sm font-semibold mb-2">Loading…</div>
      <div className="space-y-2">
        {[...Array(rows)].map((_, r) => (
          <div key={r} className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 8 }}>
            {[...Array(cols)].map((__, c) => (
              <Skeleton key={c} className="h-6" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// 7) SoftCard — tiny hover/press animation for cards/sections
export function SoftCard({ className = "", children, ...rest }) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.12 }}
      className={`rounded-xl border border-neutral-800 bg-neutral-900 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
