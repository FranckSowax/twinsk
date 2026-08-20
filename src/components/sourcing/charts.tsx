'use client';

import { useState, type ReactNode } from 'react';
import type { ComputedRow } from '@/lib/sourcing/compute';
import { eur } from './ui';

/**
 * Palette validée pour l'accessibilité — bande de clarté, plancher de chroma,
 * séparation en vision daltonienne, contraste sur le fond. Ne pas remplacer par
 * des couleurs de marque sans revalider.
 */
const C = {
  surface: '#fcfcfb',
  ink: '#0b0b0b',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  inkSoft: '#52514e',
  muted: '#898781',
  s1: '#2a78d6', // marchandise
  s2: '#eb6834', // outillage amorti
  s3: '#1baf7a', // fret, assurance, droits, TVA
} as const;

/**
 * Un état vide n'est pas un graphique vide : il dit quoi saisir pour que le
 * graphique apparaisse.
 */
function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded border border-dashed border-line px-4 py-10 text-center text-sm text-ink-soft">
      {children}
    </p>
  );
}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="break-inside-avoid rounded border border-line bg-white p-3">
      <figcaption className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {title}
      </figcaption>
      {children}
    </figure>
  );
}

/** Infobulle au survol, positionnée au curseur. */
function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; html: ReactNode } | null>(null);
  const bind = (html: ReactNode) => ({
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, html }),
    onMouseLeave: () => setTip(null),
  });
  const node = tip ? (
    <div
      className="pointer-events-none fixed z-50 rounded border border-line bg-white px-2 py-1.5 text-xs leading-snug text-ink shadow-lg print:hidden"
      style={{ left: tip.x + 12, top: tip.y + 12 }}
    >
      {tip.html}
    </div>
  ) : null;
  return { bind, node };
}

/* ═══ 1. Coût débarqué par set — barres empilées ═══ */

export function CostChart({ rows }: { rows: ComputedRow[] }) {
  const { bind, node } = useTip();
  const data = rows.filter((r) => r.landed != null);

  if (!data.length) {
    return (
      <Frame title="Coût débarqué par set">
        <Empty>
          Aucun coût calculable : saisissez un prix set et un colisage (sets par carton, volume)
          pour au moins un fournisseur.
        </Empty>
      </Frame>
    );
  }

  const W = 900;
  const LM = 190;
  const RM = 70;
  const rowH = 26;
  const H = data.length * rowH + 34;
  const max = Math.max(...data.map((r) => r.landed!.costPerSet)) * 1.02;
  const x = (v: number) => LM + ((W - LM - RM) * v) / max;

  return (
    <Frame title="Coût débarqué par set">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          className="w-full min-w-[40rem]"
          style={{ background: C.surface }}
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const v = (max * i) / 4;
            return (
              <g key={i}>
                <line x1={x(v)} y1={10} x2={x(v)} y2={H - 24} stroke={C.grid} strokeWidth={1} />
                <text x={x(v)} y={H - 10} fontSize={10.5} fill={C.muted} textAnchor="middle">
                  {eur(v)}
                </text>
              </g>
            );
          })}

          {data.map((r, i) => {
            const y = 14 + i * rowH;
            const l = r.landed!;
            const segments: Array<[string, number, string]> = [
              ['Marchandise', l.pricePerSetEur, C.s1],
              ['Outillage amorti', l.amortPerSet, C.s2],
              ['Fret, assurance, droits, TVA', l.logisticsPerSet, C.s3],
            ];
            let acc = 0;
            return (
              <g key={r.supplier.id}>
                <text x={LM - 9} y={y + 10} fontSize={11} fill={C.ink} textAnchor="end">
                  {r.supplier.name.slice(0, 26)}
                </text>
                {segments.map(([label, v, color]) => {
                  if (!v) return null;
                  const x0 = x(acc);
                  const x1 = x(acc + v);
                  acc += v;
                  return (
                    <rect
                      key={label}
                      x={x0}
                      y={y}
                      // 2 px de séparation entre segments, sans jamais disparaître.
                      width={Math.max(1, x1 - x0 - 2)}
                      height={13}
                      rx={2}
                      fill={color}
                      {...bind(
                        <>
                          <b>{r.supplier.name}</b>
                          <br />
                          {label} : <b>{eur(v)}/set</b>
                          <br />
                          Total débarqué : {eur(l.costPerSet)}/set
                        </>,
                      )}
                    />
                  );
                })}
                <text
                  x={x(l.costPerSet) + 7}
                  y={y + 10}
                  fontSize={11}
                  fontWeight={700}
                  fill={C.ink}
                >
                  {eur(l.costPerSet)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        {(
          [
            ['Marchandise', C.s1],
            ['Outillage amorti', C.s2],
            ['Fret, assurance, droits, TVA', C.s3],
          ] as const
        ).map(([label, color]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: color }} />
            {label}
          </li>
        ))}
      </ul>
      {node}
    </Frame>
  );
}

/* ═══ 2. Score pondéré — barres, série unique ═══ */

export function ScoreChart({ rows }: { rows: ComputedRow[] }) {
  const { bind, node } = useTip();
  const data = rows.filter((r) => r.score != null);

  if (!data.length) {
    return (
      <Frame title="Score pondéré sur 100">
        <Empty>
          Aucun score calculable : renseignez au moins un critère (faisabilité, conformité, prix…)
          pour un fournisseur actif.
        </Empty>
      </Frame>
    );
  }

  const W = 900;
  const LM = 190;
  const RM = 60;
  const rowH = 24;
  const H = data.length * rowH + 30;
  const x = (v: number) => LM + ((W - LM - RM) * v) / 100;

  return (
    <Frame title="Score pondéré sur 100">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          className="w-full min-w-[40rem]"
          style={{ background: C.surface }}
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={x(v)} y1={8} x2={x(v)} y2={H - 22} stroke={C.grid} strokeWidth={1} />
              <text x={x(v)} y={H - 8} fontSize={10.5} fill={C.muted} textAnchor="middle">
                {v}
              </text>
            </g>
          ))}
          {data.map((r, i) => {
            const y = 12 + i * rowH;
            return (
              <g key={r.supplier.id}>
                <text x={LM - 9} y={y + 9} fontSize={11} fill={C.ink} textAnchor="end">
                  {r.supplier.name.slice(0, 26)}
                </text>
                <rect
                  x={LM}
                  y={y}
                  width={Math.max(1, x(r.score!) - LM)}
                  height={12}
                  rx={2}
                  fill={C.s1}
                  {...bind(
                    <>
                      <b>{r.supplier.name}</b>
                      <br />
                      Score : <b>{Math.round(r.score!)}/100</b>
                      <br />
                      Critères couverts : {r.covered} points de pondération
                    </>,
                  )}
                />
                <text x={x(r.score!) + 6} y={y + 9} fontSize={11} fontWeight={700} fill={C.ink}>
                  {Math.round(r.score!)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {/* Série unique : pas de légende, le titre la nomme. */}
      {node}
    </Frame>
  );
}

/* ═══ 3. Fiabilité contre coût — nuage de points ═══ */

const TRACK_COLOR: Record<string, string> = { A: C.s1, B: C.s2 };

export function ScatterChart({ rows }: { rows: ComputedRow[] }) {
  const { bind, node } = useTip();
  const pts = rows.filter((r) => r.landed != null && r.score != null);

  if (!pts.length) {
    return (
      <Frame title="Fiabilité contre coût">
        <Empty>
          Le positionnement s’affiche dès qu’un fournisseur a un coût débarqué ET un score
          calculables.
        </Empty>
      </Frame>
    );
  }

  const W = 900;
  const H = 340;
  const L = 58;
  const R = 24;
  const T = 14;
  const B = 42;
  const ys = pts.map((p) => p.landed!.costPerSet);
  const xmin = Math.min(0, Math.min(...pts.map((p) => p.score!)) - 5);
  const xmax = 100;
  const ymin = Math.max(0, Math.min(...ys) * 0.9);
  const ymax = Math.max(...ys) * 1.1 || 1;
  const X = (v: number) => L + ((W - L - R) * (v - xmin)) / (xmax - xmin || 1);
  const Y = (v: number) => T + (H - T - B) * (1 - (v - ymin) / (ymax - ymin || 1));

  return (
    <Frame title="Fiabilité contre coût">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          className="w-full min-w-[40rem]"
          style={{ background: C.surface }}
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const v = ymin + ((ymax - ymin) * i) / 4;
            return (
              <g key={i}>
                <line x1={L} y1={Y(v)} x2={W - R} y2={Y(v)} stroke={C.grid} />
                <text x={L - 8} y={Y(v) + 3.5} fontSize={10.5} fill={C.muted} textAnchor="end">
                  {eur(v)}
                </text>
              </g>
            );
          })}
          {[0, 25, 50, 75, 100].map((v) => (
            <text key={v} x={X(v)} y={H - 22} fontSize={10.5} fill={C.muted} textAnchor="middle">
              {v}
            </text>
          ))}

          <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke={C.axis} />
          <line x1={L} y1={T} x2={L} y2={H - B} stroke={C.axis} />
          <text x={(W + L) / 2} y={H - 6} fontSize={11} fill={C.inkSoft} textAnchor="middle">
            Score sur 100
          </text>
          <text
            x={-(H - B + T) / 2}
            y={13}
            fontSize={11}
            fill={C.inkSoft}
            textAnchor="middle"
            transform="rotate(-90)"
          >
            Coût débarqué €/set
          </text>

          {pts.map((p) => {
            const cx = X(p.score!);
            const cy = Y(p.landed!.costPerSet);
            return (
              <g key={p.supplier.id}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={6}
                  fill={TRACK_COLOR[p.supplier.track ?? 'A'] ?? C.muted}
                  stroke={C.surface}
                  strokeWidth={1.5}
                  {...bind(
                    <>
                      <b>{p.supplier.name}</b>
                      <br />
                      Score : <b>{Math.round(p.score!)}/100</b>
                      <br />
                      Coût débarqué : <b>{eur(p.landed!.costPerSet)}/set</b>
                    </>,
                  )}
                />
                {/* Étiquette directe : on lit le nom sans passer par une légende. */}
                <text x={cx + 9} y={cy + 3.5} fontSize={10.5} fill={C.ink}>
                  {p.supplier.name.slice(0, 18)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: C.s1 }} />
          Voie A — OEM clé en main
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: C.s2 }} />
          Voie B — outillage et injection
        </li>
      </ul>
      {node}
    </Frame>
  );
}
