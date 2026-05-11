/**
 * Extract a YouTube video ID from any common URL form.
 * Supports:
 *   - https://www.youtube.com/watch?v=ABC123
 *   - https://youtu.be/ABC123
 *   - https://www.youtube.com/embed/ABC123
 *   - https://www.youtube.com/shorts/ABC123
 *   - bare 11-char ID
 */
export function extractYoutubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Bare ID (11 chars, alnum + - _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split('/').filter(Boolean);
      const lastPart = parts[parts.length - 1];
      if (lastPart && /^[a-zA-Z0-9_-]{11}$/.test(lastPart)) return lastPart;
    }
  } catch {
    return null;
  }
  return null;
}

/** Embed URL for a given YouTube ID. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube.com/embed/${id}`;
}

/** Default thumbnail URL when admin hasn't uploaded one. */
export function youtubeDefaultThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
