// Configuration des 6 actes du parcours d'un colis TWINSK : Chine -> Afrique.
// Le voyage va du froid (usine industrielle) au chaud (livraison à Libreville).
// `framesReady` passe à true scène par scène quand les frames Higgsfield sont branchées.

export interface Scene {
  id: string;
  /** Index affiché (01..06) */
  index: string;
  /** Titre court de l'acte */
  kicker: string;
  /** Phrase principale */
  title: string;
  /** Sous-texte */
  body: string;
  /** Frames réelles disponibles ? Sinon placeholder animé. */
  framesReady: boolean;
  /** Nombre de frames extraites (rempli après ffmpeg) */
  frameCount: number;
  /** Préfixe des fichiers: /parcours/frames/{id}_0001.webp */
  framePrefix: string;
  /** Dégradé du placeholder + ambiance de la scène [haut, bas] */
  gradient: [string, string];
  /** Couleur de teinte (color tint) appliquée en overlay sur cette scène */
  tint: string;
  /** Couleur d'accent du colis / UI de la scène */
  accent: string;
}

export const SCENES: Scene[] = [
  {
    id: 'usine',
    index: '01',
    kicker: "L'usine",
    title: 'Tout commence en Chine.',
    body: 'Votre commande quitte la chaîne de production, scellée, étiquetée et tracée.',
    framesReady: true,
    frameCount: 91,
    framePrefix: 'usine',
    gradient: ['#0b1220', '#1c2b3a'],
    tint: '#0a3a6b',
    accent: '#d9a441',
  },
  {
    id: 'camion',
    index: '02',
    kicker: 'En route',
    title: 'Direction la zone de chargement.',
    body: 'Chaque colis est consolidé puis sécurisé, prêt pour le grand voyage.',
    framesReady: true,
    frameCount: 91,
    framePrefix: 'camion',
    gradient: ['#10161d', '#27313b'],
    tint: '#33506b',
    accent: '#e0aa48',
  },
  {
    id: 'cargo',
    index: '03',
    kicker: 'Embarquement',
    title: 'Container ou cargo aérien.',
    body: 'Les portes se referment. Cap sur l’Afrique.',
    framesReady: true,
    frameCount: 91,
    framePrefix: 'cargo',
    gradient: ['#07101f', '#142844'],
    tint: '#0c2b5a',
    accent: '#e6b455',
  },
  {
    id: 'tarmac',
    index: '04',
    kicker: 'Arrivée',
    title: 'Sur le tarmac, à Libreville.',
    body: 'Lumière équatoriale : votre colis a traversé le monde.',
    framesReady: true,
    frameCount: 91,
    framePrefix: 'tarmac',
    gradient: ['#2a1c10', '#5a3415'],
    tint: '#c2651a',
    accent: '#ffd27a',
  },
  {
    id: 'agence',
    index: '05',
    kicker: 'En agence',
    title: 'Réceptionné, scanné, prêt.',
    body: 'Notre équipe TWINSK prend le relais à Libreville.',
    framesReady: true,
    frameCount: 91,
    framePrefix: 'agence',
    gradient: ['#2e1f0c', '#5c3e16'],
    tint: '#c97c1f',
    accent: '#ffd98a',
  },
  {
    id: 'mains',
    index: '06',
    kicker: 'Livré',
    title: 'Entre vos mains.',
    body: 'De l’usine chinoise jusqu’à vous. C’est ça, TWINSK.',
    framesReady: true,
    frameCount: 91,
    framePrefix: 'mains',
    gradient: ['#3a2410', '#7a4a1c'],
    tint: '#e08a2a',
    accent: '#ffe1a3',
  },
];
