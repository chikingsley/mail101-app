/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { ClerkProvider } from "@clerk/clerk-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const CLERK_PUBLISHABLE_KEY =
  process.env.BUN_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  console.error(
    "DEBUG: process.env keys:",
    Object.keys(process.env).filter((k) => k.includes("CLERK"))
  );
  throw new Error(
    "Missing Clerk Publishable Key (Check BUN_PUBLIC_CLERK_PUBLISHABLE_KEY or VITE_CLERK_PUBLISHABLE_KEY)"
  );
}

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </StrictMode>
);

if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  // The hot module reloading API is not available in production.
  createRoot(elem).render(app);
}
