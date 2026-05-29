// Shared logistics helpers — JSON import v2 + display formatting.
// Used by /api/requests/[uuid]/bulk-load and /api/offers/[uuid]/bulk-load
// plus the manual product POST handlers.

export interface DimensionsCm {
  length?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface LogisticsFields {
  weight: number | null;        // kg, unit weight
  volume: number | null;        // m^3 (CBM)
  dimensions: string | null;    // free text fallback
  dimensions_cm: DimensionsCm | null;
  has_battery: boolean;
  info_manquante: string | null;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}
function strOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** Compute volume in m^3 from dimensions in cm: (L × W × H) / 1_000_000. */
export function computeCbmFromDims(dims: DimensionsCm | null): number | null {
  if (!dims) return null;
  const L = numOrNull(dims.length);
  const W = numOrNull(dims.width);
  const H = numOrNull(dims.height);
  if (L == null || W == null || H == null) return null;
  if (L <= 0 || W <= 0 || H <= 0) return null;
  return (L * W * H) / 1_000_000;
}

/** Format a DimensionsCm object as a human-readable string ("30x20x15 cm"). */
export function formatDimensionsCm(dims: DimensionsCm | null): string | null {
  if (!dims) return null;
  const L = numOrNull(dims.length);
  const W = numOrNull(dims.width);
  const H = numOrNull(dims.height);
  if (L == null && W == null && H == null) return null;
  return `${L ?? '?'}×${W ?? '?'}×${H ?? '?'} cm`;
}

/**
 * Normalize one product's logistics fields from the v2 JSON import schema.
 * Backward compatible: v1 fields (weight, volume, dimensions) still work.
 * v2 fields (weight_kg, cbm, dimensions_cm, has_battery, info_manquante) take
 * precedence when present.
 */
export function normalizeLogistics(p: {
  weight?: unknown;
  weight_kg?: unknown;
  volume?: unknown;
  cbm?: unknown;
  dimensions?: unknown;
  dimensions_cm?: unknown;
  has_battery?: unknown;
  info_manquante?: unknown;
}): LogisticsFields {
  // Weight: v2 weight_kg takes precedence
  const weight = numOrNull(p.weight_kg ?? p.weight);

  // Dimensions object
  let dimensionsCm: DimensionsCm | null = null;
  if (
    p.dimensions_cm &&
    typeof p.dimensions_cm === 'object' &&
    !Array.isArray(p.dimensions_cm)
  ) {
    const raw = p.dimensions_cm as Record<string, unknown>;
    dimensionsCm = {
      length: numOrNull(raw.length),
      width: numOrNull(raw.width),
      height: numOrNull(raw.height),
    };
    // Drop the object entirely if all 3 values are null
    if (
      dimensionsCm.length == null &&
      dimensionsCm.width == null &&
      dimensionsCm.height == null
    ) {
      dimensionsCm = null;
    }
  }

  // Volume: cbm takes precedence; fallback to v1 volume; compute from dims if both missing
  let volume = numOrNull(p.cbm ?? p.volume);
  if (volume == null && dimensionsCm) {
    volume = computeCbmFromDims(dimensionsCm);
  }

  // Dimensions string: take v1 string if present, else derive from v2 object
  let dimensions = strOrNull(p.dimensions);
  if (!dimensions && dimensionsCm) {
    dimensions = formatDimensionsCm(dimensionsCm);
  }

  return {
    weight,
    volume,
    dimensions,
    dimensions_cm: dimensionsCm,
    has_battery: !!p.has_battery,
    info_manquante: strOrNull(p.info_manquante),
  };
}
