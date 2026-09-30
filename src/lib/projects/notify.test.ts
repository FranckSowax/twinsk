import { describe, expect, it } from 'vitest';
import { buildClientMessage, buildTeamMessage, eventLabel } from './notify';

describe('notifications projet — textes', () => {
  it('message client groupé, avec le lien de son espace', () => {
    const m = buildClientMessage('PSG Academy DOM-TOM', [{ type: 'update.published', detail: 'Réception des échantillons' }, { type: 'question.replied', detail: 'Délai Guadeloupe : 45 j' }], 'https://x/projet/abc');
    expect(m).toContain('*PSG Academy DOM-TOM*');
    expect(m).toContain('• Nouvelle mise à jour : Réception des échantillons');
    expect(m).toContain('👉 Votre espace projet : https://x/projet/abc');
    expect(buildClientMessage('P', [{ type: 'order.status', detail: null }], null)).not.toContain('👉');
  });
  it('message équipe en HTML échappé, avec lien admin', () => {
    const m = buildTeamMessage('P <test>', [{ type: 'question.asked', detail: 'Prix & délai ?', actor_name: 'Client A' }], 'https://x/admin/projets/1');
    expect(m).toContain('P &lt;test&gt;');
    expect(m).toContain('Prix &amp; délai ?');
    expect(m).toContain('<b>Nouvelle question du client</b> — Client A');
    expect(eventLabel('inconnu')).toBe('inconnu');
  });
});
