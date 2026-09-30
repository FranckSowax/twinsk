import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatFrom, parseRecipients, sendEmail } from './email';

describe('e-mails via Resend', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it('destinataires : séparateurs variés, doublons (casse ignorée) et adresses invalides écartés', () => {
    expect(parseRecipients('overseas@actcorp.cn ; info@actcorp.cn, INFO@actcorp.cn  pas-une-adresse <sales@x.cn>')).toEqual(['overseas@actcorp.cn', 'info@actcorp.cn', 'sales@x.cn']);
    expect(parseRecipients(['a@b.co', 'a@b.co'])).toEqual(['a@b.co']);
    expect(parseRecipients('')).toEqual([]);
    expect(formatFrom({ name: 'Twinsk "Sourcing"', address: 'sourcing@twinskcompanyltd.com' })).toBe('Twinsk Sourcing <sourcing@twinskcompanyltd.com>');
  });
  it('sans clé : refus clair, aucun appel réseau', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await sendEmail({ to: ['a@b.co'], subject: 'x', text: 'y' })).toEqual({ ok: false, error: 'RESEND_API_KEY absente : envoi d’e-mails non configuré' });
    expect(f).not.toHaveBeenCalled();
  });
  it('envoi : expéditeur du pays, réponse vers l’expéditeur, étiquettes nettoyées, clé anti-doublon', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM_ADDRESS', 'sourcing@twinskcompanyltd.com');
    vi.stubEnv('EMAIL_FROM_NAME', 'Twinsk Sourcing');
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 'em_123' }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const r = await sendEmail({ to: ['sales@usine.cn', 'bad'], cc: ['c@d.fr'], subject: ' RFQ gazon ', text: 'Dear…', tags: { lot: 'Éclairage LED' }, idempotencyKey: 'p:s:n' });
    expect(r).toEqual({ ok: true, id: 'em_123' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer re_test', 'Idempotency-Key': 'p:s:n' });
    expect(JSON.parse(String(init.body))).toEqual({ from: 'Twinsk Sourcing <sourcing@twinskcompanyltd.com>', to: ['sales@usine.cn'], cc: ['c@d.fr'], subject: 'RFQ gazon', text: 'Dear…', reply_to: 'sourcing@twinskcompanyltd.com', tags: [{ name: 'lot', value: '_clairage_LED' }] });
  });
  it('refus de Resend (domaine non vérifié…) : message remonté', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM_ADDRESS', 'sourcing@twinskcompanyltd.com');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ name: 'validation_error', message: 'The twinskcompanyltd.com domain is not verified.' }), { status: 403 })));
    expect(await sendEmail({ to: ['a@b.co'], subject: 'x', text: 'y' })).toEqual({ ok: false, error: 'Resend 403 : The twinskcompanyltd.com domain is not verified.' });
  });
});
