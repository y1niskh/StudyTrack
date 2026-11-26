import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./styles/fridge.css";
import "./styles/board.css";
import "./styles/mobile.css";
import { applyTextScale, getTextScale } from "./lib/prefs";

applyTextScale(getTextScale());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
