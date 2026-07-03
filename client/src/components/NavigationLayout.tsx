import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerStore } from '@/stores/timerStore';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuthModal } from '@/components/AuthModal';
import { cn } from '@/lib/utils';

interface NavigationLayoutProps {
  children: React.ReactNode;
}

export function NavigationLayout({ children }: NavigationLayoutProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { isLoggedIn, user, signOut, isPasswordRecovery } = useAuth();
  const {
    isRunning,
    audioInitialized,
    activePieceName,
    pieceTimeRemaining,
    clearPiece,
    timeRemaining,
    mode,
    isPracticeComplete,
    startTimer,
    pauseTimer,
    skipTimer,
  } = useTimerStore();

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_expanded') !== 'false';
    }
    return true;
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>('signin');

  const isReportPath = pathname.startsWith('/report') || pathname.startsWith('/r/');
  if (isPasswordRecovery || pathname === '/reset-password' || isReportPath) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4">
        <div className={cn(
          "w-full bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8",
          isReportPath ? "max-w-3xl" : "max-w-md"
        )}>
          {children}
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_expanded', String(isSidebarExpanded));
    }
  }, [isSidebarExpanded]);

  const toggleSidebar = () => {
    setIsSidebarExpanded(!isSidebarExpanded);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const openSignIn = () => {
    setAuthInitialMode('signin');
    setAuthModalOpen(true);
  };

  // Define navigation destinations
  const navItems = [
    { path: '/', label: 'Timer', icon: 'timer' },
    { path: '/practice-plan', label: 'Practice Plan', icon: 'assignment' },
    { path: '/repertoire', label: 'Repertoire', icon: 'library_music' },
    { path: '/practice-log', label: 'Practice Log', icon: 'history' },
    { path: '/settings', label: 'Settings', icon: 'settings' },
  ];

  // Detect if on sub-path (like detail screens) for rendering Top Bar back arrow
  const isRepertoireDetail = pathname.startsWith('/repertoire/') && pathname !== '/repertoire';
  const isReportDetail = pathname.startsWith('/report/') || pathname.startsWith('/r/');
  const isSubPage = isRepertoireDetail || isReportDetail;

  // Determine page title
  let pageTitle = 'Practice Mate';
  if (pathname === '/') {
    pageTitle = 'Timer';
  } else if (pathname === '/practice-plan') {
    pageTitle = 'Practice Plan';
  } else if (pathname === '/repertoire') {
    pageTitle = 'Repertoire';
  } else if (isRepertoireDetail) {
    pageTitle = 'Piece Details';
  } else if (pathname === '/practice-log') {
    pageTitle = 'Practice Log';
  } else if (pathname === '/settings') {
    pageTitle = 'Settings';
  } else if (isReportDetail) {
    pageTitle = 'Practice Report';
  }

  // Handle back navigation based on page context
  const handleBackNavigation = () => {
    if (isRepertoireDetail) {
      navigate('/repertoire');
    } else {
      navigate(-1);
    }
  };

  // Helper to check if a navigation item path matches the current path
  const isTabActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  // Check if page needs standard wider layout
  const isLargePage = pathname !== '/';

  // Format seconds for active piece overlay
  const formatSeconds = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-foreground font-sans select-none antialiased">
      {/* 1. Desktop & Tablet Side Sidebar/Rail */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-white/10 bg-slate-900/30 backdrop-blur-md transition-all duration-300 shrink-0",
          isSidebarExpanded ? "w-64" : "w-20"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-4 flex items-center gap-3 border-b border-white/10">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground"
            onClick={toggleSidebar}
            aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            <span className="material-icons text-xl">menu</span>
          </Button>
          {isSidebarExpanded && (
            <span className="font-bold text-lg tracking-tight text-primary">
              Practice Mate
            </span>
          )}
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = isTabActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-3 py-3 rounded-2xl transition-all duration-200 group relative",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <div className="flex items-center justify-center h-6 w-6">
                  <span className={cn(
                    "material-icons text-xl",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {item.icon}
                  </span>
                </div>
                {isSidebarExpanded ? (
                  <span className="text-sm truncate">{item.label}</span>
                ) : (
                  <span className="absolute left-16 scale-0 bg-slate-900 border border-white/10 text-foreground text-xs py-1 px-2.5 rounded-lg transition-all group-hover:scale-100 whitespace-nowrap z-50">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 2. Main Container (Top App Bar + Page Card View) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-16 md:pb-0">
        {/* Top App Bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-white/10 bg-slate-950/80 backdrop-blur-md px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSubPage ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-foreground mr-1"
                onClick={handleBackNavigation}
                aria-label="Go back"
              >
                <span className="material-icons text-xl">arrow_back</span>
              </Button>
            ) : (
              <div className="md:hidden flex items-center justify-center h-10 w-10 text-primary">
                <svg className="h-6 w-auto fill-current" viewBox="0 0 46 79">
                  <path fillRule="evenodd" clipRule="evenodd" d="M20.7463 39.5L1.33284 67.4349C0.536414 68.5779 0.0956646 69.8593 0.0138686 71.1723C-0.0679757 72.4759 0.21219 73.8015 0.860683 75.0421C1.50601 76.2763 2.43777 77.265 3.5585 77.9452C4.68857 78.6285 5.99183 79 7.37697 79H38.623C40.0082 79 41.3114 78.6285 42.4415 77.9452C43.5622 77.2651 44.4908 76.2795 45.1393 75.0421C45.7878 73.8015 46.0648 72.4759 45.9861 71.1723C45.9043 69.8593 45.4604 68.581 44.6672 67.4349L25.2537 39.5L44.6672 11.5651C45.4636 10.4221 45.9043 9.14066 45.9861 7.82767C46.068 6.5241 45.7878 5.19853 45.1393 3.95792C44.494 2.72368 43.5622 1.73496 42.4415 1.05481C41.3114 0.371548 40.0082 0 38.623 0H7.37697C5.99183 0 4.68865 0.371548 3.5585 1.05481C2.43785 1.73492 1.50917 2.72046 0.860683 3.95792C0.212206 5.19853 -0.0647845 6.5241 0.0138686 7.82767C0.095713 9.14066 0.539573 10.419 1.33284 11.5651L20.7463 39.5Z" />
                </svg>
              </div>
            )}
            <h1 className="text-xl font-bold tracking-tight text-foreground text-ellipsis overflow-hidden whitespace-nowrap max-w-[200px] sm:max-w-none">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Active Piece Status Banner */}
            {activePieceName && (
              <div className="hidden sm:flex items-center gap-2 bg-slate-900/80 border border-white/5 rounded-full py-1 pl-3 pr-2 text-xs">
                <span className="text-muted-foreground font-medium truncate max-w-[120px]">
                  {activePieceName.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')}
                </span>
                <span className="text-primary font-mono font-bold">
                  {formatSeconds(pieceTimeRemaining)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground"
                  onClick={clearPiece}
                  title="Clear active piece"
                >
                  <span className="material-icons text-xs">close</span>
                </Button>
              </div>
            )}

            {/* Global Session Timer Widget */}
            {typeof timeRemaining === 'number' && !isPracticeComplete && (
              <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-full py-1 pl-3 pr-2 text-xs">
                <span className={cn(
                  "font-bold uppercase tracking-wider text-[10px]",
                  mode === 'break' ? "text-green-400" : "text-red-400"
                )}>
                  {mode === 'break' ? 'Break' : 'Work'}
                </span>
                <span className="font-mono font-bold text-foreground">
                  {formatSeconds(timeRemaining)}
                </span>
                <div className="flex items-center gap-0.5 border-l border-white/10 pl-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={isRunning ? pauseTimer : startTimer}
                    title={isRunning ? 'Pause' : 'Play'}
                  >
                    <span className="material-icons text-xs">{isRunning ? 'pause' : 'play_arrow'}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={skipTimer}
                    title="Skip session"
                  >
                    <span className="material-icons text-xs">skip_next</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Quick Status Dots */}
            <div className="flex items-center gap-1.5 px-1">
              {/* Wake Lock */}
              {isRunning && (
                <div
                  className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"
                  title="Wake lock active"
                />
              )}
              {/* Audio Context Status */}
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-colors duration-300",
                  audioInitialized ? "bg-emerald-500" : "bg-slate-700"
                )}
                title={audioInitialized ? "Audio engine ready" : "Audio context suspended"}
              />
            </div>

            {/* Auth Dropdown Widget */}
            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full bg-slate-900 border border-white/10 p-0 overflow-hidden">
                    <span className="material-icons text-muted-foreground text-xl">person</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-slate-900 border border-white/10 text-foreground">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs leading-none text-muted-foreground">Signed in as</p>
                      <p className="text-sm font-semibold truncate leading-normal">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => navigate('/settings')}
                    className="focus:bg-white/5 focus:text-foreground cursor-pointer"
                  >
                    <span className="material-icons text-sm mr-2">settings</span>
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                  >
                    <span className="material-icons text-sm mr-2">logout</span>
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 rounded-xl border border-white/10 text-xs font-semibold text-primary hover:bg-white/5"
                onClick={openSignIn}
              >
                <span className="material-icons text-sm mr-1.5">login</span>
                Sign In
              </Button>
            )}
          </div>
        </header>

        {/* Dynamic Card Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col justify-start">
          <div
            className={cn(
              "w-full mx-auto bg-slate-900/50 border border-white/10 rounded-3xl p-6 sm:p-8 transition-all duration-300",
              isLargePage ? "max-w-4xl" : "max-w-2xl"
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {/* 3. Mobile Navigation Bottom Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-white/10 bg-slate-950/95 backdrop-blur-md z-30 flex justify-around items-center px-2 pb-safe shadow-lg">
        {navItems.map((item) => {
          const active = isTabActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all duration-150",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-full px-4 py-0.5 mb-0.5 transition-all",
                  active ? "bg-primary/10" : "bg-transparent"
                )}
              >
                <span className="material-icons text-xl">{item.icon}</span>
              </div>
              <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Auth Modal Container */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authInitialMode}
      />
    </div>
  );
}
