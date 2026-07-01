import React from 'react';

interface YouTubeEmbedProps {
    url: string;
    className?: string;
}

function extractYouTubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
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
