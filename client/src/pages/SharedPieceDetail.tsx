import { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { decodeReportToken, type ReportSnapshot } from '@/lib/reportShare';
import { supabase } from '@/lib/supabaseClient';
import { RepertoirePiece, RepertoireBlock, LEVELS, PIECE_STATUSES, PIECE_TYPES } from '@/lib/repertoire.types';
import { YouTubeEmbed, extractYouTubeId } from '@/components/YouTubeEmbed';
import { TextWithLinks } from '@/components/TextWithLinks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Calendar, FileText, Video, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSharedReport } from '@/contexts/SharedReportContext';
import { ScoreUrlTooltip } from '@/components/ScoreUrlTooltip';

function ReadOnlyRepertoireNotes({ blocks }: { blocks: RepertoireBlock[] }) {
    if (!blocks || blocks.length === 0) {
        return <p className="text-muted-foreground/50 text-sm italic pl-8">No notes added.</p>;
    }

    return (
        <div className="pl-8 space-y-4">
            {blocks.map((block) => {
                const text = block.text || "";
                switch (block.type) {
                    case "heading1":
                        return <h2 key={block.id} className="text-2xl font-bold py-1 mt-4 text-foreground"><TextWithLinks text={text} /></h2>;
                    case "heading2":
                        return <h3 key={block.id} className="text-xl font-semibold py-0.5 mt-3 text-foreground"><TextWithLinks text={text} /></h3>;
                    case "divider":
                        return <div key={block.id} className="flex items-center py-3"><hr className="flex-1 border-border/50" /></div>;
                    case "youtube": {
                        const ytId = extractYouTubeId(text);
                        if (ytId) {
                            return (
                                <div key={block.id} className="-ml-8 my-2 max-w-2xl aspect-video rounded-xl overflow-hidden border border-white/5 bg-black">
                                    <iframe
                                        src={`https://www.youtube-nocookie.com/embed/${ytId}?rel=0`}
                                        title="YouTube video"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="w-full h-full border-0"
                                    />
                                </div>
                            );
                        }
                        // Fallback: render as a link if it looks like a URL, or plain text if not
                        const isUrl = text.startsWith('http://') || text.startsWith('https://');
                        return (
                            <div key={block.id} className="text-sm text-foreground my-2">
                                {isUrl ? (
                                    <a
                                        href={text}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline break-all inline-flex items-center gap-1 font-medium"
                                    >
                                        <span>{text}</span>
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                ) : (
                                    <TextWithLinks text={text} />
                                )}
                            </div>
                        );
                    }
                    case "todo":
                        return (
                            <div key={block.id} className="flex items-start gap-2 py-0.5">
                                <Checkbox checked={block.checked} disabled className="mt-1 shrink-0" />
                                <span className={cn("text-sm text-foreground", block.checked && "line-through text-muted-foreground")}>
                                    <TextWithLinks text={text} />
                                </span>
                            </div>
                        );
                    case "bullet":
                        return (
                            <div key={block.id} className="flex items-start gap-2 py-0.5">
                                <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
                                <span className="text-sm text-foreground">
                                    <TextWithLinks text={text} />
                                </span>
                            </div>
                        );
                    case "number":
                        return (
                            <div key={block.id} className="flex items-start gap-2 py-0.5">
                                <span className="text-sm text-muted-foreground tabular-nums select-none pr-1">
                                    •
                                </span>
                                <span className="text-sm text-foreground">
                                    <TextWithLinks text={text} />
                                </span>
                            </div>
                        );
                    default:
                        return (
                            <div key={block.id} className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                <TextWithLinks text={text} />
                            </div>
                        );
                }
            })}
        </div>
    );
}

export default function SharedPieceDetail() {
    const { setCreatorName } = useSharedReport();
    const { id, token: pathToken, pieceId } = useParams<{ id?: string; token?: string; pieceId: string }>();
    const location = useLocation();

    // Extract token from path or hash (dev mode)
    const token = pathToken ?? (location.pathname.includes("/report") && location.hash ? location.hash.slice(1) : null);

    const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Apply meta robots tag to prevent indexing
    useEffect(() => {
        let meta = document.querySelector('meta[name="robots"]');
        if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute("name", "robots");
            document.head.appendChild(meta);
        }
        meta.setAttribute("content", "noindex, nofollow");
        return () => {
            meta?.setAttribute("content", "");
        };
    }, []);

    useEffect(() => {
        if (snapshot) {
            setCreatorName(snapshot.creatorName || null);
        }
        return () => {
            setCreatorName(null);
        };
    }, [snapshot, setCreatorName]);

    // Load snapshot based on id or token
    useEffect(() => {
        if (id) {
            setLoading(true);
            setError(false);

            const fetchSnapshot = async () => {
                // 1. Try Supabase first
                if (supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('shared_reports')
                            .select('data')
                            .eq('id', id)
                            .single();
                        if (data && !error) {
                            setSnapshot(data.data as ReportSnapshot);
                            setLoading(false);
                            return;
                        }
                    } catch (e) {
                        console.warn("[SharedPieceDetail] Failed to load from Supabase, trying fallback:", e);
                    }
                }

                // In dev, stop here if Supabase failed, since Netlify function is unavailable
                if (import.meta.env.DEV) {
                    setError(true);
                    setLoading(false);
                    return;
                }

                // 2. Fallback to Netlify function
                try {
                    const res = await fetch(`/.netlify/functions/share-report?id=${encodeURIComponent(id!)}`, {
                        cache: "no-store",
                        headers: { Accept: "application/json" },
                    });
                    if (!res.ok) throw new Error("Failed to fetch from Netlify function");
                    const data = await res.json();
                    setSnapshot(data as ReportSnapshot);
                } catch (err) {
                    console.warn("[SharedPieceDetail] Fallback fetch failed:", err);
                    setError(true);
                } finally {
                    setLoading(false);
                }
            }

            fetchSnapshot();
        } else if (token) {
            setLoading(true);
            setError(false);
            const data = decodeReportToken(token);
            if (data) {
                setSnapshot(data);
            } else {
                setError(true);
            }
            setLoading(false);
        } else {
            setError(true);
            setLoading(false);
        }
    }, [id, token]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    const piece = snapshot?.embeddedPieces?.[pieceId || ''];

    if (error || !snapshot || !piece) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-foreground text-center">
                <h1 className="text-2xl font-bold text-primary mb-2">Piece Not Found</h1>
                <p className="text-muted-foreground text-sm max-w-sm mb-6 leading-relaxed">
                    This shared piece details link is invalid, expired, or the piece was not embedded.
                </p>
                <Button variant="outline" asChild className="border-white/10 rounded-xl">
                    <Link to="/">Open Practice Mate</Link>
                </Button>
            </div>
        );
    }

    const backLink = id
        ? `/r/${id}`
        : (pathToken
            ? `/report/${pathToken}`
            : `/report#${token}`);

    const levelObj = LEVELS.find(l => l.value === piece.level);
    const levelLabel = levelObj ? levelObj.label : (piece.level || 'None');

    const statusObj = PIECE_STATUSES.find(s => s.value === piece.status);
    const statusLabel = statusObj ? statusObj.label : piece.status;

    const typeObj = PIECE_TYPES.find(t => t.value === piece.type);
    const typeLabel = typeObj ? typeObj.label : piece.type;

    return (
        <div className="space-y-6 text-foreground max-w-3xl mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <Button variant="ghost" asChild className="hover:bg-white/5 -ml-2 text-muted-foreground hover:text-foreground w-fit">
                    <Link to={backLink}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Plan
                    </Link>
                </Button>
            </div>

            <div>
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                    {piece.title || 'Untitled Piece'}
                </h1>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-4 mb-8 text-sm border-t border-white/5 pt-6">
                <span className="text-muted-foreground font-medium">Composer</span>
                <span className="text-foreground font-semibold">{piece.composer || 'Unknown'}</span>

                <span className="text-muted-foreground font-medium">Difficulty</span>
                <div>
                    <Badge variant="outline" className="bg-slate-900/30 border-white/10 text-muted-foreground">
                        {levelLabel}
                    </Badge>
                </div>

                <span className="text-muted-foreground font-medium">Status</span>
                <div>
                    <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary capitalize">
                        {statusLabel}
                    </Badge>
                </div>

                <span className="text-muted-foreground font-medium">Type</span>
                <span className="text-foreground capitalize font-medium">{typeLabel}</span>

                {piece.start_date && (
                    <>
                        <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Started</span>
                        </span>
                        <span className="text-foreground">{new Date(piece.start_date).toLocaleDateString()}</span>
                    </>
                )}

                {piece.target_date && (
                    <>
                        <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Target</span>
                        </span>
                        <span className="text-foreground">{new Date(piece.target_date).toLocaleDateString()}</span>
                    </>
                )}

                {piece.video_url && (
                    <>
                        <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                            <Video className="h-4 w-4 text-muted-foreground" />
                            <span>Video URL</span>
                        </span>
                        <div className="space-y-2">
                            {extractYouTubeId(piece.video_url) ? (
                                <div className="w-full max-w-2xl aspect-video rounded-xl overflow-hidden border border-white/5 bg-black">
                                    <YouTubeEmbed url={piece.video_url} />
                                </div>
                            ) : (
                                <a
                                    href={piece.video_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-primary hover:underline break-all inline-flex items-center gap-1 font-medium"
                                >
                                    <span>{piece.video_url}</span>
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            )}
                        </div>
                    </>
                )}

                {piece.score_url && (
                    <>
                        <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>Score URL</span>
                        </span>
                        <div>
                            <ScoreUrlTooltip url={piece.score_url}>
                                <a
                                    href={piece.score_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm text-primary hover:underline break-all inline-flex items-center gap-1 font-medium bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg transition-colors hover:bg-primary/20"
                                >
                                    <span>Open Score</span>
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </ScoreUrlTooltip>
                        </div>
                    </>
                )}
            </div>

            <hr className="border-white/5 my-6" />

            {/* Notes Section */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <span className="material-icons text-muted-foreground">notes</span>
                    Notes & Practice Log
                </h3>
                <ReadOnlyRepertoireNotes blocks={piece.notes} />
            </div>
        </div>
    );
}
