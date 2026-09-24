// Filtrage des modules par pays (option B) : en Côte d'Ivoire, les adresses de
// la partie Twinsk renvoient vers la vitrine /bio (pages publiques) ou vers le
// tableau de bord (admin). Au Gabon, ce proxy laisse tout passer. Il ne tourne
// que sur les adresses listées dans `matcher`.

import { NextResponse, type NextRequest } from 'next/server';
import { routeAccess } from '@/lib/modules';
import { publicOrigin } from '@/lib/public-origin';

export function proxy(request: NextRequest) {
  const access = routeAccess(request.nextUrl.pathname);
  if (access === 'ok') return NextResponse.next();
  // Adresse publique (derrière Railway, request.url pointe vers le conteneur).
  return NextResponse.redirect(new URL(access === 'admin' ? '/admin' : '/bio', publicOrigin(request)));
}

// Doit rester une liste littérale (analyse statique de Next) : miroir de TWINSK_*_PREFIXES + « / ».
export const config = {
  matcher: [
    '/',
    '/parcours/:path*', '/freight/:path*', '/request/:path*', '/proposal/:path*', '/quote/:path*',
    '/order-summary/:path*', '/sourcing/:path*', '/kin-origins/:path*', '/kinova/:path*',
    '/admin/requests/:path*', '/admin/usines/:path*', '/admin/revisions/:path*', '/admin/freight/:path*',
    '/admin/leads/:path*', '/admin/youtube/:path*', '/admin/catalog/:path*', '/admin/sourcing/:path*',
  ],
};
