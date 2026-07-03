// client/src/lib/authListener.ts
import { supabase } from "./supabaseClient";
import { claimAnonymousReports } from "./reportShare";

if (supabase) {
  supabase.auth.onAuthStateChange((event, _session) => {
    if (event === "SIGNED_IN") {
      claimAnonymousReports()
        .then(() => console.log("[authListener] Anonymous reports linked to user"))
        .catch((e) => console.warn("[authListener] Claim error", e));
    }
  });
}
