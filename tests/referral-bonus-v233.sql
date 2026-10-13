-- Transactional regression tests for referral bonus award (standalone test DB).
BEGIN;
CREATE TABLE accounts (
 id BIGSERIAL PRIMARY KEY, username TEXT UNIQUE, role TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE transactions (
 id BIGSERIAL PRIMARY KEY, account_id BIGINT REFERENCES accounts(id),
 transaction_type TEXT NOT NULL, destination TEXT NOT NULL,
 amount NUMERIC(14,2) NOT NULL, status TEXT NOT NULL,
 created_at TIMESTAMPTZ DEFAULT NOW()
);
\i server/db/referral-bonus-v233.sql
INSERT INTO accounts(username,role) VALUES ('10001','regular'),('10002','regular'),('10003','regular'),('10004','regular');
INSERT INTO member_referrals(referred_account_id,referrer_account_id)
 SELECT c.id,p.id FROM accounts c JOIN accounts p ON p.username='10001'
 WHERE c.username IN ('10002','10003','10004');
-- Pending and non-savings transactions never qualify.
INSERT INTO transactions(account_id,transaction_type,destination,amount,status)
 SELECT id,'cash_credit','REGULAR',1000,'pending' FROM accounts WHERE username='10002';
INSERT INTO transactions(account_id,transaction_type,destination,amount,status)
 SELECT id,'loan_repayment','REGULAR',1000,'completed' FROM accounts WHERE username='10002';
DO $$ BEGIN IF (SELECT count(*) FROM referral_bonus_awards) <> 0 THEN RAISE EXCEPTION 'Pending or loan repayment awarded bonus'; END IF; END $$;
-- Approval awards once, and further qualifying savings never award again.
UPDATE transactions SET status='approved' WHERE transaction_type='cash_credit' AND status='pending';
INSERT INTO transactions(account_id,transaction_type,destination,amount,status)
 SELECT id,'cash_credit','TARGET',500,'completed' FROM accounts WHERE username='10002';
DO $$ BEGIN IF (SELECT count(*) FROM referral_bonus_awards WHERE amount=500) <> 1 THEN RAISE EXCEPTION 'Expected exactly one award after first approval'; END IF; END $$;
-- Independent referrals accumulate.
INSERT INTO transactions(account_id,transaction_type,destination,amount,status)
 SELECT id,'cash_credit','WELFARE',300,'completed' FROM accounts WHERE username IN ('10003','10004');
DO $$ DECLARE total NUMERIC; BEGIN
 SELECT COALESCE(sum(amount),0) INTO total FROM referral_bonus_awards;
 IF total <> 1500 THEN RAISE EXCEPTION 'Expected 1500 in three distinct referral awards, got %',total; END IF;
END $$;
ROLLBACK;
