/**
 * The server's release, as shown by `/health` and `/api/version`: the image's `APP_VERSION` (a build arg, the commit
 * deployed), else `npm_package_version` when started by pnpm. An empty build arg counts as none.
 */
export const release = process.env["APP_VERSION"] || process.env.npm_package_version || "0.0.0"
