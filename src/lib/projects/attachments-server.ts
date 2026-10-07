// Lecture des pièces jointes d'un échange usine (bucket privé) pour l'analyse
// IA (6 oct. 2026) : image → transmise au modèle telle quelle ; PDF → texte
// extrait ici (pdf-parse), ou fichier transmis au modèle pour OCR s'il est
// scanné ; e-mail .eml → en-têtes, corps et pièces jointes imbriquées ; texte
// → tel quel. Word et Excel ne sont pas lus (signalé à l'équipe : enregistrer
// en PDF ou coller le texte). La partie pure (MIME, nettoyage, mise en forme)
// est dans attachments.ts.

import { supabaseAdmin } from '@/lib/supabase/server';
import type { LlmPart } from '@/lib/llm';
import { PROJECT_BUCKET } from './data';
import { cleanPdfText, docsPromptText, docSummary, isScanned, parseEml, type ReadDoc } from './attachments';

const IMAGE_MAX = 8 * 1024 * 1024;
/** PDF scanné transmis au modèle (OCR) : au-delà, on demande une version texte. */
const PDF_OCR_MAX = 12 * 1024 * 1024;
export const MAX_DOCS = 8;

export interface ReadResult {
  docs: ReadDoc[];
  /** Images et PDF scannés, dans l'ordre des pièces jointes. */
  parts: LlmPart[];
  /** Texte des pièces lues, mis en forme pour le prompt (vide si aucune). */
  text: string;
  /** Une ligne par pièce, pour l'équipe (« devis.pdf (PDF, 1 page) — 2 459 car. »). */
  summary: string[];
}

/**
 * pdf.js (chargé par pdf-parse) attend des API navigateur absentes de Node 20
 * (image node:20-alpine de production) : sans elles, le module échoue au
 * chargement (« DOMMatrix is not defined »), et une importation statique
 * faisait tomber toute la route en 500. Des remplaçants minimaux suffisent à
 * l'extraction de texte — aucun rendu graphique ici — et pdf-parse n'est
 * chargé qu'au premier PDF, à l'abri d'un try/catch.
 */
function ensurePdfGlobals() {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === 'undefined') {
    g.DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(init?: number[]) {
        if (Array.isArray(init) && init.length >= 6) [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    };
  }
  if (typeof g.Path2D === 'undefined') g.Path2D = class Path2D {};
  if (typeof g.ImageData === 'undefined') g.ImageData = class ImageData {};
}
let pdfParseModule: Promise<typeof import('pdf-parse')> | null = null;
function loadPdfParse() {
  ensurePdfGlobals();
  return (pdfParseModule ||= import('pdf-parse'));
}

/** Texte d'un PDF (couche texte) et nombre de pages. */
export async function extractPdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const { PDFParse } = await loadPdfParse();
  const parser = new PDFParse({ data: buffer, verbosity: 0 });
  try {
    const r = await parser.getText();
    return { text: cleanPdfText(r.text), pages: r.total };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

const mimeOf = (name: string, mime: string | null) => {
  const m = (mime || '').toLowerCase();
  if (m && m !== 'application/octet-stream') return m;
  const ext = (name.split('.').pop() || '').toLowerCase();
  return ext === 'pdf' ? 'application/pdf' : ext === 'eml' ? 'message/rfc822' : ext === 'txt' ? 'text/plain' : /^(jpe?g|png|webp|gif)$/.test(ext) ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : m;
};

async function readPdf(name: string, buffer: Buffer, out: ReadResult) {
  const doc: ReadDoc = { name, kind: 'pdf', pages: null, text: '', scanned: false, note: null };
  // PDF transmis tel quel : le fournisseur IA le lit lui-même (OCR pour un scan,
  // texte pour les autres) — utilisé pour les scans et en secours si pdf-parse
  // ne se charge pas dans ce runtime.
  const sendAsFile = (why: 'scan' | 'fallback') => {
    if (buffer.length > PDF_OCR_MAX) {
      doc.note = why === 'scan' ? 'scanné et trop volumineux pour l’OCR : demander une version texte' : 'PDF trop volumineux pour être transmis au modèle';
      return;
    }
    doc.scanned = true;
    if (why === 'fallback') doc.note = 'lu par le fournisseur IA (extraction locale indisponible)';
    out.parts.push({ type: 'file', name, url: `data:application/pdf;base64,${buffer.toString('base64')}` });
  };
  try {
    const r = await extractPdf(buffer);
    doc.pages = r.pages;
    if (isScanned(r.text, r.pages)) sendAsFile('scan');
    else doc.text = r.text;
  } catch (e) {
    // Module pdf-parse non chargeable (API navigateur manquante…) → le modèle lit le PDF.
    if (/pdf-parse|DOMMatrix|Path2D|ImageData|Cannot find module|not defined/i.test(String(e))) sendAsFile('fallback');
    else doc.note = 'PDF illisible (protégé ou endommagé)';
  }
  out.docs.push(doc);
}

function readImage(name: string, mime: string, buffer: Buffer, out: ReadResult) {
  const doc: ReadDoc = { name, kind: 'image', pages: null, text: '', scanned: false, note: null };
  if (buffer.length > IMAGE_MAX) doc.note = 'image trop lourde (> 8 Mo), non transmise';
  else out.parts.push({ type: 'image', url: `data:${mime};base64,${buffer.toString('base64')}` });
  out.docs.push(doc);
}

async function readOne(name: string, mime: string, buffer: Buffer, out: ReadResult, depth = 0) {
  if (mime.startsWith('image/')) return readImage(name, mime, buffer, out);
  if (mime === 'application/pdf') return readPdf(name, buffer, out);
  if (mime === 'text/plain') return void out.docs.push({ name, kind: 'text', pages: null, text: buffer.toString('utf8').slice(0, 60_000), scanned: false, note: null });
  if (mime === 'message/rfc822' && depth === 0) {
    const m = parseEml(buffer);
    const head = [m.from && `De : ${m.from}`, m.to && `À : ${m.to}`, m.date && `Date : ${m.date}`, m.subject && `Objet : ${m.subject}`].filter(Boolean).join('\n');
    out.docs.push({ name, kind: 'eml', pages: null, text: `${head}\n\n${m.text}`.trim(), scanned: false, note: m.attachments.length ? `${m.attachments.length} pièce(s) jointe(s) lue(s)` : null });
    for (const a of m.attachments.slice(0, MAX_DOCS)) await readOne(`${name} › ${a.name}`, mimeOf(a.name, a.mime), a.data, out, depth + 1);
    return;
  }
  const label = /wordprocessingml|msword/.test(mime) ? 'Word' : /spreadsheetml|ms-excel/.test(mime) ? 'Excel' : null;
  out.docs.push({ name, kind: 'other', pages: null, text: '', scanned: false, note: label ? `format ${label} non lu : enregistrer en PDF ou coller le texte` : 'format non lu' });
}

/** Lit les documents (ids) du projet et prépare ce qui part au modèle. */
export async function readDocuments(projectId: string, docIds: string[]): Promise<ReadResult> {
  const out: ReadResult = { docs: [], parts: [], text: '', summary: [] };
  const ids = docIds.slice(0, MAX_DOCS);
  if (!ids.length) return out;
  const { data } = await supabaseAdmin.from('project_documents').select('id, name, mime, storage_path, size').eq('project_id', projectId).in('id', ids);
  const rows = ids.map((id) => (data || []).find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
  for (const r of rows) {
    const f = await supabaseAdmin.storage.from(PROJECT_BUCKET).download(r.storage_path);
    if (f.error || !f.data) {
      out.docs.push({ name: r.name, kind: 'other', pages: null, text: '', scanned: false, note: 'fichier introuvable dans le stockage' });
      continue;
    }
    await readOne(r.name, mimeOf(r.name, r.mime), Buffer.from(await f.data.arrayBuffer()), out);
  }
  out.text = docsPromptText(out.docs);
  out.summary = out.docs.map(docSummary);
  return out;
}
