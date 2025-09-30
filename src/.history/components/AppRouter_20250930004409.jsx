import React, { useEffect, useMemo, useState } from "react";
import { Link, Routes, Route, useParams, useSearchParams, useLocation } from "react-router-dom";
import { PageFade, AnimatedRoutes, MotionTableRow, AnimatedBar, GlowImg, TableSkeleton, SoftCard } from "../animations";
export default function AppRouter() {
  const location = useLocation();

  return (
    <AnimatedRoutes location={location}>
      <Routes location={location}>
        <Route
          path="/"
          element={
            <PageFade>
              <Home /> {/* see Section 3 to keep your data-driven table here */}
            </PageFade>
          }
        />
        <Route
          path="/champions/:slug"
          element={
            <PageFade>
              <ChampionPage />
            </PageFade>
          }
        />
      </Routes>
    </AnimatedRoutes>
  );
}

