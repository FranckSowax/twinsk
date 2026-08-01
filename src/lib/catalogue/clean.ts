// Pipeline de nettoyage déterministe d'un catalogue twinsk_catalogue_v3.1.
// Fonction pure `nettoyer(catalogue)` → { catalogue, journal, anomalies, demandes, blocking }.
// Aucune I/O. Rejouer le même fichier produit exactement le même résultat.
//
// Port fidèle des scripts de référence (combler_logistique.py, audit_plausibilite.py,
// normaliser_cles.py) avec les raffinements de la spec :
//   - garde-fou « portée ≠ poids » sur la lecture du poids dans l'intitulé ;
//   - densité plancher GRADUÉE (3 kg/m³ si colis < 0,05 m³, sinon 20) ;
//   - recalcul du volume depuis les dimensions seulement si ratio calc/déclaré > 1,6.
//   - détection « acompte » (定金/订金/预付) → price_type.
//
// Règle d'or : ne JAMAIS inventer une donnée. En cas de doute : supprimer et signaler.

import type {
  Catalogue,
  CatalogueProduct,
  CatalogueVariant,
  CleanResult,
  JournalEntry,
  Anomaly,
  BlockingIssue,
  SupplierRequest,
  Provenance,
} from './types';

// ---- Constantes (bornes de plausibilité, justifiées dans la référence) ----
const POIDS_MIN = 0.005; // 5 g — le catalogue vend aussi des consommables papier
const POIDS_MAX = 1500; // kg par colis
const CBM_MAX = 25; // m³ par colis
const DENS_MAX = 1500; // fonte compacte
const POIDS_BIDON = new Set([0, 1, 9.999, 99.99, 999, 9999, 0.001]);

const K_POIDS = ['weight_kg', 'poids_kg', 'weight', 'poids', 'weight_g', 'poids_g'];
const K_GRAMMES = new Set(['weight_g', 'poids_g']);
const K_VOL = ['cbm', 'volume_cbm', 'volume', 'volume_m3'];
const K_DIMS = ['dimensions_cm', 'dimensions', 'dims'];

// Familles d'alias (lecture par ordre de confiance → écriture dans tous). Étape G.
const FAMILLES: { read: string[]; write: string[]; canon: string; kind: 'poids' | 'vol' | 'dims' }[] = [
  { read: ['weight_kg', 'weight', 'poids_kg', 'poids'], write: ['weight_kg', 'weight'], canon: 'weight_kg', kind: 'poids' },
  { read: ['cbm', 'volume', 'volume_m3', 'volume_cbm'], write: ['cbm', 'volume', 'volume_m3'], canon: 'cbm', kind: 'vol' },
  { read: ['dimensions_cm', 'dimensions', 'dims'], write: ['dimensions_cm', 'dimensions'], canon: 'dimensions_cm', kind: 'dims' },
];

const DIMS_RE = /(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/;
const NOM_KG = /(\d+(?:[.,]\d+)?)\s*(?:kg|公斤|千克)/i;
const NOM_G = /(\d+(?:[.,]\d+)?)\s*(?:克|grammes|gramme|gr|g)(?![a-z])/i;
// Garde-fou : sur un instrument de mesure, le « kg » du nom est une PORTÉE, pas un poids.
const PORTEE =
  /(kg\s*\/|\/\s*\d|\d\s*(?:à|a|~|-|到|至)\s*\d+\s*(?:kg|公斤|千克)|port[ée]e|capacit[ée]|charge\s*max|\bmax\b|jusqu'?\s*à|r[ée]solution|量程|承重|最大|载重)/i;
// Acompte usine : 定金 / 订金 / 预付 dans les libellés SKU.
const ACOMPTE_RE = /定金|订金|预付/;

function num(x: unknown): number | null {
  if (x == null || typeof x === 'boolean') return null;
  if (typeof x === 'number') return Number.isFinite(x) ? x : null;
  const m = /-?\d+(?:[.,]\d+)?/.exec(String(x));
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}

const fmt = (n: number) => `${+n.toFixed(6)}`; // équivalent de %g (pas de zéros inutiles)

/** dict {l,w,h} ou chaîne → 'LxWxH cm' normalisé (cm), ou null si illisible. */
function normDims(v: unknown): string | null {
  let a: number, b: number, c: number;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const l = num(o.l), w = num(o.w), h = num(o.h);
    if (l == null || w == null || h == null) return null;
    a = l; b = w; c = h;
  } else {
    const s = String(v ?? '');
    const m = DIMS_RE.exec(s);
    if (!m) return null;
    a = parseFloat(m[1].replace(',', '.'));
    b = parseFloat(m[2].replace(',', '.'));
    c = parseFloat(m[3].replace(',', '.'));
    const low = s.toLowerCase();
    if (/\bmm\b/.test(low)) { a /= 10; b /= 10; c /= 10; }
    else if (/(?<![a-z])m\b/.test(low) && !low.includes('cm')) { a *= 100; b *= 100; c *= 100; }
  }
  if (Math.min(a, b, c) <= 0) return null;
  return `${fmt(a)}x${fmt(b)}x${fmt(c)} cm`;
}

/** '1x1x1 cm' et assimilés : une dimension inventée, pas une petite pièce. */
function dimsBidon(norm: string | null): boolean {
  if (!norm) return true;
  const m = DIMS_RE.exec(norm);
  if (!m) return true;
  const [a, b, c] = m.slice(1).map((x) => parseFloat(x.replace(',', '.')));
  return a <= 1 && b <= 1 && c <= 1;
}

/** m³ calculé depuis un 'L×l×h' cm. */
function cbmDe(norm: string | null): number | null {
  if (!norm) return null;
  const m = DIMS_RE.exec(norm);
  if (!m) return null;
  const [a, b, c] = m.slice(1).map((x) => parseFloat(x.replace(',', '.')));
  return +(((a * b * c) / 1e6).toFixed(6));
}

/** Poids lu dans l'intitulé (kg), avec garde-fou portée/capacité. null si aucun/rejeté. */
function poidsDuNom(txt: string): number | null {
  const t = txt || '';
  if (PORTEE.test(t)) return null; // portée d'un instrument, pas un poids
  let m = NOM_KG.exec(t);
  if (m) {
    const v = parseFloat(m[1].replace(',', '.'));
    if (v >= POIDS_MIN && v <= POIDS_MAX) return v;
  }
  m = NOM_G.exec(t);
  if (m) {
    const v = parseFloat(m[1].replace(',', '.')) / 1000;
    if (v >= POIDS_MIN && v <= POIDS_MAX) return v;
  }
  return null;
}

const densityFloor = (v: number) => (v < 0.05 ? 3 : 20); // plancher gradué (spec §3)
function densityOk(w: number | null, v: number | null): boolean {
  if (!(w && v && v > 0)) return true;
  const d = w / v;
  return d >= densityFloor(v) && d <= DENS_MAX;
}

type Obj = CatalogueProduct | CatalogueVariant;

/** Réécrit la valeur dans toutes les clés de la famille présentes (+ canonique si aucune). */
function ecrire(o: Obj, keys: string[], value: number | string | null, canon: string): void {
  const present = keys.filter((k) => k in o);
  if (value == null) {
    for (const k of present) delete (o as Record<string, unknown>)[k];
    return;
  }
  for (const k of present) {
    (o as Record<string, unknown>)[k] = K_GRAMMES.has(k) && typeof value === 'number' ? +(value * 1000).toFixed(3) : value;
  }
  if (present.length === 0) (o as Record<string, unknown>)[canon] = value;
}

function setProv(o: Obj, champ: 'weight' | 'dimensions' | 'cbm', p: Provenance): void {
  if (!o.logi_provenance) o.logi_provenance = {};
  o.logi_provenance[champ] = p;
}

interface Traite {
  weight: number | null;
  dims: string | null;
  volume: number | null;
}

/** Nettoie et consolide poids/dimensions/volume d'un produit ou d'une variante (B→E). */
function traiter(o: Obj, oid: string, niveau: 'produit' | 'variante', nom: string, journal: JournalEntry[]): Traite {
  const log = (champ: string, avant: unknown, apres: unknown, motif: string) =>
    journal.push({ offer_id: oid, niveau, nom: (nom || '').slice(0, 60), champ, avant, apres, motif });

  // --- POIDS : collecte toutes les clés, jette les sentinelles ---
  const cands: number[] = [];
  for (const k of K_POIDS) {
    const raw = num((o as Record<string, unknown>)[k]);
    if (raw == null) continue;
    const kg = K_GRAMMES.has(k) ? raw / 1000 : raw > 5000 ? raw / 1000 : raw;
    if (POIDS_BIDON.has(kg) || !(kg >= POIDS_MIN && kg <= POIDS_MAX)) {
      log(k, (o as Record<string, unknown>)[k], null, 'poids invraisemblable');
      continue;
    }
    cands.push(kg);
  }
  let retenu: number | null = cands.length ? Math.min(...cands) : null;
  let weightProv: Provenance = 'usine';
  const pn = poidsDuNom(nom);
  if (pn != null) {
    if (retenu != null && Math.abs(retenu * 1000 - pn) / pn < 0.05) {
      log('weight', retenu, pn, 'champ en tonnes, corrigé par le nom');
      retenu = pn;
      weightProv = 'intitule';
    } else if (retenu == null) {
      log('weight_kg', null, pn, 'poids lu dans l’intitulé');
      retenu = pn;
      weightProv = 'intitule';
    }
  }
  ecrire(o, K_POIDS, retenu, 'weight_kg');
  if (retenu != null) setProv(o, 'weight', weightProv);

  // --- DIMENSIONS : normalisation dict/chaîne, purge des bouche-trous ---
  const bons: string[] = [];
  for (const k of K_DIMS) {
    if (!(k in o)) continue;
    const n = normDims((o as Record<string, unknown>)[k]);
    if (dimsBidon(n)) {
      log(k, (o as Record<string, unknown>)[k], null, 'dimensions bouche-trou ou illisibles');
      continue;
    }
    bons.push(n as string);
  }
  // --- VOLUMES : purge nul/hors bornes ---
  const vols: number[] = [];
  for (const k of K_VOL) {
    const v = num((o as Record<string, unknown>)[k]);
    if (v == null) continue;
    if (v <= 0 || v > CBM_MAX) {
      log(k, (o as Record<string, unknown>)[k], null, 'volume nul ou hors bornes');
      continue;
    }
    vols.push(v);
  }

  // --- ÉLECTION CONJOINTE dimensions × volume (E) ---
  let d: string | null = null;
  let vol: number | null = null;
  let volProv: Provenance = 'usine';
  if (bons.length && vols.length) {
    let best = { dd: bons[0], vv: vols[0], score: Infinity };
    for (const dd of bons) for (const vv of vols) {
      const score = Math.abs((cbmDe(dd) ?? 0) / vv - 1);
      if (score < best.score) best = { dd, vv, score };
    }
    d = best.dd;
    vol = best.vv;
    const r = (cbmDe(d) ?? 0) / vol;
    if (r > 1.6) {
      // Les dimensions sont vérifiables, un CBM isolé ne l'est pas → elles gagnent.
      const nv = cbmDe(d);
      log('cbm', vol, nv, 'volume recalculé depuis les dimensions');
      vol = nv;
      volProv = 'calcul';
    }
  } else if (bons.length) {
    d = bons.reduce((a, b) => ((cbmDe(b) ?? 0) > (cbmDe(a) ?? 0) ? b : a));
    vol = cbmDe(d);
    if (vol && vol >= 0.0000005 && vol <= CBM_MAX) {
      log('cbm', null, vol, 'calculé depuis les dimensions');
      volProv = 'calcul';
    } else {
      vol = null;
    }
  } else if (vols.length) {
    vol = Math.min(...vols);
  }

  ecrire(o, K_DIMS, d, 'dimensions_cm');
  ecrire(o, K_VOL, vol, 'cbm');
  if (d != null) setProv(o, 'dimensions', 'usine');
  if (vol != null) setProv(o, 'cbm', volProv);

  // Second filet (spec §D) : un poids lu dans l'intitulé qui donne une densité absurde est annulé.
  if (weightProv === 'intitule' && retenu != null && vol != null && !densityOk(retenu, vol)) {
    log('weight_kg', retenu, null, 'poids de l’intitulé annulé (densité absurde)');
    ecrire(o, K_POIDS, null, 'weight_kg');
    if (o.logi_provenance) delete o.logi_provenance.weight;
    retenu = null;
  }

  return { weight: retenu, dims: d, volume: vol };
}

// ---- Lecture harmonisée (après étape G) pour l'audit ----
function readWeight(o: Obj): number | null {
  for (const k of ['weight_kg', 'poids_kg']) {
    const v = num((o as Record<string, unknown>)[k]);
    if (v != null) return v;
  }
  for (const k of ['weight_g', 'poids_g']) {
    const v = num((o as Record<string, unknown>)[k]);
    if (v != null) return v / 1000;
  }
  const v = num((o as Record<string, unknown>)['weight']);
  if (v == null) return null;
  return v > 5000 ? v / 1000 : v;
}
function readVol(o: Obj): number | null {
  for (const k of K_VOL) {
    const v = num((o as Record<string, unknown>)[k]);
    if (v != null) return v;
  }
  return null;
}
function readDims(o: Obj): string | null {
  for (const k of K_DIMS) {
    const v = (o as Record<string, unknown>)[k];
    if (v) return normDims(v);
  }
  return null;
}

/** Étape G : recopie la valeur retenue dans tous les alias ; supprime tout si vide. */
function harmoniser(o: Obj): number {
  let n = 0;
  for (const fam of FAMILLES) {
    let val: number | string | null = null;
    for (const k of fam.read) {
      const x = (o as Record<string, unknown>)[k];
      if (x != null && x !== '' && x !== 0 && !(typeof x === 'object' && x !== null && Object.keys(x).length === 0)) {
        val = fam.kind === 'dims' ? normDims(x) : (typeof x === 'number' ? x : num(x));
        if (val != null) break;
      }
    }
    for (const k of fam.write) {
      if (val == null) {
        if (k in o) { delete (o as Record<string, unknown>)[k]; n++; }
      } else if ((o as Record<string, unknown>)[k] !== val) {
        (o as Record<string, unknown>)[k] = val;
        n++;
      }
    }
  }
  return n;
}

/** Étape H : « acompte » si ≥ la moitié des libellés SKU contiennent 定金/订金/预付. */
function detecterAcompte(p: CatalogueProduct): boolean {
  const variants = p.variants || [];
  const labels = variants.length ? variants.map((v) => v.name || '') : [p.title || p.name || ''];
  const matches = labels.filter((l) => ACOMPTE_RE.test(l)).length;
  return matches > 0 && matches * 2 >= labels.length;
}

const offerIdDe = (p: CatalogueProduct, fallback: string): string => {
  const url = p.product_url || '';
  const i = url.indexOf('/offer/');
  if (i >= 0) return url.slice(i + 7).split('.html')[0];
  return fallback;
};

export function nettoyer(input: Catalogue): CleanResult {
  // Copie profonde → fonction pure (jamais de mutation de l'entrée).
  const cat: Catalogue = JSON.parse(JSON.stringify(input ?? {}));
  const cats = cat.categories || [];
  const journal: JournalEntry[] = [];
  const anomalies: Anomaly[] = [];
  const blocking: BlockingIssue[] = [];
  const demandes: SupplierRequest[] = [];
  let corrections = 0;
  let nProd = 0;
  let nVar = 0;

  // --- Étape A.3 : la devise doit être CNY (prix 1688 en yuan) ---
  const devise = (cat.meta?.currency || cat.currency || '') as string;
  if (devise && devise.toUpperCase() !== 'CNY') {
    blocking.push({
      code: 'devise_invalide',
      detail: `meta.currency = « ${devise} » — les prix 1688 sont en CNY. Import bloqué : une conversion implicite fausserait tout le catalogue (×~7,8). Confirmez la devise réelle.`,
    });
  }

  for (let ci = 0; ci < cats.length; ci++) {
    const c = cats[ci];
    // --- Étape A.1 : catégorie sans title → dérivée (sinon ignorée en silence à l'import) ---
    if (!c.title || !String(c.title).trim()) {
      const derive = (c.name && String(c.name).trim()) || String(c.description || '').slice(0, 80).trim();
      const before = c.title;
      c.title = derive || `Catégorie ${ci + 1}`;
      journal.push({ offer_id: `cat#${ci}`, niveau: 'categorie', nom: c.title, champ: 'title', avant: before ?? null, apres: c.title, motif: 'titre de catégorie dérivé (manquant)' });
      corrections++;
    }

    for (let pi = 0; pi < (c.products || []).length; pi++) {
      const p = (c.products as CatalogueProduct[])[pi];
      nProd++;
      const oid = offerIdDe(p, `p${ci}.${pi}`);
      const titre = p.title || p.name || '';
      const variants = p.variants || [];
      nVar += variants.length;

      // --- Étape A.2 : prix absent ou 0 → erreur BLOQUANTE (produit perdu en silence sinon) ---
      const pr = num(p.price);
      if (pr == null || pr === 0) {
        blocking.push({ code: 'prix_absent_ou_nul', offer_id: oid, detail: `« ${titre.slice(0, 60)} » : prix absent ou 0 — ne sera pas importé.` });
      }

      const jLenBefore = journal.length;

      // --- B→E : produit puis variantes ---
      const pInfo = traiter(p, oid, 'produit', titre, journal);
      // Séparateur « · » (jamais « / ») : le garde-fou portée matche « /N », il ne doit
      // pas confondre le séparateur titre/variante avec une notation « kg/台 ».
      const vInfos = variants.map((v) => traiter(v, oid, 'variante', `${titre} · ${v.name || ''}`, journal));

      // --- Étape F : propagation entre niveaux ---
      let pw = pInfo.weight, pd = pInfo.dims, pv = pInfo.volume;
      // 1. Réconciliation d'unité : produit en tonnes → aligner sur la médiane des variantes.
      const vw = vInfos.map((x) => x.weight).filter((w): w is number => w != null);
      if (pw != null && vw.length) {
        const med = [...vw].sort((a, b) => a - b)[Math.floor(vw.length / 2)];
        if (Math.abs(pw * 1000 - med) / med < 0.05) {
          journal.push({ offer_id: oid, niveau: 'produit', nom: titre.slice(0, 60), champ: 'weight_kg', avant: pw, apres: med, motif: 'produit en tonnes, aligné sur les variantes' });
          pw = med; ecrire(p, K_POIDS, med, 'weight_kg'); setProv(p, 'weight', 'usine');
        }
      }
      // 2. Remontée : le produit n'a rien, une variante si.
      if (pw == null) for (const x of vInfos) if (x.weight != null) { pw = x.weight; ecrire(p, K_POIDS, pw, 'weight_kg'); setProv(p, 'weight', 'produit'); journal.push({ offer_id: oid, niveau: 'produit', nom: titre.slice(0, 60), champ: 'weight_kg', avant: null, apres: pw, motif: 'remonté depuis une variante' }); break; }
      if (pd == null) for (const x of vInfos) if (x.dims != null) { pd = x.dims; ecrire(p, K_DIMS, pd, 'dimensions_cm'); setProv(p, 'dimensions', 'produit'); journal.push({ offer_id: oid, niveau: 'produit', nom: titre.slice(0, 60), champ: 'dimensions_cm', avant: null, apres: pd, motif: 'remonté depuis une variante' }); break; }
      if (pv == null) for (const x of vInfos) if (x.volume != null) { pv = x.volume; ecrire(p, K_VOL, pv, 'cbm'); setProv(p, 'cbm', 'produit'); journal.push({ offer_id: oid, niveau: 'produit', nom: titre.slice(0, 60), champ: 'cbm', avant: null, apres: pv, motif: 'remonté depuis une variante' }); break; }
      // 3. Héritage : le colisage produit descend sur les variantes qui n'ont rien.
      variants.forEach((v, i) => {
        const info = vInfos[i];
        if (info.weight == null && pw != null) { ecrire(v, K_POIDS, pw, 'weight_kg'); v.logi_source = 'produit'; setProv(v, 'weight', 'produit'); }
        if (info.dims == null && pd != null) { ecrire(v, K_DIMS, pd, 'dimensions_cm'); v.logi_source = 'produit'; setProv(v, 'dimensions', 'produit'); }
        if (info.volume == null && pv != null) { ecrire(v, K_VOL, pv, 'cbm'); v.logi_source = 'produit'; setProv(v, 'cbm', 'produit'); }
      });

      // --- Étape H : acompte ---
      if (detecterAcompte(p)) {
        const note = 'Prix affiché = acompte (定金) exigé par l’usine — prix final sur devis';
        p.price_type = 'acompte'; p.price_note = note;
        for (const v of variants) { v.price_type = 'acompte'; v.price_note = note; }
        journal.push({ offer_id: oid, niveau: 'produit', nom: titre.slice(0, 60), champ: 'price_type', avant: p.price_type ?? null, apres: 'acompte', motif: 'libellés SKU en 定金/订金/预付 (prix inchangé)' });
      }

      // --- Étape G : harmonisation des alias (produit + variantes) ---
      corrections += harmoniser(p);
      for (const v of variants) corrections += harmoniser(v);

      corrections += journal.length - jLenBefore;

      // --- §3 Audit de vraisemblance (sur le catalogue nettoyé) ---
      const audit = (o: Obj, niveau: 'produit' | 'variante', nom: string) => {
        const w = readWeight(o), v = readVol(o), dstr = readDims(o);
        if (w == null) anomalies.push({ offer_id: oid, niveau, code: 'poids_absent', nom, detail: 'poids manquant après nettoyage' });
        if (!dstr) anomalies.push({ offer_id: oid, niveau, code: 'dims_absentes', nom, detail: 'dimensions manquantes après nettoyage' });
        if (v == null) anomalies.push({ offer_id: oid, niveau, code: 'volume_absent', nom, detail: 'volume manquant après nettoyage' });
        if (w != null && v != null && v > 0 && !densityOk(w, v))
          anomalies.push({ offer_id: oid, niveau, code: 'densite_absurde', nom, detail: `densité ${(w / v).toFixed(0)} kg/m³ (plancher ${densityFloor(v)}, plafond ${DENS_MAX})` });
        const dv = dstr ? cbmDe(dstr) : null;
        if (dv != null && v != null && v > 0 && dv / v > 1.6)
          anomalies.push({ offer_id: oid, niveau, code: 'dims_vs_volume_incoherent', nom, detail: `dims→${dv.toFixed(3)} m³ > volume ${v} m³ (×${(dv / v).toFixed(1)})` });
      };
      audit(p, 'produit', titre.slice(0, 60));
      variants.forEach((v) => audit(v, 'variante', `${titre} / ${v.name || ''}`.slice(0, 60)));

      // §3 video_orpheline : videos[] rempli mais video_url absent (c'est video_url que l'app lit).
      const hasVideos = (Array.isArray(p.videos) && p.videos.length > 0) || !!p.video;
      if (hasVideos && !p.video_url)
        anomalies.push({ offer_id: oid, niveau: 'produit', code: 'video_orpheline', nom: titre.slice(0, 60), detail: 'videos[] rempli mais video_url absent' });

      // --- §4 Demande fournisseur : ni poids ni dimensions après tout le pipeline ---
      const manque: string[] = [];
      if (readWeight(p) == null) manque.push('poids');
      if (readDims(p) == null) manque.push('dimensions');
      if (manque.length) demandes.push({ offer_id: oid, url: p.product_url || '', titre: titre.slice(0, 80), manque: manque.join(' + ') });
    }
  }

  return {
    catalogue: cat,
    journal,
    anomalies,
    demandes,
    blocking,
    stats: { categories: cats.length, produits: nProd, variantes: nVar, corrections },
  };
}
