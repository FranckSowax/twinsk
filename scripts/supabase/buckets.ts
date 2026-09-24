// Buckets de stockage relevés sur le projet Gabon (phase 0, revérifiés le
// 24 septembre 2026). Source unique pour recreate-buckets.ts et config.toml.
export interface BucketSpec {
  id: string;
  public: boolean;
  /** Octets. */
  fileSizeLimit: number | null;
  allowedMimeTypes: string[] | null;
}

export const BUCKETS: BucketSpec[] = [
  {
    id: 'request-images',
    public: true,
    fileSizeLimit: 52_428_800, // 50 Mio
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'],
  },
];

/** Différences entre un bucket existant et la spécification (vide = conforme). */
export function bucketDiff(
  spec: BucketSpec,
  current: { public: boolean; file_size_limit?: number | null; allowed_mime_types?: string[] | null },
): string[] {
  const diffs: string[] = [];
  if (current.public !== spec.public) diffs.push(`public ${current.public} → ${spec.public}`);
  if ((current.file_size_limit ?? null) !== spec.fileSizeLimit) diffs.push(`taille max ${current.file_size_limit ?? '∅'} → ${spec.fileSizeLimit ?? '∅'}`);
  const a = [...(current.allowed_mime_types || [])].sort().join(',');
  const b = [...(spec.allowedMimeTypes || [])].sort().join(',');
  if (a !== b) diffs.push(`types ${a || '∅'} → ${b || '∅'}`);
  return diffs;
}
