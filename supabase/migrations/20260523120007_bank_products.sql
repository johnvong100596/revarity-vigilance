-- Bank products: manually curated feed of new bank/financial-institution
-- offerings. H-102 fires when user has a connected account at the institution
-- AND meets the implied credit profile. Global reference data — readable by
-- all authenticated users, only the service role writes.
-- ARCHITECTURE.md §3, THESIS.md §6 (H-102), §11.

CREATE TABLE public.bank_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT NOT NULL,
  rate_or_offer TEXT,
  url TEXT,
  jurisdictions TEXT[] NOT NULL DEFAULT ARRAY['CA','US'],
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_products_active ON public.bank_products(active, jurisdictions);

ALTER TABLE public.bank_products ENABLE ROW LEVEL SECURITY;

-- Global reference data: any signed-in user can read currently-active products.
CREATE POLICY "Authenticated users read active bank products"
  ON public.bank_products FOR SELECT TO authenticated
  USING (active = true);
