import React from "react";
import ReactDOM from "react-dom";
import CssBaseline from "@material-ui/core/CssBaseline";

import App from "./App";

// Wrap everything in a try-catch to surface any silent production crash
try {
  ReactDOM.render(
    <CssBaseline>
      <App />
    </CssBaseline>,
    document.getElementById("root")
  );
} catch (err) {
  // If React fails to mount entirely, show a visible error instead of a blank screen
  console.error("Fatal React render error:", err);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="padding:40px;font-family:sans-serif;text-align:center">
        <h2>Falha ao iniciar o aplicativo</h2>
        <pre style="background:#f5f5f5;padding:16px;border-radius:8px;text-align:left;overflow:auto">
${err?.message || String(err)}
${err?.stack || ""}
        </pre>
        <button onclick="window.location.reload()">Tentar novamente</button>
      </div>
    `;
  }
}
