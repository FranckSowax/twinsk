# Espace Agents Gabon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner aux agents TWINSK au Gabon un espace mobile-first, accessible par le lien `/agent` avec connexion OTP WhatsApp, pour encaisser les paiements et piloter la logistique des commandes.

**Architecture:** Réutilise les patterns d'auth de `src/lib/collab.ts` (cookie HMAC stateless relu en base, scrypt/HMAC via `crypto` natif). Toute la logique testable (normalisation numéro, jeton, OTP, garde de transitions, rate-limit) vit dans `src/lib/agent.ts` et est couverte par vitest ; les routes API et l'UI la câblent à Supabase et WHAPI. Les notifications client passent par `sendWhapiText` (best-effort).

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19 (client components), TypeScript, Tailwind 4, Supabase (`supabaseAdmin` service role), WHAPI, vitest, `crypto` natif (aucune nouvelle dépendance).

## Global Constraints

- **Aucune nouvelle dépendance npm** — uniquement `crypto` natif, Supabase et WHAPI déjà présents.
- **Migrations idempotentes** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), appliquées manuellement au SQL Editor. Fichier : `supabase-migration-44.sql`.
- **Secret HMAC** : `process.env.ADMIN_PASSWORD` (même source que `collab.ts`).
- **Format Chat ID WHAPI** : `<chiffres>@s.whatsapp.net` via `toWhatsappChatId()` de `src/lib/order-number.ts`.
- **N° de commande** : `orderNumber(id)` de `src/lib/order-number.ts` (`CMD-XXXXXXXX`).
- **Pipeline `order_status`** : `unpaid → paid → shipped → at_agency → delivered`.
- **Cookie session** : nom `agent_token`, `httpOnly`, `secure`, `sameSite=lax`, `path=/`, `maxAge = 2592000` (30 j).
- **OTP** : 6 chiffres, TTL 10 min, usage unique, hashé (jamais en clair) ; rate-limit 3 / 10 min ; réponse générique anti-énumération.
- **Vérification** : chaque tâche finit par `npx tsc --noEmit` vert ; les tâches à logique pure ajoutent des tests vitest (`npm test`) ; la tâche finale par `npm run build`.

---

## File Structure

- `supabase-migration-44.sql` — tables `agents`, `agent_otps`, `agent_actions` + colonnes `offer_orders`.
- `src/lib/agent.ts` — auth OTP + session + gardes (logique pure + `getAgent`).
- `src/lib/agent.test.ts` — tests unitaires vitest de la logique pure.
- `src/app/api/agent/otp/request/route.ts` — demande OTP.
- `src/app/api/agent/otp/verify/route.ts` — vérifie OTP, pose le cookie.
- `src/app/api/agent/me/route.ts` — session courante.
- `src/app/api/agent/logout/route.ts` — déconnexion.
- `src/app/api/agent/orders/route.ts` — liste + filtres.
- `src/app/api/agent/orders/[id]/route.ts` — détail + historique.
- `src/app/api/agent/orders/[id]/collect-cash/route.ts`
- `src/app/api/agent/orders/[id]/validate-payment/route.ts`
- `src/app/api/agent/orders/[id]/ship/route.ts`
- `src/app/api/agent/orders/[id]/receive/route.ts`
- `src/app/api/agent/orders/[id]/deliver/route.ts`
- `src/lib/agent-actions.ts` — helper partagé de transition + log + notif (DRY entre les 5 routes d'action).
- `src/app/agent/page.tsx` — shell serveur.
- `src/components/agent/AgentApp.tsx` — client, aiguille login ↔ app.
- `src/components/agent/AgentLogin.tsx` — écran login OTP.
- `src/components/agent/AgentOrders.tsx` — liste + onglets.
- `src/components/agent/AgentOrderDetail.tsx` — détail + boutons d'action.
- `src/app/api/admin/agents/route.ts` — liste/création (admin).
- `src/app/api/admin/agents/[id]/route.ts` — activation/désactivation (admin).
- `src/app/admin/agents/page.tsx` — onglet admin « Agents Gabon » (+ lien depuis la nav admin existante).
- `src/app/admin/commandes/page.tsx` — ajout de l'étape `at_agency` au pipeline (modif).

---

## Task 1: Migration SQL (tables + colonnes)

**Files:**
- Create: `supabase-migration-44.sql`

**Interfaces:**
- Produces: tables `agents(id, name, phone, active, created_at)`, `agent_otps(id, agent_id, code_hash, expires_at, consumed_at, created_at)`, `agent_actions(id, agent_id, order_id, action, meta, created_at)` ; colonnes `offer_orders.cash_collected_by (uuid)`, `offer_orders.cash_collected_at (timestamptz)`.

- [ ] **Step 1: Écrire la migration**

```sql
-- ================================================
-- Twinsk — Migration #44
-- Espace Agents Gabon : whitelist agents, OTP WhatsApp, audit des actions,
-- suivi de l'encaissement cash. Idempotente. À exécuter dans le SQL Editor.
-- ================================================

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agents_phone_key ON agents (phone);

CREATE TABLE IF NOT EXISTS agent_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_otps_agent_idx ON agent_otps (agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES offer_orders(id) ON DELETE CASCADE,
  action text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_actions_order_idx ON agent_actions (order_id, created_at DESC);

ALTER TABLE offer_orders
  ADD COLUMN IF NOT EXISTS cash_collected_by uuid,
  ADD COLUMN IF NOT EXISTS cash_collected_at timestamptz;

-- ================================================
-- ROLLBACK
-- ================================================
-- ALTER TABLE offer_orders DROP COLUMN IF EXISTS cash_collected_by, DROP COLUMN IF EXISTS cash_collected_at;
-- DROP TABLE IF EXISTS agent_actions;
-- DROP TABLE IF EXISTS agent_otps;
-- DROP TABLE IF EXISTS agents;
```

- [ ] **Step 2: Commit**

```bash
git add supabase-migration-44.sql
git commit -m "feat(agents): migration 44 — tables agents/otp/actions + colonnes encaissement"
```

> Note d'exécution : la migration doit être appliquée manuellement au SQL Editor Supabase avant de tester en prod. Les routes des tâches suivantes sont écrites pour rester résilientes au typecheck sans la migration (elles n'échouent qu'à l'exécution si les tables manquent).

---

## Task 2: Logique d'auth pure + tests (`src/lib/agent.ts`)

**Files:**
- Create: `src/lib/agent.ts`
- Test: `src/lib/agent.test.ts`

**Interfaces:**
- Produces :
  - `normalizePhone(phone: string | null | undefined): string` — chiffres uniquement.
  - `signAgentToken(id: string): string` — `<id>.<hmac base64url>`.
  - `parseAgentToken(token: string | undefined): string | null` — id vérifié ou null.
  - `generateOtpCode(): string` — 6 chiffres (`crypto.randomInt`).
  - `hashOtp(code: string): string` — HMAC-SHA256 hex sur `ADMIN_PASSWORD`.
  - `verifyOtpHash(code: string, hash: string): boolean` — comparaison `timingSafeEqual`.
  - `otpRateLimited(recentCount: number): boolean` — `recentCount >= 3`.
  - `type AgentOrderStatus = 'unpaid' | 'paid' | 'shipped' | 'at_agency' | 'delivered'`.
  - `canAdvanceTo(from: AgentOrderStatus, to: AgentOrderStatus): boolean` — n'autorise qu'une avance d'une étape dans l'ordre, et rejoue idempotent si `from === to`.
  - `AGENT_COOKIE = 'agent_token'`, `SESSION_MAX_AGE = 2592000`, `OTP_TTL_MS = 600000`.
  - `getAgent(request: NextRequest): Promise<{ id: string; name: string } | null>` — relit l'agent actif en base.

- [ ] **Step 1: Écrire les tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  normalizePhone, signAgentToken, parseAgentToken,
  generateOtpCode, hashOtp, verifyOtpHash, otpRateLimited, canAdvanceTo,
} from './agent';

describe('normalizePhone', () => {
  it('ne garde que les chiffres', () => {
    expect(normalizePhone('+241 06 12-34-56')).toBe('241061234 56'.replace(/\s/g, ''));
  });
  it('null/undefined → chaîne vide', () => {
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });
});

describe('agent token', () => {
  it('round-trip : parse(sign(id)) === id', () => {
    expect(parseAgentToken(signAgentToken('abc-123'))).toBe('abc-123');
  });
  it('jeton falsifié → null', () => {
    const t = signAgentToken('abc-123');
    expect(parseAgentToken(t.slice(0, -2) + 'xx')).toBeNull();
  });
  it('jeton vide/malformé → null', () => {
    expect(parseAgentToken(undefined)).toBeNull();
    expect(parseAgentToken('nodot')).toBeNull();
  });
});

describe('OTP', () => {
  it('génère 6 chiffres', () => {
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
  it('hash + vérif : le bon code valide, un autre non', () => {
    const h = hashOtp('123456');
    expect(verifyOtpHash('123456', h)).toBe(true);
    expect(verifyOtpHash('000000', h)).toBe(false);
  });
});

describe('otpRateLimited', () => {
  it('bloque à partir de 3 demandes récentes', () => {
    expect(otpRateLimited(2)).toBe(false);
    expect(otpRateLimited(3)).toBe(true);
  });
});

describe('canAdvanceTo', () => {
  it('avance d’une étape autorisée', () => {
    expect(canAdvanceTo('paid', 'shipped')).toBe(true);
    expect(canAdvanceTo('shipped', 'at_agency')).toBe(true);
    expect(canAdvanceTo('at_agency', 'delivered')).toBe(true);
  });
  it('rejeu idempotent autorisé (même étape)', () => {
    expect(canAdvanceTo('shipped', 'shipped')).toBe(true);
  });
  it('saut d’étape ou retour interdit', () => {
    expect(canAdvanceTo('paid', 'delivered')).toBe(false);
    expect(canAdvanceTo('at_agency', 'shipped')).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests → échec (module absent)**

Run: `npm test -- src/lib/agent.test.ts`
Expected: FAIL (`Cannot find module './agent'`).

- [ ] **Step 3: Implémenter `src/lib/agent.ts`**

```ts
// Auth agents Gabon : cookie HMAC stateless relu en base, OTP WhatsApp hashé.
// Réutilise les patterns de collab.ts (crypto natif, timingSafeEqual).
import crypto from 'crypto';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from './supabase/server';

const SECRET = process.env.ADMIN_PASSWORD || 'twinsk-dev-secret';

export const AGENT_COOKIE = 'agent_token';
export const SESSION_MAX_AGE = 2592000; // 30 jours (secondes)
export const OTP_TTL_MS = 600000; // 10 minutes

export function normalizePhone(phone: string | null | undefined): string {
  return (phone || '').replace(/\D/g, '');
}

export function signAgentToken(id: string): string {
  const sig = crypto.createHmac('sha256', SECRET).update(id).digest('base64url');
  return `${id}.${sig}`;
}

export function parseAgentToken(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;
  const id = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(id).digest('base64url');
  try {
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return id;
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(code: string): string {
  return crypto.createHmac('sha256', SECRET).update(code).digest('hex');
}

export function verifyOtpHash(code: string, hash: string): boolean {
  const test = hashOtp(code);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(test, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function otpRateLimited(recentCount: number): boolean {
  return recentCount >= 3;
}

export type AgentOrderStatus = 'unpaid' | 'paid' | 'shipped' | 'at_agency' | 'delivered';
const ORDER: AgentOrderStatus[] = ['unpaid', 'paid', 'shipped', 'at_agency', 'delivered'];

export function canAdvanceTo(from: AgentOrderStatus, to: AgentOrderStatus): boolean {
  const fi = ORDER.indexOf(from);
  const ti = ORDER.indexOf(to);
  if (fi < 0 || ti < 0) return false;
  return ti === fi || ti === fi + 1;
}

export async function getAgent(
  request: NextRequest,
): Promise<{ id: string; name: string } | null> {
  const id = parseAgentToken(request.cookies.get(AGENT_COOKIE)?.value);
  if (!id) return null;
  const { data } = await supabaseAdmin
    .from('agents')
    .select('id, name, active')
    .eq('id', id)
    .single();
  if (!data || !data.active) return null;
  return { id: data.id, name: data.name };
}
```

- [ ] **Step 4: Lancer les tests → succès**

Run: `npm test -- src/lib/agent.test.ts`
Expected: PASS (tous verts).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent.ts src/lib/agent.test.ts
git commit -m "feat(agents): lib auth OTP + gardes de transition (testée)"
```

---

## Task 3: Routes OTP + session (`request`, `verify`, `me`, `logout`)

**Files:**
- Create: `src/app/api/agent/otp/request/route.ts`
- Create: `src/app/api/agent/otp/verify/route.ts`
- Create: `src/app/api/agent/me/route.ts`
- Create: `src/app/api/agent/logout/route.ts`

**Interfaces:**
- Consumes : tout `src/lib/agent.ts` ; `sendWhapiText` (`src/lib/whapi.ts`) ; `toWhatsappChatId` (`src/lib/order-number.ts`).
- Produces :
  - `POST /api/agent/otp/request` `{ phone }` → toujours `{ success: true }`.
  - `POST /api/agent/otp/verify` `{ phone, code }` → `{ success: true, agent }` + cookie, ou `401 { error }`.
  - `GET /api/agent/me` → `{ agent: { id, name } | null }`.
  - `POST /api/agent/logout` → `{ success: true }` + cookie effacé.

- [ ] **Step 1: `otp/request/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhapiText } from '@/lib/whapi';
import { toWhatsappChatId } from '@/lib/order-number';
import { normalizePhone, generateOtpCode, hashOtp, otpRateLimited, OTP_TTL_MS } from '@/lib/agent';

// Réponse TOUJOURS générique (anti-énumération) : on n'indique jamais si le numéro existe.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string };
  const phone = normalizePhone(body.phone);
  const generic = NextResponse.json({ success: true });
  if (phone.length < 6) return generic;

  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('id, phone, active')
    .eq('phone', phone)
    .eq('active', true)
    .single();
  if (!agent) return generic;

  // Rate-limit : compte les OTP créés dans les 10 dernières minutes.
  const since = new Date(Date.now() - OTP_TTL_MS).toISOString();
  const { count } = await supabaseAdmin
    .from('agent_otps')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agent.id)
    .gte('created_at', since);
  if (otpRateLimited(count || 0)) return generic;

  const code = generateOtpCode();
  await supabaseAdmin.from('agent_otps').insert({
    agent_id: agent.id,
    code_hash: hashOtp(code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });

  const chat = toWhatsappChatId(agent.phone);
  if (chat) {
    try {
      await sendWhapiText(
        `🔐 *TWINSK — Espace agents*\nVotre code de connexion : *${code}*\nValable 10 minutes. Ne le partagez pas.`,
        chat,
      );
    } catch {
      // best-effort
    }
  }
  return generic;
}
```

- [ ] **Step 2: `otp/verify/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  normalizePhone, verifyOtpHash, signAgentToken, AGENT_COOKIE, SESSION_MAX_AGE,
} from '@/lib/agent';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string; code?: string };
  const phone = normalizePhone(body.phone);
  const code = (body.code || '').replace(/\D/g, '');
  const fail = () => NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 401 });
  if (phone.length < 6 || code.length !== 6) return fail();

  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('id, name, active')
    .eq('phone', phone)
    .eq('active', true)
    .single();
  if (!agent) return fail();

  const { data: otp } = await supabaseAdmin
    .from('agent_otps')
    .select('id, code_hash, expires_at, consumed_at')
    .eq('agent_id', agent.id)
    .is('consumed_at', null)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (!otp || !verifyOtpHash(code, otp.code_hash)) return fail();

  await supabaseAdmin.from('agent_otps').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);

  const res = NextResponse.json({ success: true, agent: { id: agent.id, name: agent.name } });
  res.cookies.set(AGENT_COOKIE, signAgentToken(agent.id), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE,
  });
  return res;
}
```

- [ ] **Step 3: `me/route.ts` et `logout/route.ts`**

```ts
// me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent';

export async function GET(request: NextRequest) {
  const agent = await getAgent(request);
  return NextResponse.json({ agent });
}
```

```ts
// logout/route.ts
import { NextResponse } from 'next/server';
import { AGENT_COOKIE } from '@/lib/agent';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(AGENT_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/agent/otp src/app/api/agent/me src/app/api/agent/logout
git commit -m "feat(agents): routes OTP request/verify + session me/logout"
```

---

## Task 4: Helper d'action partagé + route liste + route détail

**Files:**
- Create: `src/lib/agent-actions.ts`
- Create: `src/app/api/agent/orders/route.ts`
- Create: `src/app/api/agent/orders/[id]/route.ts`

**Interfaces:**
- Consumes : `getAgent`, `canAdvanceTo`, `AgentOrderStatus` ; `orderNumber`, `toWhatsappChatId` ; `sendWhapiText`.
- Produces :
  - `logAgentAction(agentId, orderId, action, meta?)` : insert dans `agent_actions`.
  - `notifyClient(order, text)` : WHAPI best-effort au client.
  - `GET /api/agent/orders?filter=to_collect|to_ship|to_receive|to_deliver|all` → `{ orders: AgentOrderRow[] }`.
  - `GET /api/agent/orders/[id]` → `{ order, lines, actions }`.
  - Type `AgentOrderRow = { id, order_number, client_name, client_phone, grand_total_fcfa, items_total_fcfa, payment_method, payment_status, order_status, transport_mode, created_at }`.

- [ ] **Step 1: `src/lib/agent-actions.ts`**

```ts
// Helpers partagés par les 5 routes d'action agent (DRY) : audit + notif client.
import { supabaseAdmin } from './supabase/server';
import { sendWhapiText } from './whapi';
import { toWhatsappChatId } from './order-number';

export async function logAgentAction(
  agentId: string, orderId: string, action: string, meta?: Record<string, unknown>,
): Promise<void> {
  await supabaseAdmin.from('agent_actions').insert({
    agent_id: agentId, order_id: orderId, action, meta: meta ?? null,
  });
}

export async function notifyClient(
  clientPhone: string | null | undefined, text: string,
): Promise<void> {
  const chat = toWhatsappChatId(clientPhone);
  if (!chat) return;
  try {
    await sendWhapiText(text, chat);
  } catch {
    // best-effort
  }
}
```

- [ ] **Step 2: `orders/route.ts` (liste + filtres)**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent } from '@/lib/agent';
import { orderNumber } from '@/lib/order-number';

export async function GET(request: NextRequest) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const filter = request.nextUrl.searchParams.get('filter') || 'all';
  let q = supabaseAdmin
    .from('offer_orders')
    .select('id, client_name, client_phone, grand_total_fcfa, items_total_fcfa, payment_method, payment_status, order_status, transport_mode, created_at, status')
    .neq('status', 'cart') // on ignore les paniers abandonnés
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter === 'to_collect') q = q.neq('payment_status', 'paid');
  else if (filter === 'to_ship') q = q.eq('payment_status', 'paid').eq('order_status', 'paid');
  else if (filter === 'to_receive') q = q.eq('order_status', 'shipped');
  else if (filter === 'to_deliver') q = q.eq('order_status', 'at_agency');

  const { data } = await q;
  const orders = (data || []).map((o) => ({ ...o, order_number: orderNumber(o.id) }));
  return NextResponse.json({ orders });
}
```

- [ ] **Step 3: `orders/[id]/route.ts` (détail + historique)**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent } from '@/lib/agent';
import { orderNumber } from '@/lib/order-number';
import { CNY_TO_FCFA } from '@/lib/offer-pricing';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;

  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('*, offer_order_lines(*)')
    .eq('id', id)
    .single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });

  const { data: actions } = await supabaseAdmin
    .from('agent_actions')
    .select('action, meta, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: false });

  type Line = { unit_price_cny?: number; subtotal_cny?: number; [k: string]: unknown };
  const lines = ((order.offer_order_lines || []) as Line[]).map((l) => ({
    ...l,
    subtotal_fcfa: (Number(l.subtotal_cny) || 0) * CNY_TO_FCFA,
  }));

  return NextResponse.json({
    order: { ...order, order_number: orderNumber(order.id), offer_order_lines: undefined },
    lines,
    actions: actions || [],
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-actions.ts src/app/api/agent/orders/route.ts "src/app/api/agent/orders/[id]/route.ts"
git commit -m "feat(agents): helper actions + routes liste/détail commandes"
```

---

## Task 5: Routes d'action (encaisser, valider, expédier, réceptionner, remettre)

**Files:**
- Create: `src/app/api/agent/orders/[id]/collect-cash/route.ts`
- Create: `src/app/api/agent/orders/[id]/validate-payment/route.ts`
- Create: `src/app/api/agent/orders/[id]/ship/route.ts`
- Create: `src/app/api/agent/orders/[id]/receive/route.ts`
- Create: `src/app/api/agent/orders/[id]/deliver/route.ts`

**Interfaces:**
- Consumes : `getAgent`, `canAdvanceTo`, `AgentOrderStatus` ; `logAgentAction`, `notifyClient` ; `orderNumber`.
- Produces : chaque route `POST` → `{ success: true, order_status }` ou `{ error }` (401/404/409).

- [ ] **Step 1: `collect-cash/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent } from '@/lib/agent';
import { logAgentAction, notifyClient } from '@/lib/agent-actions';
import { orderNumber } from '@/lib/order-number';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;

  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('id, client_name, client_phone, grand_total_fcfa, items_total_fcfa, payment_status, order_status')
    .eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (order.payment_status === 'paid') return NextResponse.json({ error: 'Déjà payée' }, { status: 409 });

  const nextStatus = order.order_status === 'unpaid' || !order.order_status ? 'paid' : order.order_status;
  const amount = Number(order.grand_total_fcfa ?? order.items_total_fcfa) || 0;
  await supabaseAdmin.from('offer_orders').update({
    payment_status: 'paid', payment_method: 'cash', order_status: nextStatus,
    cash_collected_by: agent.id, cash_collected_at: new Date().toISOString(),
  }).eq('id', id);

  await logAgentAction(agent.id, id, 'collect_cash', { amount_fcfa: amount });
  await notifyClient(
    order.client_phone,
    `✅ *Paiement reçu* — Commande ${orderNumber(id)}\nNous avons bien encaissé ${Math.round(amount).toLocaleString('fr-FR')} FCFA. Merci !`,
  );
  return NextResponse.json({ success: true, order_status: nextStatus });
}
```

- [ ] **Step 2: `validate-payment/route.ts`** (Airtel/eBilling — sans encaissement cash)

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent } from '@/lib/agent';
import { logAgentAction, notifyClient } from '@/lib/agent-actions';
import { orderNumber } from '@/lib/order-number';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;

  const { data: order } = await supabaseAdmin
    .from('offer_orders')
    .select('id, client_phone, payment_status, order_status')
    .eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (order.payment_status === 'paid') return NextResponse.json({ error: 'Déjà payée' }, { status: 409 });

  const nextStatus = order.order_status === 'unpaid' || !order.order_status ? 'paid' : order.order_status;
  await supabaseAdmin.from('offer_orders').update({
    payment_status: 'paid', order_status: nextStatus,
  }).eq('id', id);

  await logAgentAction(agent.id, id, 'validate_payment', {});
  await notifyClient(order.client_phone, `✅ Paiement validé — Commande ${orderNumber(id)}. Merci !`);
  return NextResponse.json({ success: true, order_status: nextStatus });
}
```

- [ ] **Step 3: `ship/route.ts`, `receive/route.ts`, `deliver/route.ts`** (transitions gardées + notifs)

```ts
// ship/route.ts — paid → shipped
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent, canAdvanceTo, AgentOrderStatus } from '@/lib/agent';
import { logAgentAction, notifyClient } from '@/lib/agent-actions';
import { orderNumber } from '@/lib/order-number';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const { data: order } = await supabaseAdmin
    .from('offer_orders').select('id, client_phone, payment_status, order_status').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (order.payment_status !== 'paid') return NextResponse.json({ error: 'Commande non payée' }, { status: 409 });
  const from = (order.order_status || 'unpaid') as AgentOrderStatus;
  if (!canAdvanceTo(from, 'shipped')) return NextResponse.json({ error: 'Transition invalide' }, { status: 409 });
  await supabaseAdmin.from('offer_orders').update({ order_status: 'shipped' }).eq('id', id);
  await logAgentAction(agent.id, id, 'ship', {});
  await notifyClient(order.client_phone, `📦 Votre commande ${orderNumber(id)} a été *expédiée*. Suivi à venir.`);
  return NextResponse.json({ success: true, order_status: 'shipped' });
}
```

```ts
// receive/route.ts — shipped → at_agency (+ « venez retirer »)
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent, canAdvanceTo, AgentOrderStatus } from '@/lib/agent';
import { logAgentAction, notifyClient } from '@/lib/agent-actions';
import { orderNumber } from '@/lib/order-number';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const { data: order } = await supabaseAdmin
    .from('offer_orders').select('id, client_name, client_phone, order_status').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const from = (order.order_status || 'unpaid') as AgentOrderStatus;
  if (!canAdvanceTo(from, 'at_agency')) return NextResponse.json({ error: 'Transition invalide' }, { status: 409 });
  await supabaseAdmin.from('offer_orders').update({ order_status: 'at_agency' }).eq('id', id);
  await logAgentAction(agent.id, id, 'receive', {});
  await notifyClient(
    order.client_phone,
    `🎉 Bonne nouvelle ${order.client_name || ''} ! Votre colis (${orderNumber(id)}) est *arrivé à l'agence TWINSK*. Venez le retirer.`,
  );
  return NextResponse.json({ success: true, order_status: 'at_agency' });
}
```

```ts
// deliver/route.ts — at_agency → delivered (+ confirmation)
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getAgent, canAdvanceTo, AgentOrderStatus } from '@/lib/agent';
import { logAgentAction, notifyClient } from '@/lib/agent-actions';
import { orderNumber } from '@/lib/order-number';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await getAgent(request);
  if (!agent) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const { data: order } = await supabaseAdmin
    .from('offer_orders').select('id, client_phone, order_status').eq('id', id).single();
  if (!order) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  const from = (order.order_status || 'unpaid') as AgentOrderStatus;
  if (!canAdvanceTo(from, 'delivered')) return NextResponse.json({ error: 'Transition invalide' }, { status: 409 });
  await supabaseAdmin.from('offer_orders').update({ order_status: 'delivered' }).eq('id', id);
  await logAgentAction(agent.id, id, 'deliver', {});
  await notifyClient(order.client_phone, `🤝 Votre commande ${orderNumber(id)} vous a été *remise*. Merci de votre confiance !`);
  return NextResponse.json({ success: true, order_status: 'delivered' });
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/agent/orders/[id]"
git commit -m "feat(agents): routes d'action encaisser/valider/expédier/réceptionner/remettre"
```

---

## Task 6: UI login OTP (`AgentLogin` + shell)

**Files:**
- Create: `src/app/agent/page.tsx`
- Create: `src/components/agent/AgentApp.tsx`
- Create: `src/components/agent/AgentLogin.tsx`

**Interfaces:**
- Consumes : routes `GET /api/agent/me`, `POST /api/agent/otp/request`, `POST /api/agent/otp/verify`, `POST /api/agent/logout`.
- Produces : `AgentApp` (client) qui, selon `/api/agent/me`, affiche `AgentLogin` (déconnecté) ou `AgentOrders` (Task 7). `AgentLogin` prop : `onAuthed(agent)`.

- [ ] **Step 1: `src/app/agent/page.tsx` (shell serveur)**

```tsx
import AgentApp from '@/components/agent/AgentApp';

export const metadata = { title: 'TWINSK — Espace agents' };

export default function AgentPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <AgentApp />
    </main>
  );
}
```

- [ ] **Step 2: `src/components/agent/AgentApp.tsx`**

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import AgentLogin from './AgentLogin';
import AgentOrders from './AgentOrders';

type Agent = { id: string; name: string };

export default function AgentApp() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/agent/me');
      const j = await r.json();
      setAgent(j.agent ?? null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    await fetch('/api/agent/logout', { method: 'POST' });
    setAgent(null);
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>;
  }
  if (!agent) return <AgentLogin onAuthed={setAgent} />;
  return <AgentOrders agent={agent} onLogout={logout} />;
}
```

- [ ] **Step 3: `src/components/agent/AgentLogin.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { Loader2, Smartphone, KeyRound } from 'lucide-react';

type Agent = { id: string; name: string };

export default function AgentLogin({ onAuthed }: { onAuthed: (a: Agent) => void }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async () => {
    setBusy(true); setError('');
    try {
      await fetch('/api/agent/otp/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      setStep('code');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/agent/otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Code invalide'); return; }
      onAuthed(j.agent);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-center font-display text-2xl font-bold text-slate-900">Espace agents</h1>
      <p className="mb-6 text-center text-sm text-slate-500">TWINSK Gabon</p>

      {step === 'phone' ? (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Smartphone className="h-4 w-4" /> Votre numéro WhatsApp</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
            placeholder="+241 ..." className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg" />
          <button onClick={requestOtp} disabled={busy || phone.replace(/\D/g, '').length < 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Recevoir le code
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><KeyRound className="h-4 w-4" /> Code reçu par WhatsApp</label>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" placeholder="123456" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.4em]" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={verify} disabled={busy || code.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Se connecter
          </button>
          <button onClick={() => setStep('phone')} className="w-full text-center text-xs text-slate-400">Changer de numéro</button>
        </div>
      )}
      <p className="mt-4 text-center text-xs text-slate-400">Accès réservé aux agents autorisés.</p>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck** (échouera tant que `AgentOrders` n'existe pas — c'est attendu, corrigé en Task 7 ; on peut créer un stub minimal ici)

Créer un stub temporaire `src/components/agent/AgentOrders.tsx` pour compiler :

```tsx
'use client';
export default function AgentOrders({ agent, onLogout }: { agent: { id: string; name: string }; onLogout: () => void }) {
  return <div className="p-6">Connecté : {agent.name} <button onClick={onLogout}>Déconnexion</button></div>;
}
```

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/app/agent src/components/agent
git commit -m "feat(agents): UI login OTP (shell + AgentApp + AgentLogin + stub liste)"
```

---

## Task 7: UI liste + détail commandes (`AgentOrders`, `AgentOrderDetail`)

**Files:**
- Modify (remplace le stub): `src/components/agent/AgentOrders.tsx`
- Create: `src/components/agent/AgentOrderDetail.tsx`

**Interfaces:**
- Consumes : `GET /api/agent/orders?filter=`, `GET /api/agent/orders/[id]`, les 5 routes d'action ; `orderNumber` non requis côté client (le n° vient de l'API sous `order_number`).
- Produces : écran liste avec onglets + navigation vers `AgentOrderDetail` ; détail avec boutons d'action contextuels appelant les routes puis rafraîchissant.

- [ ] **Step 1: `AgentOrders.tsx` (liste + onglets)**

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut, RefreshCw } from 'lucide-react';
import AgentOrderDetail from './AgentOrderDetail';

type Agent = { id: string; name: string };
type Row = {
  id: string; order_number: string; client_name: string | null; client_phone: string | null;
  grand_total_fcfa: number | null; items_total_fcfa: number | null;
  payment_method: string | null; payment_status: string; order_status: string | null;
  transport_mode: string | null; created_at: string;
};

const TABS: { key: string; label: string }[] = [
  { key: 'to_collect', label: 'À encaisser' },
  { key: 'to_ship', label: 'À expédier' },
  { key: 'to_receive', label: 'À réceptionner' },
  { key: 'to_deliver', label: 'À remettre' },
  { key: 'all', label: 'Toutes' },
];
const fmt = (n: number | null) => (n != null ? `${Math.round(n).toLocaleString('fr-FR')} FCFA` : '—');

export default function AgentOrders({ agent, onLogout }: { agent: Agent; onLogout: () => void }) {
  const [tab, setTab] = useState('to_collect');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agent/orders?filter=${tab}`);
      const j = await r.json();
      setRows(j.orders || []);
    } finally { setLoading(false); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  if (openId) {
    return <AgentOrderDetail id={openId} onBack={() => { setOpenId(null); load(); }} />;
  }

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div><p className="text-xs text-slate-400">Agent</p><p className="font-semibold text-slate-900">{agent.name}</p></div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={onLogout} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-slate-400">Aucune commande.</p>
      ) : (
        <ul className="space-y-2 px-4">
          {rows.map((o) => (
            <li key={o.id}>
              <button onClick={() => setOpenId(o.id)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">{o.order_number}</span>
                  <span className="font-semibold text-emerald-700">{fmt(o.grand_total_fcfa ?? o.items_total_fcfa)}</span>
                </div>
                <p className="mt-1 font-semibold text-slate-900">{o.client_name || 'Client'}</p>
                <p className="text-xs text-slate-400">
                  {o.payment_status === 'paid' ? 'Payé' : 'À encaisser'} · {o.order_status || 'unpaid'}
                  {o.payment_method ? ` · ${o.payment_method}` : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `AgentOrderDetail.tsx` (détail + actions contextuelles)**

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Banknote, CheckCircle2, Plane, PackageCheck, HandHeart, Tag } from 'lucide-react';

type Line = { id: string; product_title?: string | null; variant_name?: string | null; quantity: number; subtotal_fcfa?: number };
type Order = {
  id: string; order_number: string; client_name: string | null; client_phone: string | null;
  grand_total_fcfa: number | null; items_total_fcfa: number | null;
  payment_method: string | null; payment_status: string; order_status: string | null; transport_mode: string | null;
};
type Action = { action: string; created_at: string };
const fmt = (n: number | null | undefined) => (n != null ? `${Math.round(n).toLocaleString('fr-FR')} FCFA` : '—');
const ACTION_LABEL: Record<string, string> = {
  collect_cash: 'Cash encaissé', validate_payment: 'Paiement validé',
  ship: 'Expédié', receive: 'Reçu à l’agence', deliver: 'Remis au client',
};

export default function AgentOrderDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/agent/orders/${id}`);
      const j = await r.json();
      setOrder(j.order); setLines(j.lines || []); setActions(j.actions || []);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (path: string) => {
    setBusy(path); setError('');
    try {
      const r = await fetch(`/api/agent/orders/${id}/${path}`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Erreur'); return; }
      await load();
    } finally { setBusy(''); }
  };

  if (loading || !order) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>;
  }

  const paid = order.payment_status === 'paid';
  const st = order.order_status || 'unpaid';
  const total = order.grand_total_fcfa ?? order.items_total_fcfa;

  return (
    <div className="mx-auto max-w-md pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <button onClick={onBack} className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>
        <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">{order.order_number}</span>
      </header>

      <section className="space-y-1 border-b border-slate-100 bg-white px-4 py-4">
        <p className="font-semibold text-slate-900">{order.client_name || 'Client'}</p>
        {order.client_phone && <p className="text-sm text-slate-500">{order.client_phone}</p>}
        <p className="text-lg font-bold text-emerald-700">{fmt(total)}</p>
        <p className="text-xs text-slate-400">
          {paid ? 'Payé' : 'Non payé'} · {st}{order.payment_method ? ` · ${order.payment_method}` : ''}
          {order.transport_mode ? ` · ${order.transport_mode}` : ''}
        </p>
      </section>

      <section className="border-b border-slate-100 bg-white px-4 py-3">
        {lines.map((l) => (
          <div key={l.id} className="flex justify-between py-1 text-sm">
            <span className="text-slate-700">{l.product_title || 'Produit'}{l.variant_name ? ` — ${l.variant_name}` : ''} ×{l.quantity}</span>
            <span className="text-slate-500">{fmt(l.subtotal_fcfa)}</span>
          </div>
        ))}
      </section>

      {/* Actions contextuelles */}
      <section className="space-y-2 px-4 py-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        {!paid && (
          <>
            <ActionBtn icon={<Banknote className="h-5 w-5" />} label="Encaisser le cash" color="amber"
              busy={busy === 'collect-cash'} onClick={() => act('collect-cash')} />
            <ActionBtn icon={<CheckCircle2 className="h-5 w-5" />} label="Valider le paiement (Airtel/eBilling)" color="emerald"
              busy={busy === 'validate-payment'} onClick={() => act('validate-payment')} />
          </>
        )}
        {paid && st === 'paid' && (
          <ActionBtn icon={<Plane className="h-5 w-5" />} label="Marquer expédié" color="blue"
            busy={busy === 'ship'} onClick={() => act('ship')} />
        )}
        {st === 'shipped' && (
          <ActionBtn icon={<PackageCheck className="h-5 w-5" />} label="Réceptionner le colis" color="indigo"
            busy={busy === 'receive'} onClick={() => act('receive')} />
        )}
        {st === 'at_agency' && (
          <ActionBtn icon={<HandHeart className="h-5 w-5" />} label="Remettre au client" color="purple"
            busy={busy === 'deliver'} onClick={() => act('deliver')} />
        )}
        {paid && (
          <a href={`/admin/commandes/${order.id}/etiquette`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 font-semibold text-white">
            <Tag className="h-5 w-5" /> Étiquette d’envoi
          </a>
        )}
      </section>

      {actions.length > 0 && (
        <section className="px-4 py-4">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Historique</p>
          <ul className="space-y-1">
            {actions.map((a, i) => (
              <li key={i} className="flex justify-between text-sm text-slate-600">
                <span>{ACTION_LABEL[a.action] || a.action}</span>
                <span className="text-slate-400">{new Date(a.created_at).toLocaleString('fr-FR')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ActionBtn({ icon, label, color, busy, onClick }: {
  icon: React.ReactNode; label: string; color: string; busy: boolean; onClick: () => void;
}) {
  const cls: Record<string, string> = {
    amber: 'bg-amber-500', emerald: 'bg-emerald-500', blue: 'bg-blue-500', indigo: 'bg-indigo-500', purple: 'bg-purple-500',
  };
  return (
    <button onClick={onClick} disabled={busy}
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold text-white disabled:opacity-60 ${cls[color]}`}>
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : icon} {label}
    </button>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build OK, route `/agent` listée.

- [ ] **Step 4: Commit**

```bash
git add src/components/agent/AgentOrders.tsx src/components/agent/AgentOrderDetail.tsx
git commit -m "feat(agents): UI liste (onglets) + détail commande avec actions logistiques"
```

---

## Task 8: Admin — onglet « Agents Gabon » (CRUD whitelist)

**Files:**
- Create: `src/app/api/admin/agents/route.ts`
- Create: `src/app/api/admin/agents/[id]/route.ts`
- Create: `src/app/admin/agents/page.tsx`
- Modify: nav admin existante (ajouter un lien vers `/admin/agents`)

**Interfaces:**
- Consumes : `isAdmin` (`src/lib/collab.ts`), `normalizePhone` (`src/lib/agent.ts`).
- Produces :
  - `GET /api/admin/agents` → `{ agents: [{id,name,phone,active,created_at}] }`.
  - `POST /api/admin/agents` `{ name, phone }` → `{ agent }` (409 si numéro déjà présent).
  - `PATCH /api/admin/agents/[id]` `{ active }` → `{ success: true }`.

- [ ] **Step 1: `api/admin/agents/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { normalizePhone } from '@/lib/agent';

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { data } = await supabaseAdmin.from('agents')
    .select('id, name, phone, active, created_at').order('created_at', { ascending: false });
  return NextResponse.json({ agents: data || [] });
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { name?: string; phone?: string };
  const name = (body.name || '').trim();
  const phone = normalizePhone(body.phone);
  if (!name || phone.length < 6) return NextResponse.json({ error: 'Nom et numéro requis' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('agents').insert({ name, phone }).select().single();
  if (error) return NextResponse.json({ error: 'Numéro déjà enregistré ?' }, { status: 409 });
  return NextResponse.json({ agent: data });
}
```

- [ ] **Step 2: `api/admin/agents/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { active?: boolean };
  await supabaseAdmin.from('agents').update({ active: !!body.active }).eq('id', id);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: `src/app/admin/agents/page.tsx`**

```tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, UserCheck, UserX } from 'lucide-react';

type Agent = { id: string; name: string; phone: string; active: boolean; created_at: string };

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/admin/agents'); const j = await r.json(); setAgents(j.agents || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/admin/agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Erreur'); return; }
      setName(''); setPhone(''); await load();
    } finally { setBusy(false); }
  };

  const toggle = async (a: Agent) => {
    await fetch(`/api/admin/agents/${a.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !a.active }),
    });
    await load();
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 font-display text-2xl font-bold text-slate-900">Agents Gabon</h1>
      <p className="mb-6 text-sm text-slate-500">Lien de connexion agents : <code>/agent</code></p>

      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Numéro WhatsApp"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2" />
        <button onClick={add} disabled={busy}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>

      {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" /> : (
        <ul className="space-y-2">
          {agents.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <p className="font-semibold text-slate-900">{a.name}</p>
                <p className="text-sm text-slate-500">{a.phone}</p>
              </div>
              <button onClick={() => toggle(a)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${a.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {a.active ? <><UserCheck className="h-4 w-4" /> Actif</> : <><UserX className="h-4 w-4" /> Inactif</>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Ajouter le lien dans la nav admin**

Repérer la navigation admin (chercher les liens existants vers `/admin/commandes`) :
`grep -rn "admin/commandes" src/app/admin src/components | grep -i "href\|Link"`.
Ajouter, à côté, un lien `href="/admin/agents"` intitulé « Agents Gabon » en suivant le même composant/markup que les autres entrées de nav.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: OK, routes `/admin/agents` et `/api/admin/agents` listées.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/agents src/app/admin/agents
git commit -m "feat(agents): admin onglet Agents Gabon (whitelist CRUD) + lien nav"
```

---

## Task 9: Étape `at_agency` dans `/admin/commandes`

**Files:**
- Modify: `src/app/admin/commandes/page.tsx`

**Interfaces:**
- Consumes : structures existantes `ORDER_STATUS_OPTIONS`, `ORDER_STATUS_CLS`, `canLabel`.

- [ ] **Step 1: Ajouter l'étape au pipeline admin**

Dans `src/app/admin/commandes/page.tsx` :

`ORDER_STATUS_OPTIONS` — insérer entre `shipped` et `delivered` :
```ts
  { value: 'at_agency', label: 'Reçu à l’agence' },
```
`ORDER_STATUS_CLS` — ajouter :
```ts
  at_agency: 'border-teal-300 text-teal-700 bg-teal-50',
```
`canLabel` — inclure `at_agency` (l'étiquette reste dispo) :
```ts
const canLabel = (s: string) => s === 'paid' || s === 'shipped' || s === 'at_agency' || s === 'delivered';
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/commandes/page.tsx
git commit -m "feat(orders): étape 'reçu à l'agence' (at_agency) dans le pipeline admin"
```

---

## Task 10: Vérification end-to-end en prod + push

**Files:** aucun (validation).

- [ ] **Step 1: Push + attendre déploiement Railway**

```bash
git push origin main
```
Attendre le statut SUCCESS (poll `railway deployment list --service twinsk --json`).

> Prérequis : appliquer `supabase-migration-44.sql` au SQL Editor, puis ajouter un agent test via `/admin/agents` (ou directement en base) avec un vrai numéro WhatsApp.

- [ ] **Step 2: Test OTP réel**

- Ouvrir `/agent`, saisir le numéro de l'agent test → vérifier la réception du code sur WhatsApp.
- Saisir le code → connexion → la liste des commandes s'affiche.
- Vérifier qu'un numéro NON whitelisté ne reçoit aucun code (réponse générique).

- [ ] **Step 3: Test pipeline sur une commande test**

Créer une commande test (comme dans le bugfix précédent), puis via `/agent` :
encaisser → expédier → réceptionner → remettre. Vérifier à chaque étape : `order_status` mis à jour, `agent_actions` journalisé, notifications WhatsApp reçues côté client. Supprimer la commande test.

- [ ] **Step 4: Commit final (si ajustements)** et clôture.

---

## Self-Review (rempli par l'auteur du plan)

**Couverture spec :**
- Login OTP whitelisté → Tasks 2, 3, 6. Anti-énumération + rate-limit → Task 3 (+ tests Task 2).
- Voir toutes les commandes → Task 4 (liste + filtres), Task 7 (UI).
- Encaisser cash + tous paiements → Task 5 (`collect-cash`, `validate-payment`).
- Pipeline expédié/reçu/remis + `at_agency` → Task 5 + Task 9. Notifications client → Task 5.
- Audit encaissement (qui/quand) + `agent_actions` → Tasks 1, 4, 5.
- Admin whitelist → Task 8. Interface mobile-first → Tasks 6-7. Sécurité (cookie relu, révocation) → Task 2 (`getAgent`).

**Placeholders :** aucun — tout le code est fourni. Le seul « à repérer » est le point d'ancrage de la nav admin (Task 8, Step 4), guidé par un `grep` précis car le markup de nav dépend de l'existant.

**Cohérence des types :** `AgentOrderStatus`, `canAdvanceTo`, `getAgent`, `AGENT_COOKIE`, `logAgentAction`, `notifyClient`, `orderNumber`, `toWhatsappChatId` — mêmes signatures entre définition (Tasks 2, 4) et usages (Tasks 3, 5). Champ API `order_number` (et non `orderNumber`) côté client, cohérent liste/détail.
