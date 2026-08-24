// Rôles collaborateurs — module partagé client/serveur (aucun import serveur ici).
// production = comportement historique (sourcing + offres + révisions)
// commandes  = commandes reçues de l'app + révisions
// sourcing   = sourcing + offres B2C et B2B

export type CollabRole = 'production' | 'commandes' | 'sourcing';
export type CollabLocale = 'fr' | 'zh';

export const COLLAB_ROLES: CollabRole[] = ['production', 'commandes', 'sourcing'];
export const COLLAB_LOCALES: CollabLocale[] = ['fr', 'zh'];

export const COLLAB_ROLE_LABEL: Record<CollabRole, string> = {
  production: 'Production (sourcing + offres)',
  commandes: 'Commandes (app)',
  sourcing: 'Sourcing (B2C + B2B)',
};

/** Préfixes de pages /admin accessibles par rôle (vérifiés via startsWith). */
export const COLLAB_ROLE_PREFIXES: Record<CollabRole, string[]> = {
  // '/admin/offer' couvre aussi '/admin/offer-b2b' (préfixe commun).
  production: ['/admin/offer', '/admin/requests', '/admin/revisions', '/admin/archives'],
  commandes: ['/admin/commandes', '/admin/revisions'],
  sourcing: ['/admin/offer', '/admin/requests', '/admin/archives'],
};

/** Page d'accueil après connexion, par rôle. */
export const COLLAB_ROLE_HOME: Record<CollabRole, string> = {
  production: '/admin/offer',
  commandes: '/admin/commandes',
  sourcing: '/admin/offer-b2b',
};

/** Entrées du menu latéral visibles par rôle. */
export const COLLAB_ROLE_NAV: Record<CollabRole, string[]> = {
  production: ['/admin/requests', '/admin/offer', '/admin/offer-b2b', '/admin/archives', '/admin/revisions'],
  commandes: ['/admin/commandes', '/admin/revisions'],
  sourcing: ['/admin/requests', '/admin/offer', '/admin/offer-b2b', '/admin/archives'],
};

export function collabCanAccessPath(role: CollabRole, pathname: string): boolean {
  return (COLLAB_ROLE_PREFIXES[role] || []).some((p) => pathname.startsWith(p));
}
