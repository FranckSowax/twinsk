// Vidéo de couverture de l'espace projet : contrôle du fichier, partagé entre
// le navigateur (avant l'envoi) et la route serveur. Module neutre.

/** MP4 (H.264, lisible partout) ou WebM, 50 Mo au plus (limite du stockage). */
export const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
export const VIDEO_MAX = 50 * 1024 * 1024;

/** Message d'erreur en français, ou null si la vidéo est acceptable. */
export function checkCoverVideo(file: { type: string; size: number; name: string }): string | null {
  const mime = file.type || (/\.mp4$/i.test(file.name) ? 'video/mp4' : /\.webm$/i.test(file.name) ? 'video/webm' : '');
  if (!VIDEO_TYPES.has(mime)) return `Format refusé (${file.type || 'inconnu'}) : vidéo MP4 ou WebM (depuis un iPhone, exporter en MP4 « Plus compatible »)`;
  if (file.size > VIDEO_MAX) return `Vidéo trop lourde (${Math.round(file.size / 1048576)} Mo) : 50 Mo au plus — la compresser (720p suffit pour une couverture)`;
  return null;
}
