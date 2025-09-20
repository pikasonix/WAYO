/**
 * Temporary Supabase stub
 *
 * Purpose: Provide a minimal, safe runtime replacement for the real Supabase
 * client so the app can run with Supabase disabled. This file intentionally
 * returns no-op responses that match the shape the app expects.
 *
 * To re-enable Supabase later, replace this file with a real client that
 * imports `createClient` from `@supabase/supabase-js` and exports the client.
 */

// Detect an explicit flag if desired (not used by default). If you want to
// gate behavior at runtime, set NEXT_PUBLIC_DISABLE_SUPABASE to 'false' and
// swap this file with a real client.
const DISABLED = process.env.NEXT_PUBLIC_DISABLE_SUPABASE !== 'false' &&
    process.env.DISABLE_SUPABASE !== 'false';

// Minimal no-op implementations that match the supabase-js return shapes used
// across the codebase. All functions return objects like { data, error } or
// { error } so callers can continue to handle responses normally.
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
    from: (/* bucketName: string */) => ({
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

// Exported stub client
export const supabase = DISABLED
    ? { auth, storage, from }
    : // If someone flips the flag, still return stub (real client not configured here)
    { auth, storage, from };

export default supabase;
