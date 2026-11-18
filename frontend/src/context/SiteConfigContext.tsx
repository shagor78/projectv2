import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../services/api.ts';
import { NavigationItemRecord, PublicSettings } from '../types/platform.ts';

interface SiteConfigContextValue {
  settings: PublicSettings;
  headerNav: NavigationItemRecord[];
  footerNav: NavigationItemRecord[];
  footerMembershipNav: NavigationItemRecord[];
  loading: boolean;
  refreshSiteConfig: () => Promise<void>;
}

const DEFAULT_SETTINGS: PublicSettings = {
  platformName: 'VEXORA',
  supportEmail: 'support@vexora.tv',
  maintenanceMode: false,
  logoUrl: '',
  faviconUrl: '',
  footerTagline:
    'Commercial OTT cinema, serialized drama, and live IPTV broadcasting with multi-CDN HLS failover.',
  contactPhone: '+1 (800) 555-0199',
  contactAddress: 'Broadcast Plaza Suite 400, New York, NY',
  seoTitle: 'VEXORA — OTT & Live IPTV Streaming',
  seoDescription:
    'Stream Live TV channels with automatic HLS failover, movies, drama, web series, and live sports in adaptive HD and 4K.',
  socialLinks: {
    facebook: '',
    youtube: '',
    instagram: '',
    x: '',
  },
};

const DEFAULT_HEADER_NAV: NavigationItemRecord[] = [
  { id: -1, label: 'Home', url: '/', location: 'header', openInNewTab: false, sortOrder: 1, isVisible: true },
  { id: -2, label: 'Live TV', url: '/live-tv', location: 'header', openInNewTab: false, sortOrder: 2, isVisible: true },
  { id: -3, label: 'Sports', url: '/sports', location: 'header', openInNewTab: false, sortOrder: 3, isVisible: true },
  { id: -4, label: 'Drama', url: '/drama', location: 'header', openInNewTab: false, sortOrder: 4, isVisible: true },
  { id: -5, label: 'Movies', url: '/movies', location: 'header', openInNewTab: false, sortOrder: 5, isVisible: true },
  { id: -6, label: 'Web Series', url: '/series', location: 'header', openInNewTab: false, sortOrder: 6, isVisible: true },
];

const SiteConfigContext = createContext<SiteConfigContextValue | null>(null);

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_SETTINGS);
  const [headerNav, setHeaderNav] = useState<NavigationItemRecord[]>(DEFAULT_HEADER_NAV);
  const [footerNav, setFooterNav] = useState<NavigationItemRecord[]>([]);
  const [footerMembershipNav, setFooterMembershipNav] = useState<NavigationItemRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSiteConfig = useCallback(async () => {
    try {
      const [settingsRes, navRes] = await Promise.all([
        apiFetch<PublicSettings>('/api/settings/public'),
        apiFetch<{
          header: NavigationItemRecord[];
          footer: NavigationItemRecord[];
          footerMembership: NavigationItemRecord[];
        }>('/api/navigation'),
      ]);

      if (settingsRes?.platformName) {
        setSettings((prev) => ({
          ...prev,
          ...settingsRes,
          socialLinks: {
            ...prev.socialLinks,
            ...(settingsRes.socialLinks || {}),
          },
        }));

        if (settingsRes.seoTitle) {
          document.title = settingsRes.seoTitle;
        }
        if (settingsRes.seoDescription) {
          const metaDesc = document.querySelector('meta[name="description"]');
          if (metaDesc) metaDesc.setAttribute('content', settingsRes.seoDescription);
        }
        if (settingsRes.faviconUrl) {
          let iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (!iconLink) {
            iconLink = document.createElement('link');
            iconLink.rel = 'icon';
            document.head.appendChild(iconLink);
          }
          iconLink.href = settingsRes.faviconUrl;
        }
      }

      if (Array.isArray(navRes?.header) && navRes.header.length > 0) {
        setHeaderNav(navRes.header);
      }
      if (Array.isArray(navRes?.footer)) {
        setFooterNav(navRes.footer);
      }
      if (Array.isArray(navRes?.footerMembership)) {
        setFooterMembershipNav(navRes.footerMembership);
      }
    } catch {
      // Keep safe defaults while storefront loads
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSiteConfig();
  }, [refreshSiteConfig]);

  return (
    <SiteConfigContext.Provider
      value={{
        settings,
        headerNav,
        footerNav,
        footerMembershipNav,
        loading,
        refreshSiteConfig,
      }}
    >
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) throw new Error('useSiteConfig must be used inside SiteConfigProvider');
  return ctx;
}
