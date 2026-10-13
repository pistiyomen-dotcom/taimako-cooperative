-- TAIMAKO REFERRAL BONUS, stage 233. Apply after existing tables exist.
CREATE TABLE IF NOT EXISTS member_referrals (
  referred_account_id BIGINT PRIMARY KEY REFERENCES accounts(id),
  referrer_account_id BIGINT NOT NULL REFERENCES accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (referred_account_id <> referrer_account_id)
);
CREATE INDEX IF NOT EXISTS idx_member_referrals_referrer ON member_referrals(referrer_account_id);
CREATE TABLE IF NOT EXISTS referral_bonus_awards (
  referred_account_id BIGINT PRIMARY KEY REFERENCES accounts(id),
  referrer_account_id BIGINT NOT NULL REFERENCES accounts(id),
  qualifying_transaction_id BIGINT NOT NULL UNIQUE REFERENCES transactions(id),
  amount NUMERIC(14,2) NOT NULL DEFAULT 500.00 CHECK (amount = 500.00),
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_bonus_awards_referrer ON referral_bonus_awards(referrer_account_id);
-- Award on the first successful savings credit, inside the very same database transaction.
CREATE OR REPLACE FUNCTION tmcs_referral_first_saving_v233() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  sponsor BIGINT;
BEGIN
  IF NEW.destination NOT IN ('REGULAR','TARGET','CONSTANT','WELFARE')
     OR NEW.amount <= 0 OR NEW.status NOT IN ('approved','completed')
     OR NEW.transaction_type ~* '(loan|repay|interest|dividend|charge|fee|withdraw|bonus|refund|revers|registration|membership|application)'
  THEN RETURN NEW; END IF;
  SELECT referrer_account_id INTO sponsor FROM member_referrals
  WHERE referred_account_id=NEW.account_id FOR UPDATE;
  IF sponsor IS NULL THEN RETURN NEW; END IF;
  -- Never pay for a later savings entry, even if the earlier one occurred
  -- before an administrator linked the referral.
  IF EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.account_id=NEW.account_id AND t.id<>NEW.id
      AND t.destination IN ('REGULAR','TARGET','CONSTANT','WELFARE')
      AND t.amount>0 AND t.status IN ('approved','completed')
      AND t.transaction_type !~* '(loan|repay|interest|dividend|charge|fee|withdraw|bonus|refund|revers|registration|membership|application)'
      AND (t.created_at < NEW.created_at OR (t.created_at=NEW.created_at AND t.id<NEW.id))
  ) THEN RETURN NEW; END IF;
  INSERT INTO referral_bonus_awards
      (referred_account_id,referrer_account_id,qualifying_transaction_id)
  VALUES(NEW.account_id,sponsor,NEW.id)
  ON CONFLICT(referred_account_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tmcs_referral_transaction_v233 ON transactions;
CREATE TRIGGER tmcs_referral_transaction_v233
AFTER INSERT OR UPDATE OF status ON transactions
FOR EACH ROW EXECUTE FUNCTION tmcs_referral_first_saving_v233();
