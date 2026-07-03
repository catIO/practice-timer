export interface RepertoirePiece {
    id: string;
    user_id: string;
    title: string;
    composer: string;
    level: string;
    type: 'repertoire' | 'etude' | 'scale' | 'sight-reading' | 'other';
    status: 'learning' | 'maintaining' | 'performance-ready' | 'archived';
    start_date: string | null;
    target_date: string | null;
    video_url: string | null;
    score_url: string | null;
    notes: RepertoireBlock[];
    created_at: string;
    updated_at: string;
}

export interface RepertoireBlock {
    id: string;
    type: 'text' | 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'number' | 'divider' | 'todo' | 'youtube';
    text: string;
    checked?: boolean;
}

export type RepertoirePieceInsert = Omit<RepertoirePiece, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export const PIECE_TYPES = [
    { value: 'repertoire', label: 'Repertoire' },
    { value: 'etude', label: 'Etude' },
    { value: 'scale', label: 'Scale' },
    { value: 'sight-reading', label: 'Sight Reading' },
    { value: 'other', label: 'Other' },
] as const;

export const PIECE_STATUSES = [
    { value: 'learning', label: 'Learning' },
    { value: 'maintaining', label: 'Maintaining' },
    { value: 'performance-ready', label: 'Performance Ready' },
    { value: 'archived', label: 'Archived' },
] as const;

export const LEVELS = [
    { value: 'level-1', label: 'Level 1: Beginner' },
    { value: 'level-2', label: 'Level 2: Advanced Beginner' },
    { value: 'level-3', label: 'Level 3: Intermediate' },
    { value: 'level-4', label: 'Level 4: Advanced Intermediate' },
    { value: 'level-5', label: 'Level 5: Advanced' },
    { value: 'level-6', label: 'Level 6: Super Advanced' },
] as const;
