import React, { useCallback, useEffect, useState } from 'react';
import { Footer } from './components/Footer.tsx';
import { Navbar } from './components/Navbar.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { SiteConfigProvider } from './context/SiteConfigContext.tsx';
import {
  DeviceManagementPage,
  FavoritesPage,
  ProfileSettingsPage,
  UserDashboardPage,
  WatchHistoryPage,
} from './pages/AccountPages.tsx';
import { AdminPanelPage } from './pages/admin/AdminPanelPage.tsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.tsx';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { CmsPage } from './pages/CmsPage.tsx';
import { ContentDetailsPage } from './pages/ContentDetailsPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { LiveTvPage } from './pages/LiveTvPage.tsx';
import { CheckoutPage, PlansPage } from './pages/PlansAndCheckoutPage.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { SportsPage } from './pages/SportsPage.tsx';

function AppShell() {
  const [locationUrl, setLocationUrl] = useState(
    () => `${window.location.pathname}${window.location.search}`
  );

  useEffect(() => {
    const onPopState = () => {
      setLocationUrl(`${window.location.pathname}${window.location.search}`);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    if (path === `${window.location.pathname}${window.location.search}`) return;
    window.history.pushState({}, '', path);
    setLocationUrl(path);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const parsed = new URL(locationUrl, 'http://localhost');
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isHeroLedRoute =
    pathname === '/' ||
    pathname === '/live-tv' ||
    pathname === '/drama' ||
    pathname === '/movies' ||
    pathname === '/series' ||
    pathname === '/sports' ||
    pathname.startsWith('/title/');

  const renderPage = () => {
    if (pathname === '/') return <HomePage navigate={navigate} />;
    if (pathname === '/live-tv') {
      return (
        <LiveTvPage
          initialChannelSlug={parsed.searchParams.get('channel') || undefined}
          navigate={navigate}
        />
      );
    }
    if (pathname === '/movies') return <CatalogPage contentType="movie" navigate={navigate} />;
    if (pathname === '/drama') return <CatalogPage contentType="drama" navigate={navigate} />;
    if (pathname === '/series') return <CatalogPage contentType="series" navigate={navigate} />;
    if (pathname === '/sports') return <SportsPage navigate={navigate} />;

    if (pathname.startsWith('/title/')) {
      const slug = decodeURIComponent(pathname.slice('/title/'.length));
      return <ContentDetailsPage slug={slug} navigate={navigate} />;
    }
    if (pathname.startsWith('/page/')) {
      const slug = decodeURIComponent(pathname.slice('/page/'.length));
      return <CmsPage slug={slug} navigate={navigate} />;
    }
    if (pathname.startsWith('/p/')) {
      const slug = decodeURIComponent(pathname.slice('/p/'.length));
      return <CmsPage slug={slug} navigate={navigate} />;
    }
    if (pathname === '/search') {
      return <SearchPage initialQuery={parsed.searchParams.get('q') || ''} navigate={navigate} />;
    }
    if (pathname === '/login') return <LoginPage navigate={navigate} />;
    if (pathname === '/register') return <RegisterPage navigate={navigate} />;
    if (pathname === '/plans') return <PlansPage navigate={navigate} />;
    if (pathname.startsWith('/checkout/')) {
      const id = Number(pathname.slice('/checkout/'.length));
      return <CheckoutPage packageId={id} navigate={navigate} />;
    }
    if (pathname === '/dashboard') return <UserDashboardPage navigate={navigate} />;
    if (pathname === '/profile') return <ProfileSettingsPage navigate={navigate} />;
    if (pathname === '/history') return <WatchHistoryPage navigate={navigate} />;
    if (pathname === '/favorites') return <FavoritesPage navigate={navigate} />;
    if (pathname === '/devices') return <DeviceManagementPage navigate={navigate} />;

    if (pathname === '/admin') return <AdminPanelPage section="overview" navigate={navigate} />;
    if (pathname.startsWith('/admin/')) {
      const section = pathname.slice('/admin/'.length);
      return <AdminPanelPage section={section} navigate={navigate} />;
    }

    return <HomePage navigate={navigate} />;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0D] text-[#F4F6FA]">
      <Navbar currentPath={pathname} navigate={navigate} />
      <div className={`flex-1 ${!isAdminRoute && !isHeroLedRoute ? 'pt-20' : ''}`}>
        {renderPage()}
      </div>
      {!isAdminRoute && <Footer navigate={navigate} />}
    </div>
  );
}

export default function App() {
  return (
    <SiteConfigProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </SiteConfigProvider>
  );
}
