CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL, full_name varchar(120) NOT NULL, role varchar(20) NOT NULL DEFAULT 'MEMBER',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(120) NOT NULL, description text,
  resource_type varchar(30) NOT NULL, location varchar(160), capacity integer, timezone varchar(80) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE', created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource_id uuid NOT NULL REFERENCES resources(id), user_id uuid NOT NULL REFERENCES users(id),
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, status varchar(20) NOT NULL DEFAULT 'CONFIRMED', notes text,
  idempotency_key varchar(120), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_time_order CHECK (starts_at < ends_at), UNIQUE (user_id, idempotency_key)
);
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist (resource_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status = 'CONFIRMED');
CREATE TABLE IF NOT EXISTS waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource_id uuid NOT NULL REFERENCES resources(id), user_id uuid NOT NULL REFERENCES users(id),
  requested_start timestamptz NOT NULL, requested_end timestamptz NOT NULL, priority integer NOT NULL DEFAULT 0, status varchar(20) NOT NULL DEFAULT 'WAITING', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), type varchar(40) NOT NULL, title varchar(160) NOT NULL,
  message text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id uuid REFERENCES users(id), action varchar(80) NOT NULL,
  entity_type varchar(80) NOT NULL, entity_id uuid, metadata jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resources_status_idx ON resources(status);
CREATE INDEX IF NOT EXISTS resources_type_idx ON resources(resource_type);
CREATE INDEX IF NOT EXISTS bookings_resource_start_idx ON bookings(resource_id, starts_at);
CREATE INDEX IF NOT EXISTS bookings_user_start_idx ON bookings(user_id, starts_at);
CREATE INDEX IF NOT EXISTS waiting_list_priority_idx ON waiting_list(resource_id, status, priority, created_at);
CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
