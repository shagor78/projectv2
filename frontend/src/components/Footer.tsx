import React from 'react';
import { Globe, Mail, MapPin, Phone } from 'lucide-react';
import { useSiteConfig } from '../context/SiteConfigContext.tsx';

interface FooterProps {
  navigate: (path: string) => void;
}

const FALLBACK_BROWSE = [
  { id: -1, label: 'Live TV Channels', url: '/live-tv', openInNewTab: false },
  { id: -2, label: 'Movies', url: '/movies', openInNewTab: false },
  { id: -3, label: 'Drama', url: '/drama', openInNewTab: false },
  { id: -4, label: 'Web Series', url: '/series', openInNewTab: false },
  { id: -5, label: 'Sports', url: '/sports', openInNewTab: false },
];

const FALLBACK_MEMBERSHIP = [
  { id: -11, label: 'Subscription Plans', url: '/plans', openInNewTab: false },
  { id: -12, label: 'Account & Wallet', url: '/dashboard', openInNewTab: false },
  { id: -13, label: 'Device Management', url: '/devices', openInNewTab: false },
  { id: -14, label: 'About Us', url: '/page/about', openInNewTab: false },
];

export function Footer({ navigate }: FooterProps) {
  const { settings, footerNav, footerMembershipNav } = useSiteConfig();

  const browseLinks = footerNav.length > 0 ? footerNav : FALLBACK_BROWSE;
  const membershipLinks =
    footerMembershipNav.length > 0 ? footerMembershipNav : FALLBACK_MEMBERSHIP;

  const openLink = (url: string, openInNewTab?: boolean) => {
    if (openInNewTab || /^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(url);
  };

  const socialEntries = [
    { name: 'YouTube', url: settings.socialLinks?.youtube },
    { name: 'Facebook', url: settings.socialLinks?.facebook },
    { name: 'Instagram', url: settings.socialLinks?.instagram },
    { name: 'X', url: settings.socialLinks?.x },
  ].filter((s) => Boolean(s.url));

  return (
    <footer className="mt-20 border-t border-white/10 bg-[#07070A]">
      <div className="w-full px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-display text-lg font-extrabold tracking-wider text-white">
              {settings.logoUrl && (
                <img src={settings.logoUrl} alt={settings.platformName} className="h-6 w-6 rounded object-contain" />
              )}
              <span className="bg-gradient-to-r from-[#9333EA] to-[#EC4899] bg-clip-text text-transparent">
                {settings.platformName || 'VEXORA'}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              {settings.footerTagline}
            </p>
            {socialEntries.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {socialEntries.map((s) => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-300 hover:border-pink-400/50 hover:text-white"
                  >
                    <Globe className="h-3 w-3" />
                    {s.name}
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white">Browse</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              {browseLinks.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openLink(item.url, item.openInNewTab)}
                    className="hover:text-white transition-colors"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white">Membership &amp; Info</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              {membershipLinks.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openLink(item.url, item.openInNewTab)}
                    className="hover:text-white transition-colors"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white">Contact &amp; Platforms</h4>
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              {settings.supportEmail && (
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-pink-400" />
                  <span className="truncate">{settings.supportEmail}</span>
                </p>
              )}
              {settings.contactPhone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-pink-400" />
                  <span>{settings.contactPhone}</span>
                </p>
              )}
              {settings.contactAddress && (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-400" />
                  <span>{settings.contactAddress}</span>
                </p>
              )}
              <p className="pt-2 text-xs leading-relaxed text-slate-500">
                Web · Android &amp; iOS · Android TV, Samsung Tizen &amp; LG webOS · Windows &amp; Linux
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {settings.platformName || 'VEXORA'} Media Networks. All rights reserved.
          </p>
          <p>English Edition · Adaptive HLS Streaming</p>
        </div>
      </div>
    </footer>
  );
}
