import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "@fontsource/unifrakturmaguntia/400.css"
import "@fontsource/bodoni-moda/800.css"
import "@fontsource/bodoni-moda/800-italic.css"
import "@fontsource/atkinson-hyperlegible/400.css"
import "@fontsource/atkinson-hyperlegible/700.css"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline cache (production only): the app shell and restaurant list keep working on bad signal.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {})
  })
}
