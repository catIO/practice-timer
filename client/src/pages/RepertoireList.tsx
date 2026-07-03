import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { repertoireService } from '@/lib/repertoireService';
import { RepertoirePiece, PIECE_TYPES, PIECE_STATUSES, LEVELS } from '@/lib/repertoire.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Music, ArrowLeft, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';

const statusColors: Record<string, string> = {
    learning: 'bg-muted/50 text-muted-foreground border-border',
    maintaining: 'bg-muted/50 text-muted-foreground border-border',
    'performance-ready': 'bg-muted/50 text-muted-foreground border-border',
    archived: 'bg-muted/50 text-muted-foreground/50 border-border',
};

const levelColors: Record<string, string> = {
    'level-1': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'level-2': 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    'level-3': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    'level-4': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'level-5': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'level-6': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
};

const formatPieceDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString();
    } catch {
        return '';
    }
};

export default function RepertoireList() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isLoggedIn } = useAuth();

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

    const { data: pieces = [], isLoading } = useQuery({
        queryKey: ['repertoire'],
        queryFn: repertoireService.getAll,
        enabled: isLoggedIn,
    });

    const createMutation = useMutation({
        mutationFn: () =>
            repertoireService.create({
                title: 'Untitled Piece',
                composer: '',
                level: '',
                type: 'repertoire',
                status: 'learning',
                start_date: new Date().toISOString().split('T')[0],
                target_date: null,
                video_url: null,
                notes: [],
            }),
        onSuccess: (piece) => {
            queryClient.invalidateQueries({ queryKey: ['repertoire'] });
            navigate(`/repertoire/${piece.id}`);
        },
    });

    const filtered = pieces.filter((p: RepertoirePiece) => {
        const matchesSearch =
            !search ||
            p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.composer.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
        const matchesType = typeFilter === 'all' || p.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
    });

    if (!isLoggedIn) {
        return (
            <div className="text-center py-10 max-w-md mx-auto space-y-6 animate-in fade-in duration-300">
                <div className="flex justify-center">
                    <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                        <span className="material-icons text-3xl">library_music</span>
                    </div>
                </div>
                <div>
                    <h2 className="text-xl font-bold mb-2">Track Your Repertoire</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Create piece profiles, define practice sections, log detailed notes, and view study statistics to perfect your performance.
                    </p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                    <Button 
                        onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}
                        className="w-full h-10 rounded-xl"
                    >
                        Create Free Account
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={() => { setAuthMode('signin'); setAuthOpen(true); }}
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

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {pieces.length} piece{pieces.length !== 1 ? 's' : ''} total
                </p>
                <Button 
                    onClick={() => createMutation.mutate()} 
                    disabled={createMutation.isPending}
                    className="h-9 rounded-xl"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Piece
                </Button>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search pieces..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px]">
                            <Filter className="h-3 w-3 mr-1" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            {PIECE_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {PIECE_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground text-sm">
                        {pieces.length === 0 ? 'No pieces yet. Add your first piece to get started.' : 'No pieces match your filters.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((piece: RepertoirePiece) => (
                        <button
                            key={piece.id}
                            onClick={() => navigate(`/repertoire/${piece.id}`)}
                            className={cn(
                                'w-full text-left p-4 rounded-xl border border-primary/20',
                                'bg-primary/5 hover:bg-primary/10 hover:border-primary/40 transition-all',
                                'flex items-center gap-4'
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold truncate text-foreground">{piece.title}</h3>
                                    {piece.level && (
                                        <Badge variant="outline" className={cn('text-xs shrink-0 rounded-full', levelColors[piece.level])}>
                                            {LEVELS.find(l => l.value === piece.level)?.label ?? piece.level}
                                        </Badge>
                                    )}
                                </div>
                                {piece.composer && (
                                    <p className="text-sm text-muted-foreground truncate">{piece.composer}</p>
                                )}
                                {formatPieceDate(piece.start_date) && (
                                    <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
                                        Started {formatPieceDate(piece.start_date)}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <Badge variant="outline" className={cn('text-xs rounded-full', statusColors[piece.status])}>
                                    {PIECE_STATUSES.find(s => s.value === piece.status)?.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground font-medium">
                                    {PIECE_TYPES.find(t => t.value === piece.type)?.label}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
