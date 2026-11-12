import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { installTips } from "./tooltip.js";
installTips();
createRoot(document.getElementById("root")).render(<App />);
