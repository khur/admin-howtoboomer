import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <h1 className="p-8 text-2xl">Ht,B Admin</h1>
  </StrictMode>,
);
