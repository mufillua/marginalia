import { generatedEnv } from './env.generated';

export interface AppEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
  googleBooksApiKey: string;
  enableGoogleSignIn: boolean;
}

export const env: AppEnv = generatedEnv;

export const isSupabaseConfigured = (): boolean =>
  /^https:\/\/.+/.test(env.supabaseUrl) && env.supabasePublishableKey.length > 20;
