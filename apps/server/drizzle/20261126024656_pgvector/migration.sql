-- pgvector, for the assistant's recall and knowledge. drizzle-kit can't create extensions, so this migration is
-- custom (`drizzle-kit generate --custom`), as drizzle documents.
CREATE EXTENSION IF NOT EXISTS vector;
