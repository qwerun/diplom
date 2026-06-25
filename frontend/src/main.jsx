import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./layouts/AppLayout.jsx";
import ActivityDetailPage from "./pages/ActivityDetailPage.jsx";
import CampaignDetailPage from "./pages/CampaignDetailPage.jsx";
import CampaignsPage from "./pages/CampaignsPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import DictionariesPage from "./pages/DictionariesPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import "./styles/app.css";

function ProtectedRoute({ children }) {
  // Временный учебный комментарий: это простая защита маршрутов на фронте.
  // Настоящая защита прав все равно находится на backend permissions.
  return localStorage.getItem("accessToken") ? children : <Navigate to="/login" replace />;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="activities/:id" element={<ActivityDetailPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="dictionaries" element={<DictionariesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
