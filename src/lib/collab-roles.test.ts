import { describe, expect, it } from 'vitest';
import { COLLAB_ROLE_NAV, collabCanAccessPath } from './collab-roles';

describe('rôles collaborateurs — accès aux projets', () => {
  it('Sourcing (B2C + B2B) et Production ouvrent /admin/projets et le voient dans le menu', () => {
    for (const role of ['sourcing', 'production'] as const) {
      expect(collabCanAccessPath(role, '/admin/projets')).toBe(true);
      expect(collabCanAccessPath(role, '/admin/projets/2e231169-e292-49d8-8320-d6401478d6f7')).toBe(true);
      expect(COLLAB_ROLE_NAV[role]).toContain('/admin/projets');
    }
  });
  it('Commandes et WhatsApp n’y ont pas accès', () => {
    for (const role of ['commandes', 'whatsapp'] as const) {
      expect(collabCanAccessPath(role, '/admin/projets')).toBe(false);
      expect(COLLAB_ROLE_NAV[role]).not.toContain('/admin/projets');
    }
  });
});
