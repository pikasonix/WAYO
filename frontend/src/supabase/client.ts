import { createClient } from "@supabase/supabase-js";

/**
 * Initialize the Supabase client with environment variables
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * Supabase client instance for use throughout the application
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);