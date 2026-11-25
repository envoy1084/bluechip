/** The server's release, as shown by `/health` and `/api/version` (`npm_package_version` when started by pnpm). */
export const release = process.env.npm_package_version ?? "0.0.0"
