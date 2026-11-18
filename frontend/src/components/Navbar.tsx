import React, { useState } from 'react';
import {
  ChevronDown,
  CreditCard,
  Crown,
  History,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorSmartphone,
  Search,
  Settings,
  Shield,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useSiteConfig } from '../context/SiteConfigContext.tsx';
import { formatCurrency } from '../services/api.ts';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
}

export function Navbar({ currentPath, navigate }: NavbarProps) {
  const { user, wallet, activeSubscription, isAdmin, logout } = useAuth();
  const { settings, headerNav } = useSiteConfig();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');

  const handleNavTarget = (url: string, openInNewTab?: boolean) => {
    if (openInNewTab || /^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(url);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setSearchOpen(false);
    } else {
      navigate('/search');
      setSearchOpen(false);
    }
  };

  if (isAdminRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0C12]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-white"
            >
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.platformName} className="h-7 w-7 rounded object-contain" />
              ) : (
                <VexoraLogoMark />
              )}
              <span className="tracking-wider">{settings.platformName || 'VEXORA'}</span>
              <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-pink-300">
                Admin
              </span>
            </a>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              ← Back to Storefront
            </button>
          </div>
          {user && (
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span className="hidden sm:inline">{user.email || user.fullName}</span>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-white hover:bg-white/10"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-3.5 inset-x-0 z-50 px-3 sm:px-6 pointer-events-none">
      <div className="pointer-events-auto mx-auto flex h-14 max-w-[1160px] items-center justify-between gap-3 rounded-full border border-white/15 bg-black/55 px-4 sm:px-6 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.55)]">
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-200 hover:bg-white/10 hover:text-white md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={settings.platformName} className="h-7 w-7 rounded object-contain" />
            ) : (
              <VexoraLogoMark />
            )}
            <span className="tracking-wider">{settings.platformName || 'VEXORA'}</span>
          </a>
        </div>

        <nav className="hidden md:flex items-center gap-4 lg:gap-5 text-sm font-medium">
          {headerNav.map((link) => {
            const active =
              link.url === '/'
                ? currentPath === '/'
                : currentPath === link.url || currentPath.startsWith(link.url);
            return (
              <a
                key={link.id}
                href={link.url}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavTarget(link.url, link.openInNewTab);
                }}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 ${
                  active ? 'text-white font-semibold' : 'text-slate-200/85 hover:text-white'
                }`}
              >
                <span>{link.label}</span>
                {link.badgeText && (
                  <span className="rounded bg-pink-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-pink-300">
                    {link.badgeText}
                  </span>
                )}
                {active && <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-white" />}
              </a>
            );
          })}

          <button
            type="button"
            onClick={() => navigate('/plans')}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-4 text-sm font-semibold text-white shadow-md shadow-pink-500/20 hover:brightness-110 transition-all whitespace-nowrap shrink-0"
          >
            <Crown className="h-3.5 w-3.5 fill-current" />
            <span>Subscribe</span>
          </button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          {searchOpen ? (
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search titles..."
                autoFocus
                className="h-9 w-40 sm:w-56 rounded-full border border-white/20 bg-black/80 pl-3.5 pr-8 text-xs text-white placeholder-slate-400 focus:border-pink-400 focus:outline-none"
              />
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
                className="absolute right-2.5 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              aria-label="Search catalog"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10 transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
          )}

          {!user ? (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="h-8 rounded-full border border-white/45 px-4 text-xs sm:text-sm font-medium text-white hover:bg-white hover:text-black transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen(!accountOpen)}
                className="flex h-8 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-2.5 text-xs font-medium text-white hover:border-white/50 transition-colors whitespace-nowrap shrink-0"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-[#9333EA] to-[#EC4899] text-[11px] font-bold text-white">
                  {user.fullName?.[0]?.toUpperCase() || 'U'}
                </span>
                <span className="hidden sm:inline max-w-[96px] truncate">{user.fullName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
              </button>

              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                  <div className="absolute right-0 z-50 mt-3 w-64 rounded-2xl border border-white/15 bg-[#12141C] p-2 shadow-2xl">
                    <div className="border-b border-white/10 px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
                      <p className="truncate text-xs text-slate-400">{user.email || user.phone}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-300 font-mono-num">
                        <span>{activeSubscription ? activeSubscription.package.name : 'No Plan'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-pink-400">
                          {wallet ? formatCurrency(wallet.balanceCents) : '$0.00'}
                        </span>
                      </div>
                    </div>

                    <div className="py-1 text-sm">
                      <DropdownItem
                        icon={<LayoutDashboard className="h-4 w-4" />}
                        label="Dashboard"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/dashboard');
                        }}
                      />
                      <DropdownItem
                        icon={<CreditCard className="h-4 w-4" />}
                        label="Subscription Plans"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/plans');
                        }}
                      />
                      <DropdownItem
                        icon={<History className="h-4 w-4" />}
                        label="Watch History"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/history');
                        }}
                      />
                      <DropdownItem
                        icon={<Heart className="h-4 w-4" />}
                        label="Favorites"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/favorites');
                        }}
                      />
                      <DropdownItem
                        icon={<MonitorSmartphone className="h-4 w-4" />}
                        label="Devices"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/devices');
                        }}
                      />
                      <DropdownItem
                        icon={<Settings className="h-4 w-4" />}
                        label="Profile Settings"
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/profile');
                        }}
                      />
                      {isAdmin && (
                        <DropdownItem
                          icon={<Shield className="h-4 w-4 text-pink-400" />}
                          label="Admin Console"
                          highlight
                          onClick={() => {
                            setAccountOpen(false);
                            navigate('/admin');
                          }}
                        />
                      )}
                    </div>

                    <div className="border-t border-white/10 pt-1">
                      <DropdownItem
                        icon={<LogOut className="h-4 w-4" />}
                        label="Sign Out"
                        onClick={async () => {
                          setAccountOpen(false);
                          await logout();
                          navigate('/');
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="pointer-events-auto mx-auto mt-2 max-w-[1160px] rounded-2xl border border-white/15 bg-[#101219]/95 p-3 backdrop-blur-xl shadow-2xl md:hidden">
          <nav className="grid grid-cols-2 gap-2">
            {headerNav.map((link) => {
              const isActive =
                link.url === '/'
                  ? currentPath === '/'
                  : currentPath === link.url || currentPath.startsWith(link.url);
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleNavTarget(link.url, link.openInNewTab);
                  }}
                  className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                    isActive
                      ? 'bg-gradient-to-r from-[#9333EA]/25 to-[#EC4899]/25 text-white border border-pink-500/40'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/plans');
              }}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9333EA] to-[#EC4899] px-3 py-2.5 text-sm font-semibold text-white"
            >
              <Crown className="h-4 w-4 fill-current" />
              <span>Subscribe Plans</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

function VexoraLogoMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="vexoraBrandGrad" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="24" height="24" rx="7" fill="url(#vexoraBrandGrad)" />
      <path d="M8.5 9L14 19.5L19.5 9H16.6L14 14.4L11.4 9H8.5Z" fill="#FFFFFF" />
    </svg>
  );
}

function DropdownItem({
  icon,
  label,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
        highlight
          ? 'text-pink-300 hover:bg-pink-500/10 font-semibold'
          : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
