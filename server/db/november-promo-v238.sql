-- TAIMAKO November promotion correction, stage 238.
-- Promo shares are based on each full N60,000 paid during November, plus one extra share per month.
-- Cash remains recorded only in its actual payment month.
ALTER TABLE tmcs_november_promo_awards_v237
  DROP CONSTRAINT IF EXISTS tmcs_november_promo_awards_v237_bonus_shares_check;
UPDATE tmcs_november_promo_awards_v237 SET bonus_shares=1;
ALTER TABLE tmcs_november_promo_awards_v237
  ADD CONSTRAINT tmcs_november_promo_awards_v237_bonus_shares_check CHECK (bonus_shares=1);

ALTER TABLE tmcs_november_promo_share_allocations_v237
  DROP CONSTRAINT IF EXISTS tmcs_november_promo_share_allocations_v237_share_count_check;
ALTER TABLE tmcs_november_promo_share_allocations_v237
  ADD CONSTRAINT tmcs_november_promo_share_allocations_v237_share_count_check CHECK (share_count >= 1);

-- Upgrade any award rows created by the earlier 12-shares-total implementation.
WITH award_base AS (
  SELECT id, FLOOR(GREATEST(qualifying_savings_amount,60000)/60000)::INTEGER + 1 AS base_shares
  FROM tmcs_november_promo_awards_v237
), ranked AS (
  SELECT id, award_id,
         ROW_NUMBER() OVER (PARTITION BY award_id ORDER BY share_count DESC, period_month) AS month_rank
  FROM tmcs_november_promo_share_allocations_v237
)
UPDATE tmcs_november_promo_share_allocations_v237 a
SET share_count = b.base_shares + CASE WHEN r.month_rank=1 THEN 1 ELSE 0 END
FROM award_base b JOIN ranked r ON r.award_id=b.id
WHERE a.id=r.id;

CREATE OR REPLACE FUNCTION tmcs_november_promo_eligibility_v237() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  promo_date_v TIMESTAMPTZ;
  promo_year_v INTEGER;
  prior_awards_v INTEGER;
  required_amount_v NUMERIC(14,2);
  november_total_v NUMERIC(14,2);
  monthly_shares_v INTEGER;
  extra_month_offset_v INTEGER;
  month_offset_v INTEGER;
  period_month_v DATE;
  award_id_v BIGINT;
  existing_extra_month_v INTEGER;
BEGIN
  IF COALESCE(NEW.destination,'') NOT IN ('REGULAR','TARGET','CONSTANT','WELFARE')
     OR NEW.amount <= 0
     OR NEW.status NOT IN ('approved','completed')
     OR COALESCE(NEW.transaction_type,'') ~* '(loan|repay|interest|dividend|charge|fee|withdraw|bonus|refund|revers|registration|membership|application|advance)'
  THEN
    RETURN NEW;
  END IF;

  -- The November payment/request date is authoritative. December payments cannot
  -- be added to November's qualifying total, even if a prior award already exists.
  SELECT COALESCE(
    (SELECT p.created_at FROM payment_requests p WHERE p.reference=NEW.reference LIMIT 1),
    NEW.created_at
  ) INTO promo_date_v;

  IF EXTRACT(MONTH FROM promo_date_v) <> 11 THEN
    RETURN NEW;
  END IF;
  promo_year_v := EXTRACT(YEAR FROM promo_date_v)::INTEGER;

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

  -- Each full N60,000 paid in November contributes one share unit per month.
  -- Add one promotional share per month; one random month gets one further share.
  monthly_shares_v := FLOOR(november_total_v/60000)::INTEGER + 1;

  SELECT id INTO award_id_v
  FROM tmcs_november_promo_awards_v237
  WHERE account_id=NEW.account_id AND promo_year=promo_year_v;

  IF award_id_v IS NULL THEN
    INSERT INTO tmcs_november_promo_awards_v237
      (account_id,promo_year,savings_type,qualifying_transaction_id,required_amount,qualifying_savings_amount,bonus_shares)
    VALUES
      (NEW.account_id,promo_year_v,NEW.destination,NEW.id,required_amount_v,november_total_v,1)
    ON CONFLICT(account_id,promo_year) DO NOTHING
    RETURNING id INTO award_id_v;
  ELSE
    UPDATE tmcs_november_promo_awards_v237
    SET qualifying_savings_amount=november_total_v,
        required_amount=required_amount_v
    WHERE id=award_id_v;
  END IF;

  IF award_id_v IS NULL THEN
    SELECT id INTO award_id_v FROM tmcs_november_promo_awards_v237
    WHERE account_id=NEW.account_id AND promo_year=promo_year_v;
  END IF;
  IF award_id_v IS NULL THEN RETURN NEW; END IF;

  -- Preserve the previously selected extra month when the qualifying total grows.
  SELECT (EXTRACT(YEAR FROM period_month)::INTEGER-promo_year_v)*12
         + EXTRACT(MONTH FROM period_month)::INTEGER-11
  INTO existing_extra_month_v
  FROM tmcs_november_promo_share_allocations_v237
  WHERE award_id=award_id_v
  ORDER BY share_count DESC, period_month
  LIMIT 1;

  IF existing_extra_month_v IS NULL OR existing_extra_month_v < 0 OR existing_extra_month_v > 10 THEN
    extra_month_offset_v := FLOOR(RANDOM()*11)::INTEGER;
  ELSE
    extra_month_offset_v := existing_extra_month_v;
  END IF;

  FOR month_offset_v IN 0..10 LOOP
    period_month_v := (MAKE_DATE(promo_year_v,11,1) + MAKE_INTERVAL(months => month_offset_v))::DATE;
    INSERT INTO tmcs_november_promo_share_allocations_v237
      (award_id,account_id,savings_type,promo_year,period_month,share_count)
    VALUES
      (award_id_v,NEW.account_id,NEW.destination,promo_year_v,period_month_v,
       monthly_shares_v + CASE WHEN month_offset_v=extra_month_offset_v THEN 1 ELSE 0 END)
    ON CONFLICT(award_id,period_month) DO UPDATE
      SET share_count=EXCLUDED.share_count,
          savings_type=EXCLUDED.savings_type;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tmcs_november_promo_transaction_v237 ON transactions;
CREATE TRIGGER tmcs_november_promo_transaction_v237
AFTER INSERT OR UPDATE OF status ON transactions
FOR EACH ROW EXECUTE FUNCTION tmcs_november_promo_eligibility_v237();
