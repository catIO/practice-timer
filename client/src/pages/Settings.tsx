import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SettingsType, DEFAULT_SETTINGS } from "@/lib/timerService";
import { getSettings, saveSettings } from "@/lib/localStorage";
import { applyTheme } from "@/lib/theme";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTimerStore } from "@/stores/timerStore";
import { GeneralSettingsTab } from "@/components/settings/GeneralSettingsTab";
import { AccountSettingsTab } from "@/components/settings/AccountSettingsTab";
import "@/assets/headerBlur.css";

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<SettingsType>(
    getSettings() || DEFAULT_SETTINGS
  );
  const { isLoggedIn, user, signOut, refreshUser } = useAuth();

  const initialTab =
    searchParams.get("tab") === "account" ? "account" : "general";
  const [activeTab, setActiveTab] = useState<"general" | "account">(initialTab);

  // Sync activeTab when URL query parameter changes
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "account") {
      setActiveTab("account");
    } else if (tabParam === "general") {
      setActiveTab("general");
    }
  }, [searchParams]);

  const handleTabChange = (tab: "general" | "account") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleSettingsUpdate = (updates: Partial<SettingsType>) => {
    const newSettings = { ...localSettings, ...updates };
    setLocalSettings(newSettings);

    saveSettings(newSettings);

    if (newSettings.theme) {
      applyTheme(newSettings.theme);
    }

    const { setSettings: setStoreSettings } = useTimerStore.getState();
    setStoreSettings(newSettings);

    toast({
      title: "Settings Saved",
      description: "Your settings have been saved successfully.",
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header & Tabs */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customize your practice timers, alerts, and account preferences.
          </p>
        </div>

        {isLoggedIn && (
          <div className="flex gap-2 border-b border-white/10 pb-2">
            <button
              onClick={() => handleTabChange("general")}
              className={`pb-2 px-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "general"
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              General
            </button>
            <button
              onClick={() => handleTabChange("account")}
              className={`pb-2 px-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "account"
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Account
            </button>
          </div>
        )}
      </div>

      {/* Tab Contents */}
      {activeTab === "account" && isLoggedIn ? (
        <AccountSettingsTab
          user={user}
          onSignOut={handleSignOut}
          onRefreshUser={refreshUser}
        />
      ) : (
        <GeneralSettingsTab
          settings={localSettings}
          onUpdateSettings={handleSettingsUpdate}
        />
      )}
    </div>
  );
}