import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SettingsType, DEFAULT_SETTINGS } from "@/lib/timerService";
import Settings from "@/components/Settings";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function SettingsPage() {
  // Fetch user settings from the server
  const { data: settings, isLoading: isLoadingSettings } = useQuery<SettingsType>({
    queryKey: ['/api/settings'],
    staleTime: 0
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: (newSettings: SettingsType) => 
      apiRequest('POST', '/api/settings', newSettings),
    onMutate: async (newSettings) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/settings'] });

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<SettingsType>(['/api/settings']);

      // Optimistically update to the new value
      queryClient.setQueryData<SettingsType>(['/api/settings'], newSettings);

      // Return a context object with the snapshotted value
      return { previousSettings };
    },
    onError: (err, newSettings, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousSettings) {
        queryClient.setQueryData(['/api/settings'], context.previousSettings);
      }
    },
    onSettled: () => {
      // Invalidate all queries that might depend on settings
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/timer'] });
      queryClient.refetchQueries({ queryKey: ['/api/settings'] });
    }
  });

  // Get the current settings with fallback to defaults
  const currentSettings: SettingsType = settings || DEFAULT_SETTINGS;

  return (
    <div className="bg-background text-foreground font-sans min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="p-4 bg-card shadow-sm flex items-center justify-between">
          <h1 className="text-2xl font-medium">Settings</h1>
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground"
            >
              <span className="material-icons">arrow_back</span>
            </Button>
          </Link>
        </header>

        {/* Settings Section */}
        <section className="p-6">
          <Settings
            settings={currentSettings}
            isLoading={isLoadingSettings}
            onChange={(newSettings) => saveSettingsMutation.mutate(newSettings)}
          />
        </section>
      </div>
    </div>
  );
} 