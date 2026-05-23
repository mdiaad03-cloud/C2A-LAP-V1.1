import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App";
import StoreApp from "./store/StoreApp";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/store/*" element={<StoreApp />} />
            <Route path="/admin" element={<App />} />
            <Route path="/admin/*" element={<App />} />
            <Route path="/" element={<Navigate to="/store" replace />} />
            <Route path="*" element={<Navigate to="/store" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
