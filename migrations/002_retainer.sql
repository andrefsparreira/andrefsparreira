ALTER TABLE fee_years
  ADD COLUMN IF NOT EXISTS monthly_retainer double precision,
  ADD COLUMN IF NOT EXISTS client_status text NOT NULL DEFAULT 'atual',
  ADD COLUMN IF NOT EXISTS doc_organization text NOT NULL DEFAULT 'organizada',
  ADD COLUMN IF NOT EXISTS doc_count integer,
  ADD COLUMN IF NOT EXISTS doc_medium text NOT NULL DEFAULT 'digital',
  ADD COLUMN IF NOT EXISTS turnover double precision,
  ADD COLUMN IF NOT EXISTS manual_adjust double precision NOT NULL DEFAULT 0;
