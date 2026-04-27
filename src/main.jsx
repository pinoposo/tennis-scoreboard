import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Monitor from "./Monitor.jsx";
import "./index.css";

const pathname = window.location.pathname.toLowerCase();
const isMonitorRoute = pathname.startsWith("/monitor");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isMonitorRoute ? <Monitor /> : <App />}
  </React.StrictMode>
);