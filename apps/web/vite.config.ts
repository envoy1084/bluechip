import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  // The browser only talks to the web app's origin; in development Vite forwards the server's paths to it.
  const server = loadEnv(mode, import.meta.dirname, "")["SERVER_ORIGIN"] ?? "http://localhost:4000"
  return {
    plugins: [tailwindcss(), tanstackStart(), viteReact()],
    server: { proxy: { "/api": server, "/auth": server } }
  }
})
