-- Regression tests for the corrected TAIMAKO November savings promotion.
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
\i server/db/november-promo-v238.sql

INSERT INTO accounts(username,role) VALUES ('10001','regular'),('10002','regular'),('10003','regular');

-- First-year N60,000: 1 amount-based share + 1 bonus share per month; one month has 3.
INSERT INTO transactions(account_id,reference,transaction_type,destination,amount,status,created_at)
SELECT id,'cash-nov-1','cash_credit','REGULAR',30000,'approved','2026-11-05T10:00:00Z'
FROM accounts WHERE username='10001';
INSERT INTO payment_requests(reference,created_at) VALUES ('transfer-nov-1','2026-11-28T10:00:00Z');
INSERT INTO transactions(account_id,reference,transaction_type,destination,amount,status,created_at)
SELECT id,'transfer-nov-1','bank_transfer','TARGET',30000,'approved','2026-12-02T10:00:00Z'
FROM accounts WHERE username='10001';

DO $$
DECLARE award_count INTEGER; share_total INTEGER; month_count INTEGER; double_months INTEGER; min_month DATE; max_month DATE; threshold NUMERIC; min_shares INTEGER; max_shares INTEGER;
BEGIN
  SELECT COUNT(*) INTO award_count FROM tmcs_november_promo_awards_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2026;
  SELECT COALESCE(SUM(share_count),0),COUNT(*),COUNT(*) FILTER (WHERE share_count=3),MIN(period_month),MAX(period_month),MIN(share_count),MAX(share_count)
  INTO share_total,month_count,double_months,min_month,max_month,min_shares,max_shares
  FROM tmcs_november_promo_share_allocations_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2026;
  SELECT required_amount INTO threshold FROM tmcs_november_promo_awards_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2026;
  IF award_count<>1 OR threshold<>60000 THEN RAISE EXCEPTION 'First-year 60,000 qualification failed'; END IF;
  IF share_total<>23 OR month_count<>11 OR double_months<>1 OR min_month<>DATE '2026-11-01' OR max_month<>DATE '2027-09-01' OR min_shares<>2 OR max_shares<>3 THEN
    RAISE EXCEPTION 'Expected 23 promo shares over 11 months (2 monthly, one month 3), got shares %, months %, triple months %, range % to %, min/max %/%',share_total,month_count,double_months,min_month,max_month,min_shares,max_shares;
  END IF;
END $$;

-- Extra N60,000 must be paid in November to grow allocation to 3 per month, one month 4.
INSERT INTO transactions(account_id,transaction_type,destination,amount,status,created_at)
SELECT id,'cash_credit','REGULAR',60000,'approved','2026-12-05T10:00:00Z'
FROM accounts WHERE username='10001';
DO $$ BEGIN
  IF (SELECT SUM(share_count) FROM tmcs_november_promo_share_allocations_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2026)<>23 THEN
    RAISE EXCEPTION 'December payment incorrectly increased November promotional shares';
  END IF;
END $$;

-- Repeat year requires N120,000. N60,000 alone does not qualify.
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
DO $$ DECLARE threshold NUMERIC; shares INTEGER; min_shares INTEGER; max_shares INTEGER;
BEGIN
  SELECT required_amount INTO threshold FROM tmcs_november_promo_awards_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2027;
  SELECT COALESCE(SUM(share_count),0),MIN(share_count),MAX(share_count) INTO shares,min_shares,max_shares FROM tmcs_november_promo_share_allocations_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2027;
  IF threshold<>120000 OR shares<>34 OR min_shares<>3 OR max_shares<>4 THEN RAISE EXCEPTION 'Repeat-year N120,000 allocation failed'; END IF;
END $$;

-- N180,000 in November gives 3 amount-based shares + 1 bonus monthly, with one month 5.
INSERT INTO transactions(account_id,transaction_type,destination,amount,status,created_at)
SELECT id,'cash_credit','REGULAR',180000,'approved','2026-11-12T10:00:00Z'
FROM accounts WHERE username='10002';
DO $$ DECLARE shares INTEGER; min_shares INTEGER; max_shares INTEGER;
BEGIN
  SELECT SUM(share_count),MIN(share_count),MAX(share_count) INTO shares,min_shares,max_shares FROM tmcs_november_promo_share_allocations_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10002') AND promo_year=2026;
  IF shares<>45 OR min_shares<>4 OR max_shares<>5 THEN RAISE EXCEPTION 'N180,000 monthly share-unit allocation failed'; END IF;
END $$;

-- Advance saving is excluded.
INSERT INTO transactions(account_id,transaction_type,destination,amount,status,created_at)
SELECT id,'advance_saving','REGULAR',120000,'approved','2028-11-05T10:00:00Z'
FROM accounts WHERE username='10001';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM tmcs_november_promo_awards_v237 WHERE account_id=(SELECT id FROM accounts WHERE username='10001') AND promo_year=2028) THEN
    RAISE EXCEPTION 'Advance saving incorrectly qualified for the November promotion';
  END IF;
END $$;
ROLLBACK;
