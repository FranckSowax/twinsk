-- ================================================
-- Twinsk — Migration #20
-- Métriques de fiabilité fournisseur sur les résultats de recherche
-- (taux de réachat 回头率, volume de ventes, note moyenne)
-- → permet de classer les résultats par fiabilité (Priorité 1 sourcing)
-- ================================================
-- Additive & rétro-compatible : l'ancien code ignore ces colonnes.
-- À exécuter AVANT de déployer le code qui les remplit.

ALTER TABLE search_results
  ADD COLUMN IF NOT EXISTS repurchase_rate NUMERIC,   -- taux de réachat en % (ex: 38.0), null si inconnu
  ADD COLUMN IF NOT EXISTS sales           INTEGER,   -- volume de ventes (proxy de fiabilité), null si inconnu
  ADD COLUMN IF NOT EXISTS star_rate       NUMERIC;   -- note moyenne boutique (ex: 4.8), null si inconnu

COMMENT ON COLUMN search_results.repurchase_rate IS
  '1688 rePurchaseRate (回头率). Critère N°1 de classement fournisseur. % (0-100). Null = inconnu (ex: Taobao, factory, manuel).';
COMMENT ON COLUMN search_results.sales IS
  'Volume de ventes remonté par la marketplace (Taobao/1688). Critère de classement secondaire.';
COMMENT ON COLUMN search_results.star_rate IS
  '1688 averageStarRate (note moyenne boutique). Critère de classement tertiaire.';
