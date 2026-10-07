// Rôles collaborateurs — module partagé client/serveur (aucun import serveur ici).
// production = comportement historique (sourcing + offres + révisions)
// commandes  = commandes reçues de l'app + révisions
// sourcing   = sourcing + offres B2C et B2B
// whatsapp   = messagerie clients (/admin/inbox) : répondre, s'attribuer, paniers

export type CollabRole = 'production' | 'commandes' | 'sourcing' | 'whatsapp';
export type CollabLocale = 'fr' | 'zh';

export const COLLAB_ROLES: CollabRole[] = ['production', 'commandes', 'sourcing', 'whatsapp'];
export const COLLAB_LOCALES: CollabLocale[] = ['fr', 'zh'];

export const COLLAB_ROLE_LABEL: Record<CollabRole, string> = {
  production: 'Production (sourcing + offres)',
  commandes: 'Commandes (app)',
  sourcing: 'Sourcing (B2C + B2B)',
  whatsapp: 'WhatsApp (messagerie clients)',
};

/** Préfixes de pages /admin accessibles par rôle (vérifiés via startsWith). */
export const COLLAB_ROLE_PREFIXES: Record<CollabRole, string[]> = {
  // '/admin/offer' couvre aussi '/admin/offer-b2b' (préfixe commun).
  production: ['/admin/offer', '/admin/requests', '/admin/revisions', '/admin/archives', '/admin/projets', '/admin/achats', '/admin/recherches'],
  commandes: ['/admin/commandes', '/admin/revisions', '/admin/inbox', '/admin/recherches'],
  sourcing: ['/admin/offer', '/admin/requests', '/admin/archives', '/admin/projets', '/admin/achats', '/admin/recherches'],
  whatsapp: ['/admin/inbox', '/admin/recherches'],
};

/** Page d'accueil après connexion, par rôle. */
export const COLLAB_ROLE_HOME: Record<CollabRole, string> = {
  production: '/admin/offer',
  commandes: '/admin/commandes',
  sourcing: '/admin/offer-b2b',
  whatsapp: '/admin/inbox',
};

/** Entrées du menu latéral visibles par rôle. */
export const COLLAB_ROLE_NAV: Record<CollabRole, string[]> = {
  production: ['/admin/requests', '/admin/recherches', '/admin/offer', '/admin/offer-b2b', '/admin/archives', '/admin/revisions', '/admin/projets', '/admin/achats'],
  commandes: ['/admin/commandes', '/admin/inbox', '/admin/recherches', '/admin/revisions'],
  sourcing: ['/admin/requests', '/admin/recherches', '/admin/offer', '/admin/offer-b2b', '/admin/archives', '/admin/projets', '/admin/achats'],
  whatsapp: ['/admin/inbox', '/admin/recherches'],
};

export function collabCanAccessPath(role: CollabRole, pathname: string): boolean {
  return (COLLAB_ROLE_PREFIXES[role] || []).some((p) => pathname.startsWith(p));
}

/** Onglet « Recherches WhatsApp » : ceux qui les créent (messagerie) et ceux qui les traitent (sourcing). */
export const WA_SEARCH_ROLES: CollabRole[] = ['whatsapp', 'commandes', 'sourcing', 'production'];
/**
 * Vérifier une offre de recherche et l'envoyer au client : une personne, jamais
 * l'agent Hermes (compte collaborateur « sourcing »).
 */
export const WA_SEARCH_SEND_ROLES: CollabRole[] = ['whatsapp', 'commandes', 'production'];

/** Rôles qui répondent aux clients dans la messagerie et créent des paniers. */
export const INBOX_ROLES: CollabRole[] = ['whatsapp', 'commandes'];
