import { supabase } from './supabaseClient';
import type { RepertoirePiece, RepertoirePieceInsert } from './repertoire.types';

export const repertoireService = {
    async getAll(): Promise<RepertoirePiece[]> {
        const { data, error } = await supabase
            .from('repertoire')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async getById(id: string): Promise<RepertoirePiece | null> {
        const { data, error } = await supabase
            .from('repertoire')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // not found
            throw error;
        }
        return data;
    },

    async create(piece: RepertoirePieceInsert): Promise<RepertoirePiece> {
        const { data, error } = await supabase
            .from('repertoire')
            .insert(piece)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async update(id: string, updates: Partial<RepertoirePieceInsert>): Promise<RepertoirePiece> {
        const { data, error } = await supabase
            .from('repertoire')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('repertoire')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },
};
