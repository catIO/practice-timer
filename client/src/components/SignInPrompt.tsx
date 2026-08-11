import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/AuthModal";

interface SignInPromptProps {
    /** Material Icons name shown in the rounded badge. */
    icon: string;
    /** Heading text. */
    title: string;
    /** Body copy explaining what the feature offers. */
    description: string;
}

/**
 * Consistent "sign in required" prompt used to gate registered-user-only
 * features (Practice Plan, Lesson Plan, Repertoire). Mirrors the visual
 * pattern first introduced on the Repertoire list.
 */
export function SignInPrompt({ icon, title, description }: SignInPromptProps) {
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

    return (
        <div className="text-center py-10 max-w-md mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-center">
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <span className="material-icons text-3xl">{icon}</span>
                </div>
            </div>
            <div>
                <h2 className="text-xl font-bold mb-2">{title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {description}
                </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
                <Button
                    onClick={() => {
                        setAuthMode("signup");
                        setAuthOpen(true);
                    }}
                    className="w-full h-10 rounded-xl"
                >
                    Create Free Account
                </Button>
                <Button
                    variant="outline"
                    onClick={() => {
                        setAuthMode("signin");
                        setAuthOpen(true);
                    }}
                    className="w-full h-10 rounded-xl border-white/10 hover:bg-white/5"
                >
                    Sign In
                </Button>
            </div>
            <AuthModal
                isOpen={authOpen}
                onClose={() => setAuthOpen(false)}
                initialMode={authMode}
            />
        </div>
    );
}
