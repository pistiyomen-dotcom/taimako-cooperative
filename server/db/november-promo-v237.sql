-- TAIMAKO November savings promotion, stage 237.
-- The actual payment remains in its real payment month. Only bonus shares are allocated Nov-Sep.
CREATE TABLE IF NOT EXISTS tmcs_november_promo_awards_v237 (
  id BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  promo_year INTEGER NOT NULL,
  savings_type VARCHAR(20) NOT NULL CHECK (savings_type IN ('REGULAR','TARGET','CONSTANT','WELFARE')),
  qualifying_transaction_id BIGINT NOT NULL REFERENCES transactions(id),
  required_amount NUMERIC(14,2) NOT NULL CHECK (required_amount IN (60000,120000)),
  qualifying_savings_amount NUMERIC(14,2) NOT NULL,
  bonus_shares INTEGER NOT NULL DEFAULT 12 CHECK (bonus_shares = 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id,promo_year)
);
CREATE INDEX IF NOT EXISTS idx_tmcs_nov_promo_awards_account
  ON tmcs_november_promo_awards_v237(account_id,promo_year);

CREATE TABLE IF NOT EXISTS tmcs_november_promo_share_allocations_v237 (
  id BIGSERIAL PRIMARY KEY,
  award_id BIGINT NOT NULL REFERENCES tmcs_november_promo_awards_v237(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  savings_type VARCHAR(20) NOT NULL CHECK (savings_type IN ('REGULAR','TARGET','CONSTANT','WELFARE')),
  promo_year INTEGER NOT NULL,
  period_month DATE NOT NULL,
  share_count INTEGER NOT NULL CHECK (share_count IN (1,2)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(award_id,period_month)
);
CREATE INDEX IF NOT EXISTS idx_tmcs_nov_promo_share_month
  ON tmcs_november_promo_share_allocations_v237(account_id,savings_type,period_month);

CREATE OR REPLACE FUNCTION tmcs_november_promo_eligibility_v237() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  promo_date_v TIMESTAMPTZ;
  promo_year_v INTEGER;
  prior_awards_v INTEGER;
  required_amount_v NUMERIC(14,2);
  november_total_v NUMERIC(14,2);
  extra_month_offset_v INTEGER;
  month_offset_v INTEGER;
  period_month_v DATE;
  award_id_v BIGINT;
BEGIN
  IF COALESCE(NEW.destination,'') NOT IN ('REGULAR','TARGET','CONSTANT','WELFARE')
     OR NEW.amount <= 0
     OR NEW.status NOT IN ('approved','completed')
     OR COALESCE(NEW.transaction_type,'') ~* '(loan|repay|interest|dividend|charge|fee|withdraw|bonus|refund|revers|registration|membership|application|advance)'
  THEN
    RETURN NEW;
  END IF;

  -- Use the payment request date where available, so a payment submitted in November
  -- still qualifies if an administrator approves it later.
  SELECT COALESCE(
    (SELECT p.created_at FROM payment_requests p WHERE p.reference=NEW.reference LIMIT 1),
    NEW.created_at
  ) INTO promo_date_v;

  IF EXTRACT(MONTH FROM promo_date_v) <> 11 THEN
    RETURN NEW;
  END IF;
  promo_year_v := EXTRACT(YEAR FROM promo_date_v)::INTEGER;

  -- Serialize qualification checks for the same member.
  PERFORM 1 FROM accounts WHERE id=NEW.account_id FOR UPDATE;

  SELECT COUNT(*)::INTEGER INTO prior_awards_v
  FROM tmcs_november_promo_awards_v237
  WHERE account_id=NEW.account_id AND promo_year < promo_year_v;

  required_amount_v := CASE WHEN prior_awards_v > 0 THEN 120000 ELSE 60000 END;

  SELECT COALESCE(SUM(t.amount),0) INTO november_total_v
  FROM transactions t
  LEFT JOIN payment_requests p ON p.reference=t.reference
  WHERE t.account_id=NEW.account_id
    AND t.destination IN ('REGULAR','TARGET','CONSTANT','WELFARE')
    AND t.amount > 0
    AND t.status IN ('approved','completed')
    AND COALESCE(t.transaction_type,'') !~* '(loan|repay|interest|dividend|charge|fee|withdraw|bonus|refund|revers|registration|membership|application|advance)'
    AND EXTRACT(MONTH FROM COALESCE(p.created_at,t.created_at))=11
    AND EXTRACT(YEAR FROM COALESCE(p.created_at,t.created_at))=promo_year_v;

  IF november_total_v < required_amount_v THEN
    RETURN NEW;
  END IF;

  INSERT INTO tmcs_november_promo_awards_v237
    (account_id,promo_year,savings_type,qualifying_transaction_id,required_amount,qualifying_savings_amount,bonus_shares)
  VALUES
    (NEW.account_id,promo_year_v,NEW.destination,NEW.id,required_amount_v,november_total_v,12)
  ON CONFLICT(account_id,promo_year) DO NOTHING
  RETURNING id INTO award_id_v;

  IF award_id_v IS NULL THEN
    RETURN NEW;
  END IF;

  -- November through September is 11 months: one share each month plus one
  -- extra share assigned randomly to exactly one of those months (12 total).
  extra_month_offset_v := FLOOR(RANDOM()*11)::INTEGER;
  FOR month_offset_v IN 0..10 LOOP
    period_month_v := (MAKE_DATE(promo_year_v,11,1) + MAKE_INTERVAL(months => month_offset_v))::DATE;
    INSERT INTO tmcs_november_promo_share_allocations_v237
      (award_id,account_id,savings_type,promo_year,period_month,share_count)
    VALUES
      (award_id_v,NEW.account_id,NEW.destination,promo_year_v,period_month_v,
       1 + CASE WHEN month_offset_v=extra_month_offset_v THEN 1 ELSE 0 END);
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tmcs_november_promo_transaction_v237 ON transactions;
CREATE TRIGGER tmcs_november_promo_transaction_v237
AFTER INSERT OR UPDATE OF status ON transactions
FOR EACH ROW EXECUTE FUNCTION tmcs_november_promo_eligibility_v237();
