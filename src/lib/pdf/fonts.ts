import path from 'path';
import { Font } from '@react-pdf/renderer';

/**
 * Helvetica (police par defaut de react-pdf) ne contient aucun glyphe CJK :
 * l adresse chinoise sortait en mojibake dans les PDF (« •Þ}': •ÎïÅW7÷¤'¦506 »).
 * On embarque un sous-ensemble de Noto Sans SC limite aux caracteres de
 * l adresse Twinsk (~29 Ko par graisse) — voir public/fonts/.
 */
export const CJK_FAMILY = 'NotoSansSC';

let registered: boolean | null = null;

/**
 * Enregistre la police CJK une seule fois par process.
 * Retourne le nom de famille a utiliser, ou undefined si le fichier est
 * introuvable (le PDF reste generable, sans le rendu chinois).
 */
export function ensureCjkFont(): string | undefined {
  if (registered === null) {
    try {
      const dir = path.join(process.cwd(), 'public', 'fonts');
      Font.register({
        family: CJK_FAMILY,
        fonts: [
          { src: path.join(dir, 'NotoSansSC-subset.ttf'), fontWeight: 400 },
          { src: path.join(dir, 'NotoSansSC-subset-bold.ttf'), fontWeight: 700 },
        ],
      });
      registered = true;
    } catch (e) {
      console.warn('Police CJK non enregistree, fallback Helvetica:', e);
      registered = false;
    }
  }
  return registered ? CJK_FAMILY : undefined;
}
