-- Enable required PostgreSQL extensions

CREATE EXTENSION IF NOT EXISTS vector
WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto
WITH SCHEMA extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp"
WITH SCHEMA extensions;