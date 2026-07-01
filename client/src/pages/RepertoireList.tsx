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

export default function RepertoireList() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    const { data: pieces = [], isLoading } = useQuery({
        queryKey: ['repertoire'],
        queryFn: repertoireService.getAll,
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

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="max-w-3xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">Repertoire</h1>
                            <p className="text-sm text-muted-foreground">
                                {pieces.length} piece{pieces.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Piece
                    </Button>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
                        <p className="text-muted-foreground">
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
                                    'w-full text-left p-4 rounded-lg border border-border/50',
                                    'bg-card hover:bg-accent/50 transition-colors',
                                    'flex items-center gap-4'
                                )}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-medium truncate">{piece.title}</h3>
                                        {piece.level && (
                                            <Badge variant="outline" className={cn('text-xs shrink-0', levelColors[piece.level])}>
                                                {LEVELS.find(l => l.value === piece.level)?.label ?? piece.level}
                                            </Badge>
                                        )}
                                    </div>
                                    {piece.composer && (
                                        <p className="text-sm text-muted-foreground truncate">{piece.composer}</p>
                                    )}
                                    {piece.start_date && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Started {new Date(piece.start_date).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <Badge variant="outline" className={cn('text-xs', statusColors[piece.status])}>
                                        {PIECE_STATUSES.find(s => s.value === piece.status)?.label}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {PIECE_TYPES.find(t => t.value === piece.type)?.label}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
