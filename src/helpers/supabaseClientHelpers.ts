import { createClient } from '@supabase/supabase-js';

export const createSupabaseClient = () => {
    let supabaseUrl = process.env.SUPABASE_URL;
    let supabaseKey = process.env.SUPABASE_KEY;

    return createClient(supabaseUrl!, supabaseKey!);
};