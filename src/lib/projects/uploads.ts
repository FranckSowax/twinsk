// Fichiers acceptés dans l'espace projet (documents, pièces jointes, réponses
// du client) : contrôle partagé navigateur / serveur, avec message en français.
// Vidéos : 50 Mo (limite du stockage) ; autres fichiers : 25 Mo.

export const UPLOAD_MAX = 25 * 1024 * 1024;
export const VIDEO_UPLOAD_MAX = 50 * 1024 * 1024;
export const UPLOAD_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx', 'application/vnd.ms-excel': 'xls',
  'text/plain': 'txt', 'message/rfc822': 'eml',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
};
const BY_EXT: Record<string, string> = Object.fromEntries(Object.entries(UPLOAD_TYPES).map(([m, e]) => [e, m]));
BY_EXT.jpeg = 'image/jpeg';
BY_EXT.m4v = 'video/mp4';

/** Type MIME retenu : celui du navigateur, sinon déduit de l'extension (certains téléphones n'en donnent pas). */
export function uploadMime(f: { name: string; type: string }): string {
  if (f.type && UPLOAD_TYPES[f.type]) return f.type;
  const ext = (f.name.includes('.') ? f.name.split('.').pop() || '' : '').toLowerCase();
  return BY_EXT[ext] || f.type || 'application/octet-stream';
}
const mo = (n: number) => `${Math.round((n / 1048576) * 10) / 10}`.replace('.', ',');

/** Message d'erreur si le fichier est refusé, sinon null. */
export function checkUpload(f: { name: string; type: string; size: number }): string | null {
  const mime = uploadMime(f);
  if (!UPLOAD_TYPES[mime]) return `« ${f.name} » : format non accepté (PDF, photos, vidéos MP4/MOV, Word, Excel, texte)`;
  const max = mime.startsWith('video/') ? VIDEO_UPLOAD_MAX : UPLOAD_MAX;
  if (f.size > max) return `« ${f.name} » : ${mo(f.size)} Mo, au-delà de ${mo(max)} Mo${mime.startsWith('video/') ? ' (raccourcir ou compresser la vidéo)' : ''}`;
  if (f.size === 0) return `« ${f.name} » : fichier vide`;
  return null;
}
