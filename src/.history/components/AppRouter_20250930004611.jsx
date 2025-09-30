import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { PageFade, AnimatedRoutes } from "../animations";

import Home from "./Home";                // ← add this
import ChampionPage from "./ChampionPage"; // ← and this

export default function AppRouter() {
  const location = useLocation();

  return (
    <AnimatedRoutes location={location}>
      <Routes location={location}>
        <Route
          path="/"
          element={
            <PageFade>
              <Home />
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