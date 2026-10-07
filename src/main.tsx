/**
 * main.tsx
 * Browser entry point. Loads the self-hosted fonts and global styles, applies
 * saved display preferences to <html> before the first paint of React, then
 * mounts the app.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/besley/wght.css";
import "@fontsource-variable/besley/wght-italic.css";
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css";
import "@fontsource-variable/jetbrains-mono";
import "./styles/app.css";
import { App } from "./App";
import { APP_NAME } from "./lib/brand";
import { syncPreferencesToDocument } from "./store/preferencesStore";

syncPreferencesToDocument();
document.title = APP_NAME;

const container = document.getElementById("root");
if (!container) {
  throw new Error('index.html is missing the <div id="root"> mount point.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
