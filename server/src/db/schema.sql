CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES managers(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  next_token_number INTEGER NOT NULL DEFAULT 1 CHECK (next_token_number > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (manager_id, name)
);

CREATE TABLE IF NOT EXISTS tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  token_number INTEGER NOT NULL CHECK (token_number > 0),
  person_name VARCHAR(100) NOT NULL,
  phone VARCHAR(30),
  position INTEGER,
  status VARCHAR(12) NOT NULL DEFAULT 'WAITING'
    CHECK (status IN ('WAITING', 'SERVING', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  service_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  UNIQUE (queue_id, token_number),
  CHECK ((status IN ('WAITING', 'SERVING') AND position IS NOT NULL)
      OR (status IN ('COMPLETED', 'CANCELLED') AND position IS NULL))
);

CREATE INDEX IF NOT EXISTS queues_manager_idx ON queues(manager_id);
CREATE INDEX IF NOT EXISTS tokens_queue_order_idx ON tokens(queue_id, position)
  WHERE status IN ('WAITING', 'SERVING');
CREATE UNIQUE INDEX IF NOT EXISTS tokens_one_serving_per_queue_idx ON tokens(queue_id)
  WHERE status = 'SERVING';
CREATE INDEX IF NOT EXISTS tokens_queue_created_idx ON tokens(queue_id, created_at);
CREATE INDEX IF NOT EXISTS tokens_status_created_idx ON tokens(status, created_at);
