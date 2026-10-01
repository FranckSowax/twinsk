import { describe, expect, it } from 'vitest';
import { renderProjectQuotePdf } from './pdf';
import { projectPublicView, type RawForPublic } from './public';
import { initialPhases } from './logic';
import { DOM_TOM_TEMPLATE } from './templates/dom-tom';

describe('PDF du devis projet', () => {
  it('se génère depuis la projection publique (sans nom d’usine)', async () => {
    const raw: RawForPublic = {
      project: { title: 'PSG Academy DOM-TOM', description: null, currency: 'EUR', rates: {}, cover_video_at: null, status: 'active', phases: initialPhases(DOM_TOM_TEMPLATE), business_trip_interested_at: null, business_trip_quote_requested_at: null },
      steps: [], tasks: [], taskComments: [], updates: [], updateComments: [], questions: [], questionReplies: [], documents: [],
      quoteLines: DOM_TOM_TEMPLATE.quote_lines.slice(0, 4).map((l, i) => ({ id: `l${i}`, lot: l.lot, label: l.label, unit: l.unit, quantity: l.quantity, client_quantity: null, unit_price: 12 + i, price_currency: 'EUR', validated_snapshot: null, optional: l.optional, enabled: true, status: i === 0 ? 'validated' : 'draft', phase: l.phase, validated_at: null, supplier_id: i === 0 ? 's' : null })),
      orders: [], suppliers: [{ id: 's', lot: 'Gazon', alias: 'Fournisseur A', status: 'candidate', scores: {}, score: null, description: null, product_specs: [], certifications: [], years_experience: null, capacity: null, lead_time: null, moq: null, sample_status: null, country: null, product_photos: [] }], finalReports: [],
    };
    const buf = await renderProjectQuotePdf(projectPublicView(raw, 't'), 'PSG Academy');
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(2000);
  }, 30000);
});
