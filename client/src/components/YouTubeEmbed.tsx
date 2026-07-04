import React from 'react';

interface YouTubeEmbedProps {
    url: string;
    className?: string;
}

function extractYouTubeId(url: string): string | null {
    if (!url) return null;
    const cleanUrl = url.trim();

    // 1. Check for youtu.be/<id>
    const shortMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
    if (shortMatch) return shortMatch[1];
    
    // 2. Check for path patterns: /embed/<id>, /shorts/<id>, /live/<id>
    const pathMatch = cleanUrl.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/i);
    if (pathMatch) return pathMatch[1];
    
    // 3. Check for watch?v=<id> or watch?anything&v=<id>
    const watchMatch = cleanUrl.match(/youtube(?:-nocookie)?\.com\/watch\?(?:[^&]*&)*v=([a-zA-Z0-9_-]{11})/i);
    if (watchMatch) return watchMatch[1];

    // Fallback: search for any occurrence of v=([a-zA-Z0-9_-]{11}) in query-like strings
    const fallbackMatch = cleanUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
    if (fallbackMatch) return fallbackMatch[1];

    return null;
}


export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ url, className }) => {
    const videoId = extractYouTubeId(url);

    if (!videoId) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline text-sm"
            >
                {url}
            </a>
        );
    }

    return (
        <div className={`relative w-full aspect-video rounded-lg overflow-hidden ${className || ''}`}>
            <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
            />
        </div>
    );
};

export { extractYouTubeId };
