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
        <div className="space-y-6">
            {/* Top Bar Actions */}
            <div className="flex items-center justify-between mb-2">
                <div>
                    {hasUnsavedChanges && (
                        <span className="text-xs text-muted-foreground font-mono">Saving changes...</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
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
                className="w-full text-3xl font-bold bg-transparent border-none outline-none mb-6 placeholder:text-muted-foreground/50 text-foreground"
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
                    className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30 font-medium"
                    placeholder="Composer"
                />

                <span className="text-muted-foreground">Difficulty</span>
                <div className="w-48">
                    <Select
                        value={localPiece.level || 'none'}
                        onValueChange={(val) => updateField('level', val === 'none' ? '' : val)}
                    >
                        <SelectTrigger className="h-8 border-white/10 bg-slate-900/30">
                            <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {LEVELS.map((l) => (
                                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <span className="text-muted-foreground">Status</span>
                <div className="w-48">
                    <Select
                        value={localPiece.status}
                        onValueChange={(val) => updateField('status', val as any)}
                    >
                        <SelectTrigger className="h-8 border-white/10 bg-slate-900/30">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PIECE_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <span className="text-muted-foreground">Type</span>
                <div className="w-48">
                    <Select
                        value={localPiece.type}
                        onValueChange={(val) => updateField('type', val as any)}
                    >
                        <SelectTrigger className="h-8 border-white/10 bg-slate-900/30">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PIECE_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Started</span>
                </span>
                <input
                    type="date"
                    value={localPiece.start_date || ''}
                    onChange={(e) => updateField('start_date', e.target.value)}
                    className="bg-transparent border-none outline-none text-foreground text-sm"
                />

                <span className="text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Target</span>
                </span>
                <input
                    type="date"
                    value={localPiece.target_date || ''}
                    onChange={(e) => updateField('target_date', e.target.value)}
                    className="bg-transparent border-none outline-none text-foreground text-sm"
                />

                <span className="text-muted-foreground flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    <span>Video URL</span>
                </span>
                {!localPiece.video_url ? (
                    <input
                        type="text"
                        placeholder="Add YouTube URL"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                updateField('video_url', e.currentTarget.value);
                            }
                        }}
                        className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30 text-sm"
                    />
                ) : (
                    <div className="space-y-2">
                        {extractYouTubeId(localPiece.video_url) ? (
                            <div className="w-full max-w-lg aspect-video rounded-xl overflow-hidden border border-white/5 bg-black">
                                <YouTubeEmbed url={localPiece.video_url} />
                            </div>
                        ) : (
                            <a
                                href={localPiece.video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-primary hover:underline break-all"
                            >
                                {localPiece.video_url}
                            </a>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                            <button
                                type="button"
                                onClick={() => updateField('video_url', '')}
                                className="flex items-center gap-1 text-xs text-muted-foreground border border-white/10 rounded px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
                            >
                                <span className="material-icons text-sm">link</span>
                                Replace URL
                            </button>
                            <button
                                type="button"
                                onClick={() => updateField('video_url', '')}
                                className="flex items-center gap-1 text-xs text-muted-foreground border border-white/10 rounded px-2 py-1 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            >
                                <span className="material-icons text-sm">delete</span>
                                Remove
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <hr className="border-white/10 mb-6" />

            {/* Notes Editor */}
            <RepertoireEditor
                blocks={localPiece.notes}
                onChange={updateNotes}
            />
        </div>
    );
}
