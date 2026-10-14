-- Regression tests for the TAIMAKO November savings promotion.
BEGIN;
CREATE TABLE accounts (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE,
  role TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE payment_requests (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT REFERENCES accounts(id),
  reference TEXT,
  transaction_type TEXT NOT NULL,
  destination TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
\i server/db/november-promo-v237.sql

INSERT INTO accounts(username,role) VALUES ('10001','regular'),('10002','regular');

-- First year: savings across types total 60,000 in November.
INSERT INTO transactions(account_id,reference,transaction_type,destination,amount,status,created_at)
SELECT id,'cash-nov-1','cash_credit','REGULAR',30000,'approved','2026-11-05T10:00:00Z'
FROM accounts WHERE username='10001';
INSERT INTO payment_requests(reference,created_at) VALUES ('transfer-nov-1','2026-11-28T10:00:00Z');
-- Approval happens in December, but the request/payment was submitted in November.
INSERT INTO transactions(account_id,reference,transaction_type,destination,amount,status,created_at)
SELECT id,'transfer-nov-1','bank_transfer','TARGET',30000,'approved','2026-12-02T10:00:00Z'
FROM accounts WHERE username='10001';

DO $$
DECLARE award_count INTEGER; share_total INTEGER; month_count INTEGER; double_months INTEGER; min_month DATE; max_month DATE; threshold NUMERIC;
BEGIN
  SELECT COUNT(*) INTO award_count FROM tmcs_november_promo_awards_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2026;
  SELECT COALESCE(SUM(share_count),0),COUNT(*),COUNT(*) FILTER (WHERE share_count=2),MIN(period_month),MAX(period_month)
  INTO share_total,month_count,double_months,min_month,max_month
  FROM tmcs_november_promo_share_allocations_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2026;
  SELECT required_amount INTO threshold FROM tmcs_november_promo_awards_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2026;
  IF award_count<>1 OR threshold<>60000 THEN RAISE EXCEPTION 'First-year 60,000 qualification failed'; END IF;
  IF share_total<>12 OR month_count<>11 OR double_months<>1 OR min_month<>DATE '2026-11-01' OR max_month<>DATE '2027-09-01' THEN
    RAISE EXCEPTION 'Expected 12 bonus shares over 11 months Nov-Sep, got shares %, months %, double months %, range % to %',share_total,month_count,double_months,min_month,max_month;
  END IF;
END $$;

-- The next year requires 120,000, not 60,000.
INSERT INTO transactions(account_id,transaction_type,destination,amount,status,created_at)
SELECT id,'cash_credit','REGULAR',60000,'approved','2027-11-05T10:00:00Z'
FROM accounts WHERE username='10001';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM tmcs_november_promo_awards_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2027) THEN
    RAISE EXCEPTION 'Repeat-year bonus incorrectly awarded at 60,000';
  END IF;
END $$;
INSERT INTO transactions(account_id,transaction_type,destination,amount,status,created_at)
SELECT id,'cash_credit','REGULAR',60000,'approved','2027-11-20T10:00:00Z'
FROM accounts WHERE username='10001';
DO $$ DECLARE threshold NUMERIC; shares INTEGER;
BEGIN
  SELECT required_amount INTO threshold FROM tmcs_november_promo_awards_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2027;
  SELECT COALESCE(SUM(share_count),0) INTO shares FROM tmcs_november_promo_share_allocations_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2027;
  IF threshold<>120000 OR shares<>12 THEN RAISE EXCEPTION 'Repeat-year 120,000 qualification failed'; END IF;
END $$;

-- Advance saving is excluded; ordinary November savings still need to reach 120,000.
INSERT INTO transactions(account_id,transaction_type,destination,amount,status,created_at)
SELECT id,'advance_saving','REGULAR',120000,'approved','2028-11-05T10:00:00Z'
FROM accounts WHERE username='10001';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM tmcs_november_promo_awards_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2028) THEN
    RAISE EXCEPTION 'Advance saving incorrectly qualified for the November promotion';
  END IF;
END $$;
INSERT INTO transactions(account_id,transaction_type,destination,amount,status,created_at)
SELECT id,'cash_credit','WELFARE',119999,'approved','2028-11-06T10:00:00Z'
FROM accounts WHERE username='10001';
INSERT INTO transactions(account_id,transaction_type,destination,amount,status,created_at)
SELECT id,'cash_credit','WELFARE',1,'approved','2028-11-07T10:00:00Z'
FROM accounts WHERE username='10001';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM tmcs_november_promo_awards_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2028 AND required_amount=120000) THEN
    RAISE EXCEPTION 'Ordinary savings did not qualify at 120,000 after excluding advance saving';
  END IF;
END $$;

-- A member who has never received the bonus still qualifies at 60,000.
INSERT INTO transactions(account_id,transaction_type,destination,amount,status,created_at)
SELECT id,'cash_credit','CONSTANT',60000,'approved','2026-11-12T10:00:00Z'
FROM accounts WHERE username='10002';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM tmcs_november_promo_awards_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10002') AND promo_year=2026 AND required_amount=60000) THEN
    RAISE EXCEPTION 'First-time member did not qualify at 60,000';
  END IF;
END $$;
ROLLBACK;
