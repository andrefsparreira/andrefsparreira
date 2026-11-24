ALTER TABLE fee_years
  ADD COLUMN IF NOT EXISTS organization_level integer,
  ADD COLUMN IF NOT EXISTS accounting_level integer,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS approved_retainer double precision;

INSERT INTO settings (key, value) VALUES (
  'avenca_config',
  '{"inflacao":2.5,"tolerancia":5,"pesoOrganizacao":0.4,"pesoContabilizacao":0.6,"pesoFaturacao":0.4,"pesoDocumentos":0.6,"impactoCrescimento":0.4,"impactoComplexidade":0.6,"arredondamento":5,"avencasReferencia":[100,150,225,325,450,600],"avencaMaximaReferencia":600}'
)
ON CONFLICT (key) DO NOTHING;
