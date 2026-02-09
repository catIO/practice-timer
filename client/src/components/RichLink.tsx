import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface RichLinkProps {
    url: string;
}

interface Metadata {
    title?: string;
    description?: string;
    image?: string;
    icon?: string;
    url: string;
}

async function fetchMetadata(url: string): Promise<Metadata> {
    const res = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("Failed to fetch metadata");
    return res.json();
}

export function RichLink({ url }: RichLinkProps) {
    const { data: metadata, isLoading, isError } = useQuery({
        queryKey: ['metadata', url],
        queryFn: () => fetchMetadata(url),
        staleTime: Infinity, // Cache forever (or for a very long time)
        retry: 1,
    });

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
