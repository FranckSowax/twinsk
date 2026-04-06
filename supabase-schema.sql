-- ================================================
-- Twinsk Sourcing System — Supabase Schema
-- Exécuter dans le SQL Editor de Supabase Dashboard
-- ================================================

-- Enums
CREATE TYPE request_status AS ENUM ('draft', 'submitted', 'processing', 'quoted', 'completed');
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');

-- Requests
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT NOT NULL DEFAULT '',
  client_phone TEXT NOT NULL DEFAULT '',
  status request_status NOT NULL DEFAULT 'draft',
  notes TEXT
);

-- Request items (images + descriptions)
CREATE TABLE request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX idx_request_items_request_id ON request_items(request_id);

-- Search results from Taobao
CREATE TABLE search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_item_id UUID NOT NULL REFERENCES request_items(id) ON DELETE CASCADE,
  taobao_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  seller TEXT,
  product_url TEXT NOT NULL DEFAULT '',
  selected BOOLEAN NOT NULL DEFAULT false,
  quantity INTEGER NOT NULL DEFAULT 1,
  margin_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX idx_search_results_request_item_id ON search_results(request_item_id);

-- Quotes / Devis
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  margin_global NUMERIC(5,2) NOT NULL DEFAULT 0,
  status quote_status NOT NULL DEFAULT 'draft',
  pdf_url TEXT
);
CREATE INDEX idx_quotes_request_id ON quotes(request_id);

-- Auto-update updated_at on requests
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================
-- RLS Policies
-- ================================================

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Requests: anon can SELECT (by id) and INSERT and UPDATE status
CREATE POLICY "Requests are readable by anyone with the UUID"
  ON requests FOR SELECT USING (true);

CREATE POLICY "Anyone can create a request"
  ON requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update a request"
  ON requests FOR UPDATE USING (true);

-- Request items: anon can SELECT and INSERT
CREATE POLICY "Request items are readable"
  ON request_items FOR SELECT USING (true);

CREATE POLICY "Anyone can add request items"
  ON request_items FOR INSERT WITH CHECK (true);

-- Search results: read only for anon (writes via service role)
CREATE POLICY "Search results are readable"
  ON search_results FOR SELECT USING (true);

-- Quotes: read only for anon
CREATE POLICY "Quotes are readable"
  ON quotes FOR SELECT USING (true);

-- ================================================
-- Storage bucket
-- ================================================
-- Create via Supabase Dashboard: Storage > New bucket
-- Name: request-images
-- Public: true
-- Allowed MIME types: image/*
-- Max file size: 10MB
