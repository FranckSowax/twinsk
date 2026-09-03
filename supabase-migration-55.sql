-- ================================================
-- Twinsk — Migration #55
-- Attribution marketing sur les leads : rattache chaque demande
-- à la campagne qui l'a amenée (UTM + fbclid/gclid/ttclid).
-- Alimenté par le cookie tw_attr (voir src/lib/attribution.ts).
-- ================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS attribution jsonb;

COMMENT ON COLUMN leads.attribution IS
  'Provenance du lead : { first: TouchPoint, last: TouchPoint }. '
  'TouchPoint = utm_*, fbclid/gclid/ttclid, referrer, landing_path, at.';

-- Index de rapprochement campagne → leads (le cas d''usage principal :
-- "combien de leads la campagne X a-t-elle générés ?").
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign
  ON leads ((attribution -> 'last' ->> 'utm_campaign'))
  WHERE attribution IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_utm_source
  ON leads ((attribution -> 'last' ->> 'utm_source'))
  WHERE attribution IS NOT NULL;
