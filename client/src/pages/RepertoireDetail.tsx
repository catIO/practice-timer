import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repertoireService } from '@/lib/repertoireService';
import {
    RepertoirePiece,
    RepertoireBlock,
    PIECE_TYPES,
    PIECE_STATUSES,
    LEVELS,
} from '@/lib/repertoire.types';
import { YouTubeEmbed, extractYouTubeId } from '@/components/YouTubeEmbed';
import { RepertoireEditor } from '@/components/RepertoireEditor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    ArrowLeft,
    Trash2,
    Copy,
    MoreVertical,
    Calendar,
    Video,
} from 'lucide-react';

export default function RepertoireDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const { data: piece, isLoading } = useQuery({
        queryKey: ['repertoire', id],
        queryFn: () => repertoireService.getById(id!),
        enabled: !!id,
    });

    const [localPiece, setLocalPiece] = useState<RepertoirePiece | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    useEffect(() => {
        if (piece && !localPiece) {
            setLocalPiece(piece);
        }
    }, [piece, localPiece]);

    const updateMutation = useMutation({
        mutationFn: (updates: Partial<RepertoirePiece>) =>
            repertoireService.update(id!, updates),
        onSuccess: (updated) => {
            queryClient.setQueryData(['repertoire', id], updated);
            queryClient.invalidateQueries({ queryKey: ['repertoire'] });
            setHasUnsavedChanges(false);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => repertoireService.delete(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['repertoire'] });
            navigate('/repertoire');
        },
    });

    const cloneMutation = useMutation({
        mutationFn: () =>
            repertoireService.create({
                title: `${localPiece!.title} (copy)`,
                composer: localPiece!.composer,
                level: localPiece!.level,
                type: localPiece!.type,
                status: localPiece!.status,
                start_date: localPiece!.start_date,
                target_date: localPiece!.target_date,
                video_url: localPiece!.video_url,
                notes: localPiece!.notes,
            }),
        onSuccess: (cloned) => {
            queryClient.invalidateQueries({ queryKey: ['repertoire'] });
            navigate(`/repertoire/${cloned.id}`);
        },
    });

    const debouncedSave = useCallback(
        (updates: Partial<RepertoirePiece>) => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                updateMutation.mutate(updates);
            }, 1000);
        },
        [updateMutation]
    );

    const updateField = useCallback(
        <K extends keyof RepertoirePiece>(field: K, value: RepertoirePiece[K]) => {
            setLocalPiece((prev) => {
                if (!prev) return prev;
                setHasUnsavedChanges(true);
                debouncedSave({ [field]: value });
                return { ...prev, [field]: value };
            });
        },
        [debouncedSave]
    );

    const updateNotes = useCallback(
        (newBlocks: RepertoireBlock[]) => {
            updateField('notes', newBlocks);
        },
        [updateField]
    );

    if (isLoading || !localPiece) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="max-w-3xl mx-auto px-4 py-6">
                {/* Top Bar */}
                <div className="flex items-center justify-between mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/repertoire')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        {hasUnsavedChanges && (
                            <span className="text-xs text-muted-foreground">Saving...</span>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={() => cloneMutation.mutate()}
                                    disabled={cloneMutation.isPending}
                                >
                                    <Copy className="h-4 w-4 mr-2" />
                                    Clone piece
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => setShowDeleteDialog(true)}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete piece
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this piece?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete "{localPiece.title}" and all its notes. This cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={() => deleteMutation.mutate()}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                {/* Title */}
                <input
                    type="text"
                    value={localPiece.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full text-3xl font-bold bg-transparent border-none outline-none mb-6 placeholder:text-muted-foreground/50"
                    placeholder="Piece title"
                />

                {/* Metadata Grid */}
                <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 mb-8 text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                        <span>By</span>
                    </span>
                    <input
                        type="text"
                        value={localPiece.composer}
                        onChange={(e) => updateField('composer', e.target.value)}
                        className="bg-transparent border-none outline-none font-medium placeholder:text-muted-foreground/50"
                        placeholder="Composer name"
                    />

                    {localPiece.video_url && (
                        <>
                            <span className="text-muted-foreground flex items-center gap-2">
                                <Video className="h-3.5 w-3.5" />
                                <span>Video</span>
                            </span>
                            <input
                                type="url"
                                value={localPiece.video_url || ''}
                                onChange={(e) => updateField('video_url', e.target.value || null)}
                                className="bg-transparent border-none outline-none text-blue-400 placeholder:text-muted-foreground/50 truncate"
                                placeholder="YouTube URL"
                            />
                        </>
                    )}

                    <span className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Updated</span>
                    </span>
                    <span className="text-foreground">
                        {new Date(localPiece.updated_at).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                        })}
                    </span>

                    <span className="text-muted-foreground">Level</span>
                    <Select value={localPiece.level || 'none'} onValueChange={(v) => updateField('level', v === 'none' ? '' : v)}>
                        <SelectTrigger className="h-8 w-fit border-none bg-transparent px-0 hover:bg-accent/50">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {LEVELS.map((l) => (
                                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <span className="text-muted-foreground">Type</span>
                    <Select value={localPiece.type} onValueChange={(v) => updateField('type', v as RepertoirePiece['type'])}>
                        <SelectTrigger className="h-8 w-fit border-none bg-transparent px-0 hover:bg-accent/50">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PIECE_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <span className="text-muted-foreground">Status</span>
                    <Select value={localPiece.status} onValueChange={(v) => updateField('status', v as RepertoirePiece['status'])}>
                        <SelectTrigger className="h-8 w-fit border-none bg-transparent px-0 hover:bg-accent/50">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PIECE_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <span className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Start Date</span>
                    </span>
                    <input
                        type="date"
                        value={localPiece.start_date || ''}
                        onChange={(e) => updateField('start_date', e.target.value || null)}
                        className="bg-transparent border-none outline-none text-foreground"
                    />

                    {!localPiece.video_url && (
                        <>
                            <span className="text-muted-foreground flex items-center gap-2">
                                <Video className="h-3.5 w-3.5" />
                                <span>Video</span>
                            </span>
                            <input
                                type="url"
                                value=""
                                onChange={(e) => updateField('video_url', e.target.value || null)}
                                className="bg-transparent border-none outline-none text-blue-400 placeholder:text-muted-foreground/50"
                                placeholder="Add YouTube URL..."
                            />
                        </>
                    )}
                </div>

                {/* Main Video Embed */}
                {localPiece.video_url && extractYouTubeId(localPiece.video_url) && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold mb-3">Progress</h2>
                        <div className="relative w-full rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                            <iframe
                                src={`https://www.youtube-nocookie.com/embed/${extractYouTubeId(localPiece.video_url)}`}
                                title="YouTube video"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="absolute inset-0 w-full h-full"
                            />
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <button
                                type="button"
                                onClick={() => updateField('video_url', '')}
                                className="flex items-center gap-1 text-xs text-muted-foreground border border-border/50 rounded px-2 py-1 hover:bg-muted hover:text-foreground transition-colors"
                            >
                                <span className="material-icons text-sm">link</span>
                                Replace URL
                            </button>
                            <button
                                type="button"
                                onClick={() => updateField('video_url', '')}
                                className="flex items-center gap-1 text-xs text-muted-foreground border border-border/50 rounded px-2 py-1 hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                                <span className="material-icons text-sm">delete</span>
                                Remove
                            </button>
                        </div>
                    </div>
                )}

                <hr className="border-border/50 mb-6" />

                {/* Notes Editor */}
                <RepertoireEditor
                    blocks={localPiece.notes}
                    onChange={updateNotes}
                />
            </div>
        </div>
    );
}
