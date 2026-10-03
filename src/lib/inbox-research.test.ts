import { describe, expect, it } from 'vitest';
import { buildResearchNote, researchItems, researchNotePattern } from './inbox-research';

describe('recherches depuis la messagerie', () => {
  it('relie la recherche à la conversation et à son auteur', () => {
    const note = buildResearchNote('c-1', 'Ruth');
    expect(note).toContain('[inbox] conv:c-1');
    expect(note).toContain('Ruth');
    expect(researchNotePattern('c-1')).toBe('%[inbox] conv:c-1%');
  });

  it('une ligne pour la demande, une par photo (légende sinon début de la demande)', () => {
    const items = researchItems('  Four à gaz 2 étages\npour pizzeria  ', [
      { messageId: 'm1', caption: 'comme celui-ci' },
      { messageId: 'm2', caption: null },
    ]);
    expect(items).toEqual([
      { description: 'Four à gaz 2 étages\npour pizzeria', messageId: null },
      { description: 'comme celui-ci', messageId: 'm1' },
      { description: 'Photo du client — Four à gaz 2 étages', messageId: 'm2' },
    ]);
    expect(researchItems('', [{ messageId: 'm3', caption: '' }])).toEqual([{ description: 'Photo envoyée par le client', messageId: 'm3' }]);
    expect(researchItems('   ', [])).toEqual([]);
  });
});
