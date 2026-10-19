-- Qurilish Qalqoni — ma'lumotlar bazasi sxemasi (idempotent)

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  full_name       text NOT NULL,
  role            text NOT NULL CHECK (role IN ('admin','nazoratchi','prorab','kuzatuvchi')),
  password_hash   text NOT NULL,
  totp_secret_enc text,
  totp_enabled    boolean NOT NULL DEFAULT false,
  totp_last_step  bigint NOT NULL DEFAULT 0,
  must_change_pw  boolean NOT NULL DEFAULT false,
  failed_logins   int NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  telegram_chat_id text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_login_at   timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip           text,
  user_agent   text,
  mfa_pending  boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS rate_events (
  bucket text NOT NULL,
  at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_events_idx ON rate_events (bucket, at);

CREATE TABLE IF NOT EXISTS sites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  address    text NOT NULL DEFAULT '',
  floors     int NOT NULL DEFAULT 1 CHECK (floors BETWEEN 1 AND 200),
  is_demo    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name         text NOT NULL,
  key_id       text NOT NULL UNIQUE,
  secret_enc   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz
);

CREATE TABLE IF NOT EXISTS cameras (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  code             text NOT NULL,
  name             text NOT NULL,
  floor            text NOT NULL DEFAULT '',
  device_id        uuid REFERENCES devices(id) ON DELETE SET NULL,
  last_seen_at     timestamptz,
  last_snapshot    bytea,
  last_snapshot_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, code)
);

CREATE TABLE IF NOT EXISTS zones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id       uuid NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  name            text NOT NULL,
  type            text NOT NULL CHECK (type IN ('lift','zina','deraza','tok','kran','chuqur','boshqa')),
  points          jsonb NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  warn_distance_m numeric(4,1) NOT NULL DEFAULT 2.0,
  allowed_roles   text[] NOT NULL DEFAULT '{}',
  signal_siren    boolean NOT NULL DEFAULT true,
  signal_voice    boolean NOT NULL DEFAULT true,
  signal_telegram boolean NOT NULL DEFAULT true,
  signal_sms      boolean NOT NULL DEFAULT false,
  active_from     time NOT NULL DEFAULT '00:00',
  active_to       time NOT NULL DEFAULT '23:59',
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zones_camera_idx ON zones (camera_id);

CREATE TABLE IF NOT EXISTS alerts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  camera_id        uuid REFERENCES cameras(id) ON DELETE SET NULL,
  zone_id          uuid REFERENCES zones(id) ON DELETE SET NULL,
  type             text NOT NULL CHECK (type IN ('no_helmet','no_vest','no_harness','zone_intrusion','person_down','after_hours','other')),
  severity         text NOT NULL CHECK (severity IN ('kritik','yuqori','orta')),
  status           text NOT NULL DEFAULT 'yangi' CHECK (status IN ('yangi','korib','hal')),
  detail           text NOT NULL DEFAULT '',
  source           text NOT NULL DEFAULT 'device' CHECK (source IN ('device','browser','demo')),
  event_uid        text NOT NULL UNIQUE,
  snapshot         bytea,
  detected_at      timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  assignee_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at  timestamptz,
  resolved_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at      timestamptz,
  false_positive   boolean NOT NULL DEFAULT false,
  escalation_level int NOT NULL DEFAULT 0,
  notes            text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS alerts_site_time_idx ON alerts (site_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts (status, severity);

CREATE TABLE IF NOT EXISTS daily_stats (
  site_id         uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  day             date NOT NULL,
  persons_checked int NOT NULL DEFAULT 0,
  ppe_violations  int NOT NULL DEFAULT 0,
  PRIMARY KEY (site_id, day)
);

CREATE TABLE IF NOT EXISTS workers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id              uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  full_name            text NOT NULL,
  trade                text NOT NULL DEFAULT '',
  brigade              text NOT NULL DEFAULT '',
  badge_code           text,
  phone                text NOT NULL DEFAULT '',
  training_valid_until date,
  active               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id      bigserial PRIMARY KEY,
  at      timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action  text NOT NULL,
  target  text NOT NULL DEFAULT '',
  ip      text,
  meta    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS audit_at_idx ON audit_log (at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS workers_badge_uq ON workers (site_id, badge_code) WHERE badge_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS cameras_device_idx ON cameras (device_id);
