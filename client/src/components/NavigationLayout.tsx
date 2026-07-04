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
  if (isPasswordRecovery || pathname === '/reset-password') {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4">
        <div className={cn(
          "w-full bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8",
          "max-w-md"
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
    <div className="flex min-h-screen bg-transparent text-foreground font-sans antialiased">
      {/* 1. Desktop & Tablet Side Sidebar/Rail */}
      <aside
        className={cn(
          "flex flex-col border-r border-black/5 dark:border-white/10 bg-slate-100/30 dark:bg-slate-900/30 backdrop-blur-md transition-all duration-300 shrink-0",
          isSidebarExpanded ? "w-16 md:w-64" : "w-16 md:w-20"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 px-2 md:px-4 flex items-center md:gap-3 border-b border-black/5 dark:border-white/10 justify-center md:justify-start">
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex h-10 w-10 text-muted-foreground hover:text-foreground"
            onClick={toggleSidebar}
            aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            <span className="material-icons text-xl">menu</span>
          </Button>
          <div className="md:hidden flex items-center justify-center h-10 w-10 text-primary">
            <svg className="h-6 w-auto fill-current" viewBox="0 0 46 79">
              <path fillRule="evenodd" clipRule="evenodd" d="M20.7463 39.5L1.33284 67.4349C0.536414 68.5779 0.0956646 69.8593 0.0138686 71.1723C-0.0679757 72.4759 0.21219 73.8015 0.860683 75.0421C1.50601 76.2763 2.43777 77.265 3.5585 77.9452C4.68857 78.6285 5.99183 79 7.37697 79H38.623C40.0082 79 41.3114 78.6285 42.4415 77.9452C43.5622 77.2651 44.4908 76.2795 45.1393 75.0421C45.7878 73.8015 46.0648 72.4759 45.9861 71.1723C45.9043 69.8593 45.4604 68.581 44.6672 67.4349L25.2537 39.5L44.6672 11.5651C45.4636 10.4221 45.9043 9.14066 45.9861 7.82767C46.068 6.5241 45.7878 5.19853 45.1393 3.95792C44.494 2.72368 43.5622 1.73496 42.4415 1.05481C41.3114 0.371548 40.0082 0 38.623 0H7.37697C5.99183 0 4.68865 0.371548 3.5585 1.05481C2.43785 1.73492 1.50917 2.72046 0.860683 3.95792C0.212206 5.19853 -0.0647845 6.5241 0.0138686 7.82767C0.095713 9.14066 0.539573 10.419 1.33284 11.5651L20.7463 39.5Z" />
            </svg>
          </div>
          {isSidebarExpanded && (
            <span className="hidden md:inline font-bold text-lg tracking-tight text-primary">
              Practice Mate
            </span>
          )}
        </div>

        {/* Sidebar Navigation Links */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {isReportPath ? (
            <div className="space-y-2">
              {/* Desktop/Expanded card */}
              <div className={cn(
                "p-3 rounded-2xl bg-primary/5 border border-primary/10 text-center md:text-left transition-all duration-300",
                isSidebarExpanded ? "block" : "hidden md:hidden"
              )}>
                <div className="flex items-center gap-2 text-primary mb-1 justify-center md:justify-start">
                  <span className="material-icons text-lg">share</span>
                  <span className="font-bold text-xs uppercase tracking-wider">Shared View</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-normal mb-3">
                  This report is read-only.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center text-xs border-primary/20 text-primary hover:bg-primary/10 rounded-xl"
                  onClick={() => navigate('/')}
                >
                  <span className="material-icons text-sm mr-1">arrow_back</span>
                  My Workspace
                </Button>
              </div>

              {/* Collapsed/Icon-only Button */}
              <div className={cn(
                "flex justify-center",
                isSidebarExpanded ? "md:hidden" : "block"
              )}>
                <button
                  onClick={() => navigate('/')}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground transition-all duration-200 relative group"
                  aria-label="Go to My Workspace"
                >
                  <span className="material-icons text-xl">home</span>
                  <span className="absolute left-16 scale-0 bg-slate-900 border border-white/10 text-foreground text-xs py-1 px-2.5 rounded-lg transition-all whitespace-nowrap z-50 group-hover:scale-100">
                    Go to My Workspace
                  </span>
                </button>
              </div>
            </div>
          ) : (
            navItems.map((item) => {
              const active = isTabActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-4 px-2 md:px-3 py-3 rounded-2xl transition-all duration-200 group relative justify-center md:justify-start",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
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
                  <span className={cn(
                    "text-sm truncate transition-all duration-200",
                    isSidebarExpanded ? "hidden md:inline" : "hidden"
                  )}>
                    {item.label}
                  </span>
                  <span className={cn(
                    "absolute left-16 scale-0 bg-slate-900 border border-white/10 text-foreground text-xs py-1 px-2.5 rounded-lg transition-all whitespace-nowrap z-50",
                    isSidebarExpanded ? "max-md:group-hover:scale-100" : "group-hover:scale-100"
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })
          )}
        </nav>
      </aside>

      {/* 2. Main Container (Top App Bar + Page Card View) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-0">
        {/* Top App Bar */}
        <header className="sticky top-0 z-20 h-16 bg-transparent px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSubPage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground hover:text-foreground mr-1"
                onClick={handleBackNavigation}
                aria-label="Go back"
              >
                <span className="material-icons text-xl">arrow_back</span>
              </Button>
            )}
            <h1 className="text-xl font-bold tracking-tight text-foreground text-ellipsis overflow-hidden whitespace-nowrap max-w-[200px] sm:max-w-none">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Active Piece Status Banner */}
            {!isReportPath && activePieceName && (
              <div className="hidden sm:flex items-center gap-3 bg-slate-100/80 dark:bg-slate-900/80 border border-black/5 dark:border-white/5 rounded-full py-1.5 pl-4 pr-2 text-sm">
                <span className="text-muted-foreground font-medium truncate max-w-[150px]">
                  {activePieceName.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')}
                </span>
                <span className="text-primary font-mono font-bold text-base">
                  {formatSeconds(pieceTimeRemaining)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                  onClick={clearPiece}
                  title="Clear active piece"
                >
                  <span className="material-icons text-sm">close</span>
                </Button>
              </div>
            )}

            {/* Global Session Timer Widget */}
            {!isReportPath && typeof timeRemaining === 'number' && !isPracticeComplete && (
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 border border-black/5 dark:border-white/10 rounded-full py-1.5 pl-4 pr-2 text-sm">
                <span className={cn(
                  "font-bold uppercase tracking-wider text-[11px]",
                  mode === 'break' ? "text-green-400" : "text-red-400"
                )}>
                  {mode === 'break' ? 'Break' : 'Work'}
                </span>
                <span className="font-mono font-bold text-foreground text-base">
                  {formatSeconds(timeRemaining)}
                </span>
                <div className="flex items-center gap-1 border-l border-black/10 dark:border-white/10 pl-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                    onClick={isRunning ? pauseTimer : startTimer}
                    title={isRunning ? 'Pause' : 'Play'}
                  >
                    <span className="material-icons text-base">{isRunning ? 'pause' : 'play_arrow'}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-black/5 dark:hover:bg-white/10 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                    onClick={skipTimer}
                    title="Skip session"
                  >
                    <span className="material-icons text-base">skip_next</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Quick Status Dots */}
            <div className="flex items-center gap-2 px-1">
              {/* Wake Lock */}
              {isRunning && (
                <div
                  className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"
                  title="Wake lock active"
                />
              )}
              {/* Audio Context Status */}
              <div
                className={cn(
                  "w-3 h-3 rounded-full transition-colors duration-300",
                  audioInitialized ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                )}
                title={audioInitialized ? "Audio engine ready" : "Audio context suspended"}
              />
            </div>

            {/* Auth Dropdown Widget */}
            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-900 border border-black/5 dark:border-white/10 p-0 overflow-hidden">
                    <span className="material-icons text-muted-foreground text-2xl">person</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 text-foreground">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs leading-none text-muted-foreground">Signed in as</p>
                      <p className="text-sm font-semibold truncate leading-normal">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={() => navigate('/settings?tab=account')}
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
                size="default"
                className="h-10 px-4 rounded-xl border border-black/10 dark:border-white/10 text-sm font-semibold text-primary hover:bg-black/5 dark:hover:bg-white/5"
                onClick={openSignIn}
              >
                <span className="material-icons text-base mr-2">login</span>
                Sign In
              </Button>
            )}
          </div>
        </header>

        {/* Dynamic Card Area */}
        <main className="flex-1 overflow-y-auto p-1 sm:p-6 md:p-8 flex flex-col justify-start">
          {isReportPath && (
            <div className="w-full max-w-4xl mx-auto mb-6 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm backdrop-blur-md">
              <div className="flex items-center gap-3 text-foreground">
                <span className="material-icons text-primary text-xl shrink-0 select-none">cloud_queue</span>
                <span className="leading-relaxed">
                  You are viewing a <strong>shared practice report</strong> (Read-Only). You can navigate back to your own workspace at any time.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-primary/20 text-primary hover:bg-primary/10 rounded-xl transition-all font-medium py-1.5"
                onClick={() => navigate('/')}
              >
                <span className="material-icons text-sm mr-1">arrow_back</span>
                Go to My Workspace
              </Button>
            </div>
          )}
          <div
            className={cn(
              "w-full mx-auto bg-white/70 dark:bg-slate-900/50 border border-black/5 dark:border-white/10 rounded-2xl sm:rounded-3xl p-2 sm:p-8 transition-all duration-300",
              isLargePage ? "max-w-4xl" : "max-w-2xl"
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Auth Modal Container */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authInitialMode}
      />
    </div>
  );
}
