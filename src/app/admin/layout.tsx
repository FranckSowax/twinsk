'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Factory,
  Package,
  Plus,
  LogOut,
  BookOpen,
  Inbox,
  Ship,
  LayoutDashboard,
  Menu,
  X,
  ChevronDown,
  ArrowUpRight,
  Loader2,
  Youtube,
  Sparkles,
  MessageCircle,
  Languages,
  Users,
  ClipboardCheck,
  Briefcase,
  ShoppingBag,
  Smartphone,
} from 'lucide-react';
import AdminLogin from '@/components/admin/AdminLogin';
import { AdminLocaleProvider, useAdminT } from '@/components/admin/LocaleProvider';
import type { TKey } from '@/lib/i18n/admin';
import {
  COLLAB_ROLE_HOME,
  COLLAB_ROLE_NAV,
  collabCanAccessPath,
  type CollabRole,
} from '@/lib/collab-roles';

const NAV_ITEMS: { href: string; key: TKey; icon: typeof Package }[] = [
  { href: '/admin', key: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/admin/requests', key: 'nav.sourcing', icon: Package },
  { href: '/admin/offer', key: 'nav.offers', icon: Sparkles },
  { href: '/admin/offer-b2b', key: 'nav.offersB2B', icon: Briefcase },
  { href: '/admin/revisions', key: 'nav.revisions', icon: ClipboardCheck },
  { href: '/admin/commandes', key: 'nav.orders', icon: ShoppingBag },
  { href: '/admin/whatsapp', key: 'nav.whatsapp', icon: MessageCircle },
  { href: '/admin/freight', key: 'nav.freight', icon: Ship },
  { href: '/admin/leads', key: 'nav.services', icon: Inbox },
  { href: '/admin/youtube', key: 'nav.youtube', icon: Youtube },
  { href: '/admin/catalog', key: 'nav.catalog', icon: BookOpen },
  { href: '/admin/sourcing', key: 'nav.supplierSourcing', icon: Factory },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminLocaleProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminLocaleProvider>
  );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useAdminT();
  const [role, setRole] = useState<'admin' | 'collab' | null>(null);
  const [collabRole, setCollabRole] = useState<CollabRole>('production');
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [creating, setCreating] = useState<'request' | 'freight' | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const loadRole = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        setRole(null);
        return;
      }
      const d = (await res.json()) as {
        role: 'admin' | 'collab' | null;
        collabRole?: CollabRole;
        defaultLocale?: 'fr' | 'zh';
      };
      setRole(d.role);
      setCollabRole(d.collabRole || 'production');
      // Collaborateur : langue par défaut définie sur son compte (fr sauf choix
      // contraire à la création), sauf préférence déjà enregistrée sur l'appareil.
      if (d.role === 'collab') {
        const loc = d.defaultLocale === 'zh' ? 'zh' : 'fr';
        try {
          if (!localStorage.getItem('twinsk_admin_locale')) setLocale(loc);
        } catch {
          setLocale(loc);
        }
      }
    } finally {
      setChecking(false);
    }
  }, [setLocale]);

  useEffect(() => {
    loadRole();
  }, [loadRole]);

  // Collaborateur : accès limité aux pages de son rôle → redirection sinon.
  useEffect(() => {
    if (role === 'collab' && pathname && !collabCanAccessPath(collabRole, pathname)) {
      router.replace(COLLAB_ROLE_HOME[collabRole]);
    }
  }, [role, collabRole, pathname, router]);

  // Close menus on route change
  useEffect(() => {
    setSidebarOpen(false);
    setCreateMenuOpen(false);
  }, [pathname]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (!role) {
    return <AdminLogin onLogin={loadRole} />;
  }

  const createSourcing = async () => {
    setCreating('request');
    setCreateMenuOpen(false);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: '' }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        alert(data.error || 'Erreur lors de la création');
        return;
      }
      const link = `${window.location.origin}/request/${data.id}`;
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        // Clipboard might fail
      }
      window.location.href = `/admin/requests/${data.id}`;
    } catch {
      alert('Erreur réseau');
    } finally {
      setCreating(null);
    }
  };

  const createFreight = async () => {
    setCreating('freight');
    setCreateMenuOpen(false);
    try {
      const res = await fetch('/api/freight-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        alert(data.error || 'Erreur lors de la création');
        return;
      }
      const link = `${window.location.origin}/freight/${data.id}`;
      try {
        await navigator.clipboard.writeText(link);
        alert(`Demande de fret créée. Lien copié :\n${link}`);
      } catch {
        prompt('Copiez ce lien et envoyez-le au client :', link);
      }
      window.location.href = '/admin/freight';
    } catch {
      alert('Erreur réseau');
    } finally {
      setCreating(null);
    }
  };

  const handleLogout = async () => {
    if (role === 'collab') {
      await fetch('/api/collab/logout', { method: 'POST' }).catch(() => {});
    } else {
      document.cookie = 'admin_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
    setRole(null);
  };

  // Menu selon le rôle du collaborateur (production / commandes / sourcing).
  const collabHrefs = new Set(COLLAB_ROLE_NAV[collabRole]);
  const navItems =
    role === 'collab'
      ? NAV_ITEMS.filter((i) => collabHrefs.has(i.href))
      : [
          ...NAV_ITEMS,
          { href: '/admin/collaborateurs', key: 'nav.collaborators' as TKey, icon: Users },
          { href: '/admin/agents', key: 'nav.agents' as TKey, icon: Smartphone },
        ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 py-3 dark:border-slate-700 dark:bg-slate-900/90">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
            <span className="text-sm font-bold text-white">T</span>
          </div>
          <span className="font-display text-base font-bold text-slate-900 dark:text-white">
            {t('brand')}
          </span>
        </Link>
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Ouvrir le menu"
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 transition-transform dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between mb-7">
            <Link href="/admin" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
                <span className="text-sm font-bold text-white">T</span>
              </div>
              <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {t('brand')}
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Fermer le menu"
              className="lg:hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Create dropdown (admin uniquement) */}
          {role === 'admin' && (
          <div className="relative mb-5">
            <button
              type="button"
              onClick={() => setCreateMenuOpen((o) => !o)}
              disabled={!!creating}
              className="flex w-full items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:shadow-md disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t('layout.creating')}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t('layout.newRequest')}
                  </>
                )}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${createMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {createMenuOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 z-10 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={createSourcing}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Package className="h-4 w-4 text-amber-500" />
                  <div className="flex-1">
                    <div className="font-medium">{t('layout.sourcing')}</div>
                    <div className="text-[11px] text-slate-500">{t('layout.sourcingSub')}</div>
                  </div>
                  <ArrowUpRight className="h-3 w-3 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={createFreight}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 border-t border-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 dark:border-slate-700"
                >
                  <Ship className="h-4 w-4 text-amber-500" />
                  <div className="flex-1">
                    <div className="font-medium">{t('layout.freight')}</div>
                    <div className="text-[11px] text-slate-500">{t('layout.freightSub')}</div>
                  </div>
                  <ArrowUpRight className="h-3 w-3 text-slate-400" />
                </button>
              </div>
            )}
          </div>
          )}

          {/* Navigation — scrollable pour que tous les éléments restent atteignables */}
          <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : item.href === '/admin/offer'
                    ? // ne pas s'allumer sur /admin/offer-b2b (préfixe commun)
                      pathname === '/admin/offer' || pathname?.startsWith('/admin/offer/')
                    : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? 'bg-amber-50 text-amber-700 font-semibold dark:bg-amber-900/20 dark:text-amber-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>

          {/* Bascule de langue FR / 中文 */}
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/50">
            <Languages className="ml-1.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
            <div className="flex flex-1 gap-1">
              <button
                type="button"
                onClick={() => setLocale('fr')}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                  locale === 'fr'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLocale('zh')}
                className={`flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                  locale === 'zh'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                中文
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            {t('layout.logout')}
          </button>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
