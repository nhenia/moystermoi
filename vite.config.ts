import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// BASE_PATH is set by the GitHub Pages deploy (e.g. "/clutched/"). Locally the app runs at "/".
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
})
