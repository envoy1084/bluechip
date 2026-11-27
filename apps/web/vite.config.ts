import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  // The browser only talks to the web app's origin; in development Vite forwards the server's paths to it.
  const server = loadEnv(mode, import.meta.dirname, "")["SERVER_ORIGIN"] ?? "http://localhost:8080"
  return {
    plugins: [tailwindcss(), tanstackStart(), viteReact()],
    // The release analytics and telemetry report, as the server's (`npm_package_version` when built by pnpm).
    define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env["npm_package_version"] ?? "0.0.0") },
    server: { proxy: { "/api": server, "/auth": server } }
  }
})
