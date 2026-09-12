import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAboutModal, type AboutModalTab } from '@/contexts/AboutContext';
import { exportAllPracticeData } from '@/lib/exportData';
import { useToast } from '@/hooks/use-toast';
import {
  openProtectedMailto,
  copyProtectedEmail,
} from '@/lib/contactObfuscation';

export function AboutModal() {
  const { isAboutModalOpen, closeAboutModal, activeTab, setActiveTab } = useAboutModal();
  const { toast } = useToast();

  const handleExport = () => {
    try {
      const { count, filename } = exportAllPracticeData();
      toast({
        title: "Practice data exported",
        description: `Exported ${count} data collections to ${filename}.`,
      });
    } catch (e) {
      console.error("Export failed:", e);
      toast({
        title: "Export failed",
        description: "Could not export practice data. Please check browser permissions.",
        variant: "destructive",
      });
    }
  };

  const handleCopyEmail = async () => {
    const success = await copyProtectedEmail();
    if (success) {
      toast({
        title: "Email copied to clipboard",
        description: "You can paste it directly into your email client.",
      });
    }
  };

  return (
    <Dialog open={isAboutModalOpen} onOpenChange={(open) => !open && closeAboutModal()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto bg-slate-900 border-white/10 text-foreground p-5 sm:p-6">
        <DialogHeader className="space-y-2 pb-1 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary shrink-0">
              <svg className="h-6 w-auto fill-current" viewBox="0 0 46 79">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M20.7463 39.5L1.33284 67.4349C0.536414 68.5779 0.0956646 69.8593 0.0138686 71.1723C-0.0679757 72.4759 0.21219 73.8015 0.860683 75.0421C1.50601 76.2763 2.43777 77.265 3.5585 77.9452C4.68857 78.6285 5.99183 79 7.37697 79H38.623C40.0082 79 41.3114 78.6285 42.4415 77.9452C43.5622 77.2651 44.4908 76.2795 45.1393 75.0421C45.7878 73.8015 46.0648 72.4759 45.9861 71.1723C45.9043 69.8593 45.4604 68.581 44.6672 67.4349L25.2537 39.5L44.6672 11.5651C45.4636 10.4221 45.9043 9.14066 45.9861 7.82767C46.068 6.5241 45.7878 5.19853 45.1393 3.95792C44.494 2.72368 43.5622 1.73496 42.4415 1.05481C41.3114 0.371548 40.0082 0 38.623 0H7.37697C5.99183 0 4.68865 0.371548 3.5585 1.05481C2.43785 1.73492 1.50917 2.72046 0.860683 3.95792C0.212206 5.19853 -0.0647845 6.5241 0.0138686 7.82767C0.095713 9.14066 0.539573 10.419 1.33284 11.5651L20.7463 39.5Z"
                />
              </svg>
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Practice Mate
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Structured practice toolkit for musicians
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as AboutModalTab)}
          className="mt-2 space-y-4"
        >
          <TabsList className="grid grid-cols-3 bg-slate-950/70 border border-white/5 p-1 rounded-xl">
            <TabsTrigger value="about" className="text-xs rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              About
            </TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Privacy & Rights
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs rounded-lg data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              Backup & Export
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ABOUT */}
          <TabsContent value="about" className="space-y-4 text-xs text-muted-foreground focus:outline-none">
            <div className="space-y-2 text-sm leading-relaxed text-slate-200">
              <p>
                <strong>Practice Mate</strong> brings deliberate structure and intention to musical practice.
                Plan what you want to work on, time box each piece or exercise, and track your repertoire without turning your practice session into a sterile productivity exercise.
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <span className="material-icons text-primary text-base">apps</span>
                    <span>Practice Lab Ecosystem</span>
                  </div>
                  <a
                    href="https://practice-lab.net"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    practice-lab.net
                    <span className="material-icons text-xs">open_in_new</span>
                  </a>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Practice Mate is part of the <strong>Practice Lab</strong> suite — purpose-built, distraction-free tools designed specifically for musicians, including Bright Sight, Score Tone, Practice Mirror, Spot Practice, Click Up, Practice Koh-Pilot, Rhythm Weaver, Scaled, and Pitch Mate.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <span className="material-icons text-primary text-base">code</span>
                    <span>Built by Catherina</span>
                  </div>
                  <a
                    href="https://catherina.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    catherina.dev
                    <span className="material-icons text-xs">open_in_new</span>
                  </a>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Created to balance music study, work, and life with disciplined, mindful practice habits. Designed to run offline as a Progressive Web App on mobile, tablet, and desktop.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-foreground text-xs">Questions & Feedback</h4>
                  <p className="text-[11px] text-muted-foreground">Found an issue or have a feature idea?</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-xs h-8"
                    onClick={() => openProtectedMailto({ subject: 'Practice Mate Feedback' })}
                  >
                    <span className="material-icons text-xs mr-1">mail</span>
                    Email Feedback
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-muted-foreground hover:text-foreground"
                    onClick={handleCopyEmail}
                    title="Copy email address"
                  >
                    <span className="material-icons text-sm">content_copy</span>
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: PRIVACY & RIGHTS */}
          <TabsContent value="privacy" className="space-y-4 text-xs text-muted-foreground focus:outline-none">
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <h4 className="font-semibold text-foreground text-xs">
                  Local-First by Default
                </h4>
                <p className="text-[11px] leading-relaxed">
                  No account is required. In guest mode, your routines, practice plans, timer preferences, and logs remain strictly on your device inside browser <code className="text-primary font-mono text-[10px]">localStorage</code> and <code className="text-primary font-mono text-[10px]">IndexedDB</code>. We do not track you or sell data.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <h4 className="font-semibold text-foreground text-xs">
                  Optional Cloud Sync (Supabase)
                </h4>
                <p className="text-[11px] leading-relaxed">
                  If you choose to create an account, your practice routines, lesson plans, repertoire items, and completion records sync securely via Supabase so you can access your practice setup across different devices.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                <h4 className="font-semibold text-foreground text-xs">
                  Public Practice Reports
                </h4>
                <p className="text-[11px] leading-relaxed">
                  When you use the "Share Report" button, a read-only snapshot is published under a unique, unguessable link (<code className="text-primary font-mono text-[10px]">/r/:id</code>). Only people with whom you share this link can view the snapshot.
                </p>
              </div>

              {/* GDPR / CCPA DATA DELETION CONTACT */}
              <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                <h4 className="font-semibold text-primary flex items-center gap-1.5 text-xs">
                  <span className="material-icons text-sm">security</span>
                  Data Deletion & GDPR / CCPA Rights
                </h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Under GDPR, CCPA, and applicable data privacy regulations, you have the right to request access to or permanent deletion of your account and all associated cloud data.
                </p>
                <div className="pt-1 space-y-2">
                  <p className="text-[11px] text-slate-300">
                    To request account and data deletion, submit a request or copy our contact address:
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 text-xs h-8 bg-white/5"
                      onClick={() => openProtectedMailto({ subject: 'Practice Mate Account and Data Deletion Request' })}
                    >
                      <span className="material-icons text-xs mr-1">mail</span>
                      Email Deletion Request
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                      onClick={handleCopyEmail}
                    >
                      <span className="material-icons text-xs mr-1">content_copy</span>
                      Copy Contact Email
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Please send the request from or specify the email address registered with your Practice Mate account. All your stored records, synced plans, and account credentials will be permanently erased.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[11px]">
                <span>Full Privacy Policy:</span>
                <a
                  href="https://practice-lab.net/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                >
                  practice-lab.net/privacy
                  <span className="material-icons text-xs">open_in_new</span>
                </a>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: BACKUP & EXPORT */}
          <TabsContent value="data" className="space-y-4 text-xs text-muted-foreground focus:outline-none">
            <div className="space-y-3">
              <p className="text-slate-300 text-xs leading-relaxed">
                You own your practice data. You can download a complete backup of your practice plans, lesson plans, session logs, segment time boxes, and settings in standardized JSON format anytime.
              </p>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground text-xs">Export Practice Data</h4>
                    <p className="text-[11px] text-muted-foreground">Download all local routines, logs, and settings</p>
                  </div>
                  <Button
                    onClick={handleExport}
                    size="sm"
                    className="h-9 px-3 gap-1.5 text-xs font-medium"
                  >
                    <span className="material-icons text-sm">download</span>
                    Export JSON
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground border-t border-white/5 pt-2">
                  Useful for keeping local offline backups, moving to a new browser, or archival before clearing your browser cache.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-[11px] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <span className="material-icons text-sm">warning</span>
                  Browser Storage Note for Guest Users
                </div>
                <p>
                  If you use Practice Mate without signing in, your data lives strictly in your browser. Clearing your browser cookies or site history will erase your local practice log. We recommend exporting periodic backups.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
