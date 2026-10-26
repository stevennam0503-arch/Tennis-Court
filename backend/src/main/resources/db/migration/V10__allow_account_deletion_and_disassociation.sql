ALTER TABLE tournament_registrations ALTER COLUMN account_id DROP NOT NULL;

-- Replace unconditional unique constraint with partial unique index for non-null accounts
ALTER TABLE tournament_registrations DROP CONSTRAINT IF EXISTS uq_tournament_account;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_account_not_null ON tournament_registrations(tournament_id, account_id) WHERE account_id IS NOT NULL;
