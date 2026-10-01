import { describe, expect, it } from 'vitest';
import { contactHistory } from './public-server';

describe('historique des contacts usines', () => {
  it('envois plateforme et notés à la main, plus récent d’abord, objet et lot repris', () => {
    const h = contactHistory([
      { type: 'email.sent', target_id: 's1', actor_name: 'Franck', detail: 'Gazon · Fournisseur A : RFQ — gazon', data: { to: ['overseas@actcorp.cn'], channel: 'email', subject: 'RFQ — gazon', rfq_lot: 'Gazon' }, created_at: '2026-10-01T09:00:00Z' },
      { type: 'contact.manual', target_id: 's2', actor_name: 'Équipe', detail: 'Padel · Fournisseur A : WhatsApp', data: { channel: 'whatsapp', rfq_lot: 'Padel' }, created_at: '2026-10-01T11:00:00Z' },
      // Ancien format (avant l'objet structuré) : objet repris du détail.
      { type: 'email.sent', target_id: 's1', actor_name: 'Admin', detail: 'Gazon · Fournisseur A : Relance : prix FOB', data: { to: ['a@b.cn'] }, created_at: '2026-09-30T08:00:00Z' },
      { type: 'task.done', target_id: 's1', actor_name: null, detail: null, data: null, created_at: '2026-10-02T00:00:00Z' },
      { type: 'email.sent', target_id: null, actor_name: null, detail: 'test', data: null, created_at: '2026-10-02T00:00:00Z' },
    ]);
    expect(h.map((c) => `${c.supplier_id}:${c.channel}:${c.via}`)).toEqual(['s2:whatsapp:manual', 's1:email:platform', 's1:email:platform']);
    expect(h[1]).toMatchObject({ subject: 'RFQ — gazon', to: ['overseas@actcorp.cn'], lot: 'Gazon', by: 'Franck' });
    expect(h[2].subject).toBe('Relance : prix FOB');
    expect(h[0]).toMatchObject({ subject: null, to: [], lot: 'Padel' });
  });
});
