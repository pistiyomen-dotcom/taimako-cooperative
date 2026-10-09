-- Stage for administrator-assisted account access. Do not apply until
-- all protected endpoints enforce session and atomic operator attribution.
CREATE TABLE IF NOT EXISTS member_assistance_sessions (
  id BIGSERIAL PRIMARY KEY,
  operator_account_id BIGINT NOT NULL REFERENCES accounts(id),
  member_account_id BIGINT NOT NULL REFERENCES accounts(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  CHECK (operator_account_id <> member_account_id)
);
CREATE INDEX IF NOT EXISTS idx_member_assistance_operator ON member_assistance_sessions(operator_account_id,expires_at);
CREATE TABLE IF NOT EXISTS member_assistance_actions (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES member_assistance_sessions(id),
  operator_account_id BIGINT NOT NULL REFERENCES accounts(id),
  member_account_id BIGINT NOT NULL REFERENCES accounts(id),
  action_code TEXT NOT NULL,
  transaction_id BIGINT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_assistance_member ON member_assistance_actions(member_account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_member_assistance_operator ON member_assistance_actions(operator_account_id,created_at DESC);
