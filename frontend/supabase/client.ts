/**
 * Project-root Supabase stub (same as src/supabase/client.ts)
 * Keeps existing import paths working while Supabase is disabled.
 */

const DISABLED = process.env.NEXT_PUBLIC_DISABLE_SUPABASE !== 'false' &&
    process.env.DISABLE_SUPABASE !== 'false';

const auth = {
    signInWithPassword: async (_: { email: string; password: string }) => ({
        data: { user: null, session: null },
        error: null,
    }),
    signUp: async (_: { email: string; password: string }) => ({
        data: { user: null, session: null },
        error: null,
    }),
    resetPasswordForEmail: async (_email: string, _opts?: any) => ({
        error: null,
    }),
    signOut: async () => ({ error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithOAuth: async (_opts: any) => ({ error: null }),
    updateUser: async (_opts: any) => ({ data: null, error: null }),
};

const storage = {
    from: () => ({
        upload: async (_path: string, _file: any, _opts?: any) => ({ error: null }),
        getPublicUrl: (_path: string) => ({ data: { publicUrl: "" }, error: null }),
    }),
};

function makeQueryChain() {
    const chain: any = {
        select: (_sel?: string) => chain,
        eq: (_col: string, _val: any) => chain,
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        upsert: (_payload: any, _opts?: any) => ({
            select: () => ({ single: async () => ({ data: null, error: null }) }),
        }),
    };
    return chain;
}

const from = (_table: string) => makeQueryChain();

export const supabase = DISABLED
    ? { auth, storage, from }
    : { auth, storage, from };

export default supabase;
