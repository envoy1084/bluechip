// The server's settings in tests: its own database (created with the Postgres volume), so tests never leave
// accounts in development data.
export const testDatabaseUrl = "postgres://bluechip:bluechip@localhost:5432/bluechip_test"

export const origin = "http://localhost:3000"
