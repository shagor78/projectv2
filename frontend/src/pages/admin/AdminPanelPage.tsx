import React, { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  Clapperboard,
  Compass,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Film,
  FolderOpen,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  MonitorSmartphone,
  Package,
  Radio,
  Receipt,
  Settings,
  ShieldCheck,
  Trophy,
  Tv,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AdminContentSection } from './AdminContentModules.tsx';
import {
  AdminPackagesSection,
  AdminPaymentsAndTransactionsSection,
  AdminSubscriptionsSection,
  AdminUsersSection,
  AdminWalletsSection,
} from './AdminBillingUsersModules.tsx';
import { AdminExcelImportModule } from './AdminExcelImportModule.tsx';
import {
  AdminChannelCategoriesSection,
  AdminLiveTvSection,
  AdminStreamManagementSection,
} from './AdminLiveTvModules.tsx';
import { AdminLayoutManagement } from './AdminLayoutManagement.tsx';
import { AdminMediaManagement } from './AdminMediaManagement.tsx';
import {
  AdminHeroSliderSection,
  AdminHomepageLayoutSection,
} from './AdminMerchandisingModules.tsx';
import { AdminNavigationManagement } from './AdminNavigationManagement.tsx';
import { AdminAnalyticsSection, AdminOverviewSection } from './AdminOverviewAnalytics.tsx';
import { AdminPageManagement } from './AdminPageManagement.tsx';
import {
  AdminAuditLogsSection,
  AdminDevicesSection,
  AdminNotificationsSection,
  AdminRolesSection,
  AdminSettingsSection,
} from './AdminSystemModules.tsx';

interface AdminPanelPageProps {
  section?: string;
  navigate: (path: string) => void;
}

const ADMIN_GROUPS = [
  {
    group: 'Overview',
    items: [
      { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'analytics', label: 'Reports & Analytics', icon: BarChart3 },
    ],
  },
  {
    group: 'IPTV & Streaming',
    items: [
      { key: 'live-tv', label: 'Live TV Channels', icon: Tv },
      { key: 'channel-categories', label: 'Channel Categories', icon: FolderTree },
      { key: 'streams', label: 'Stream URLs & Health', icon: Activity },
    ],
  },
  {
    group: 'VOD Catalog & Import',
    items: [
      { key: 'movies', label: 'Movies', icon: Film },
      { key: 'drama', label: 'Drama', icon: Clapperboard },
      { key: 'series', label: 'Web Series', icon: Radio },
      { key: 'sports', label: 'Sports', icon: Trophy },
      { key: 'excel-import', label: 'Excel / CSV Import', icon: FileSpreadsheet },
    ],
  },
  {
    group: 'CMS & Merchandising',
    items: [
      { key: 'pages', label: 'Pages & Content', icon: FileText },
      { key: 'navigation', label: 'Navigation Menu', icon: Compass },
      { key: 'media', label: 'Media Library', icon: FolderOpen },
      { key: 'layout-management', label: 'Layout Management', icon: LayoutGrid },
      { key: 'hero-slider', label: 'Hero Slider Manager', icon: ImageIcon },
      { key: 'homepage-layout', label: 'Homepage Builder', icon: LayoutGrid },
    ],
  },
  {
    group: 'Users & Billing',
    items: [
      { key: 'users', label: 'Users & Admins', icon: Users },
      { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
      { key: 'packages', label: 'Packages & Pricing', icon: Package },
      { key: 'wallets', label: 'Wallets', icon: Wallet },
      { key: 'payments', label: 'Payments', icon: DollarSign },
      { key: 'transactions', label: 'Transactions', icon: Receipt },
    ],
  },
  {
    group: 'Operations & Settings',
    items: [
      { key: 'notifications', label: 'Notifications', icon: Bell },
      { key: 'devices', label: 'Devices', icon: MonitorSmartphone },
      { key: 'roles', label: 'Admin Roles', icon: ShieldCheck },
      { key: 'settings', label: 'Website Settings', icon: Settings },
      { key: 'audit-logs', label: 'Audit Logs', icon: FileText },
    ],
  },
];

export function AdminPanelPage({ section = 'overview', navigate }: AdminPanelPageProps) {
  const { user, isAdmin, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return <div className="mx-auto max-w-[1440px] p-8 skeleton-shimmer h-96 rounded-2xl" />;
  }

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-amber-400" />
        <h1 className="mt-4 font-display text-2xl font-bold text-white">Administrator Access Required</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in with an authorized administrator account to manage the platform.
        </p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-5 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-bold text-slate-950"
        >
          Sign In
        </button>
      </div>
    );
  }

  const activeKey = section || 'overview';
  const activeMeta =
    ADMIN_GROUPS.flatMap((g) => g.items).find((i) => i.key === activeKey) ||
    ADMIN_GROUPS[0].items[0];

  const selectSection = (key: string) => {
    setSidebarOpen(false);
    navigate(key === 'overview' ? '/admin' : `/admin/${key}`);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1440px]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#0B0E16] p-4 lg:block">
        <div className="mb-5 flex items-center justify-between px-2">
          <span className="font-display text-sm font-bold text-white">Admin Console</span>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Storefront</span>
          </button>
        </div>

        <nav className="space-y-5">
          {ADMIN_GROUPS.map((grp) => (
            <div key={grp.group}>
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {grp.group}
              </p>
              <div className="mt-1.5 space-y-0.5">
                {grp.items.map((item) => {
                  const active = activeKey === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => selectSection(item.key)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                        active
                          ? 'bg-amber-500/15 text-amber-300 font-semibold'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/75" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 w-64 overflow-y-auto border-r border-white/10 bg-[#0B0E16] p-4">
            <nav className="space-y-4">
              {ADMIN_GROUPS.map((grp) => (
                <div key={grp.group}>
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {grp.group}
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {grp.items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => selectSection(item.key)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs ${
                          activeKey === item.key
                            ? 'bg-amber-500/15 text-amber-300 font-semibold'
                            : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open admin menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <p className="text-xs text-slate-400">Admin Console / {activeMeta.label}</p>
              <h1 className="font-display text-2xl font-bold text-white">{activeMeta.label}</h1>
            </div>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Signed in as <span className="text-white font-medium">{user.email}</span>
          </span>
        </div>

        {activeKey === 'overview' && <AdminOverviewSection onNavigateSection={selectSection} />}
        {activeKey === 'analytics' && <AdminAnalyticsSection />}
        {activeKey === 'live-tv' && <AdminLiveTvSection />}
        {activeKey === 'channel-categories' && <AdminChannelCategoriesSection />}
        {activeKey === 'streams' && <AdminStreamManagementSection />}
        {activeKey === 'movies' && <AdminContentSection contentType="movie" />}
        {activeKey === 'drama' && <AdminContentSection contentType="drama" />}
        {activeKey === 'series' && <AdminContentSection contentType="series" />}
        {activeKey === 'sports' && <AdminContentSection contentType="sports" />}
        {activeKey === 'excel-import' && <AdminExcelImportModule />}
        {activeKey === 'pages' && <AdminPageManagement navigate={navigate} />}
        {activeKey === 'navigation' && <AdminNavigationManagement />}
        {activeKey === 'media' && <AdminMediaManagement />}
        {activeKey === 'layout-management' && <AdminLayoutManagement initialTab="homepage" />}
        {activeKey === 'hero-slider' && <AdminHeroSliderSection />}
        {activeKey === 'homepage-layout' && <AdminHomepageLayoutSection />}
        {activeKey === 'users' && <AdminUsersSection />}
        {activeKey === 'subscriptions' && <AdminSubscriptionsSection />}
        {activeKey === 'packages' && <AdminPackagesSection />}
        {activeKey === 'wallets' && <AdminWalletsSection />}
        {activeKey === 'payments' && <AdminPaymentsAndTransactionsSection mode="payments" />}
        {activeKey === 'transactions' && (
          <AdminPaymentsAndTransactionsSection mode="transactions" />
        )}
        {activeKey === 'notifications' && <AdminNotificationsSection />}
        {activeKey === 'devices' && <AdminDevicesSection />}
        {activeKey === 'roles' && <AdminRolesSection />}
        {activeKey === 'settings' && <AdminSettingsSection />}
        {activeKey === 'audit-logs' && <AdminAuditLogsSection />}
      </main>
    </div>
  );
}
