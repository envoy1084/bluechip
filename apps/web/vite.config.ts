import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The browser only talks to the web app's origin; in development Vite forwards the server's paths to it.
const server = process.env.SERVER_ORIGIN ?? "http://localhost:4000"

export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  server: { proxy: { "/api": server, "/auth": server } }
})
