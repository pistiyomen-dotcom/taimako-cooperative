const fs=require('fs');
/* Stage 253: delete registration-only records as explicitly authorized by the cooperative. */
const p='server/db/schema.sql';
let s=fs.readFileSync(p,'utf8');
if(!s.includes('TMCS_REGISTRATION_DATA_PURGE_V253')){
s+=String.raw`

-- TMCS_REGISTRATION_DATA_PURGE_V253
-- Remove registration-specific transactions, audit entries, settings, and dedicated rows.
-- Member accounts and unrelated cooperative financial records remain untouched.
DO $tmcs_registration_purge_v253$
DECLARE t RECORD; c RECORD; predicate TEXT; col TEXT;
BEGIN
  FOR t IN
    SELECT table_schema,table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name ILIKE '%registration%'
      AND table_name NOT IN ('accounts','member_accounts')
  LOOP
    EXECUTE format('DELETE FROM %I.%I',t.table_schema,t.table_name);
  END LOOP;

  FOR t IN
    SELECT table_schema,table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name IN ('transactions','transaction_logs','audit_logs','audit_log','activity_logs','activity_log','settings','app_settings','system_settings')
  LOOP
    predicate := '';
    FOR c IN
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema=t.table_schema AND table_name=t.table_name
        AND data_type IN ('text','character varying','character')
    LOOP
      IF predicate <> '' THEN predicate := predicate || ' OR '; END IF;
      predicate := predicate || format('coalesce(%I::text, '''') ILIKE ''%%REGISTRATION%%''',c.column_name);
    END LOOP;
    IF predicate <> '' THEN
      EXECUTE format('DELETE FROM %I.%I WHERE %s',t.table_schema,t.table_name,predicate);
    END IF;
  END LOOP;

  -- Clear any registration-specific account flags/amounts without deleting accounts.
  FOR c IN
    SELECT table_name,column_name,data_type
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name IN ('accounts','member_accounts')
      AND column_name ILIKE '%registration%'
  LOOP
    IF c.data_type='boolean' THEN
      EXECUTE format('UPDATE public.%I SET %I=false WHERE %I IS DISTINCT FROM false',c.table_name,c.column_name,c.column_name);
    ELSIF c.data_type IN ('smallint','integer','bigint','numeric','real','double precision') THEN
      EXECUTE format('UPDATE public.%I SET %I=0 WHERE %I IS NOT NULL',c.table_name,c.column_name,c.column_name);
    ELSE
      EXECUTE format('UPDATE public.%I SET %I=NULL WHERE %I IS NOT NULL',c.table_name,c.column_name,c.column_name);
    END IF;
  END LOOP;
END
$tmcs_registration_purge_v253$;
`;
fs.writeFileSync(p,s);
}
console.log('Stage 253: registration-only records are purged by an idempotent database migration.');
