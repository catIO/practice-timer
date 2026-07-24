import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface RichLinkProps {
    url: string;
    /** Progress report: stronger refetch/retry so title pills appear without a hard reload. */
    eagerPreview?: boolean;
}

interface Metadata {
    title?: string;
    description?: string;
    image?: string;
    icon?: string;
    url: string;
}

async function fetchMetadata(url: string, fetchOpts?: { cache?: RequestCache }): Promise<Metadata> {
    // Optimization: Check if it's a known media site (YouTube, Vimeo) and use noembed (CORS friendly)
    // This bypasses the need for our server function and avoids bot detection issues.
    const isMediaUrl = url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');

    if (isMediaUrl) {
        try {
            const noembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
            if (noembedRes.ok) {
                const data = await noembedRes.json();
                if (data.title) {
                    return {
                        title: data.title,
                        description: data.author_name, // YouTube oEmbed often puts channel name here
                        image: data.thumbnail_url,
                        icon: "https://www.youtube.com/favicon.ico",
                        url: url
                    };
                }
            }
        } catch (e) {
            console.warn("Client-side oEmbed failed, falling back to server:", e);
        }
    }

    // Fallback to our server function for everything else
    const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`, {
        cache: fetchOpts?.cache ?? "default",
    });
    if (!res.ok) {
        console.error("Metadata fetch failed:", res.status, res.statusText);
        throw new Error("Failed to fetch metadata");
    }
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        console.error("Metadata endpoint returned non-JSON:", await res.text().then(t => t.slice(0, 100)));
        throw new Error("Invalid response format");
    }
    return res.json();
}

export function YouTubeIcon({ className = "w-4 h-4 shrink-0" }: { className?: string }) {
    return (
        <svg className={cn("w-4 h-4 shrink-0", className)} viewBox="0 0 24 24">
            <path
                fill="#FF0000"
                d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
            />
            <path
                fill="#FFFFFF"
                d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"
            />
        </svg>
    );
}

export function RichLink({ url, eagerPreview }: RichLinkProps) {
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

    const { data: metadata, isLoading, isError } = useQuery({
        queryKey: ['metadata', url],
        queryFn: () =>
            fetchMetadata(url, eagerPreview ? { cache: "no-store" } : undefined),
        staleTime: eagerPreview ? 0 : 1000 * 60 * 60 * 24,
        gcTime: eagerPreview ? 1000 * 60 * 10 : 1000 * 60 * 60,
        retry: eagerPreview ? 5 : 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
        refetchOnMount: eagerPreview ? "always" : true,
    });

    if (isYouTube) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                    "inline-flex items-center gap-2 px-3 py-1 rounded-xl shrink-0",
                    "bg-slate-900/80 dark:bg-slate-900/90 border border-black/10 dark:border-white/10",
                    "hover:bg-slate-800/90 hover:border-white/20",
                    "transition-all no-underline text-foreground align-middle my-0.5",
                    "-ml-1.5"
                )}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <YouTubeIcon className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium leading-tight whitespace-nowrap text-foreground">
                    {metadata?.title || url}
                </span>
            </a>
        );
    }

    if (isLoading) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground underline decoration-muted-foreground/30 hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {url}
            </a>
        );
    }

    if (isError || !metadata) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:text-primary/80"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {url}
            </a>
        );
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded shrink-0",
                "bg-[rgba(135,131,120,0.15)] hover:bg-[rgba(135,131,120,0.25)]",
                "transition-colors no-underline text-foreground align-middle",
                "-ml-1.5"
            )}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {metadata.icon ? (
                <img
                    src={metadata.icon}
                    alt=""
                    className="w-4 h-4 object-contain shrink-0 rounded-sm"
                    onError={(e) => {
                        // Fallback to simple icon if image load fails
                        e.currentTarget.style.display = 'none';
                    }}
                />
            ) : (
                <span className="material-icons text-[16px] text-muted-foreground">public</span>
            )}
            <span className="text-sm font-medium leading-tight whitespace-nowrap">
                {metadata.title || url}
            </span>
        </a>
    );
}
