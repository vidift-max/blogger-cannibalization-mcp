ALTER TABLE post_backups
  ADD COLUMN IF NOT EXISTS reconciliation_action TEXT,
  ADD COLUMN IF NOT EXISTS reconciliation_reason TEXT;

ALTER TABLE post_backups
  DROP CONSTRAINT IF EXISTS post_backups_status_check;

ALTER TABLE post_backups
  ADD CONSTRAINT post_backups_status_check
  CHECK (status IN (
    'pending',
    'applying',
    'applied',
    'restoring',
    'restored',
    'rejected',
    'reconciling',
    'reconciliation_required'
  ));

CREATE INDEX IF NOT EXISTS post_backups_user_status_idx
  ON post_backups(user_id, status, id DESC);

CREATE INDEX IF NOT EXISTS correction_batch_items_proposal_idx
  ON correction_batch_items(proposal_id)
  WHERE proposal_id IS NOT NULL;
