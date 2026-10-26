import { generatedEnv } from './env.generated';

export interface AppEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
  googleBooksApiKey: string;
  enableGoogleSignIn: boolean;
  /** Production address, e.g. https://marginaliashelf.vercel.app */
  siteUrl: string;
}

export const env: AppEnv = generatedEnv;

export const isSupabaseConfigured = (): boolean =>
  /^https:\/\/.+/.test(env.supabaseUrl) && env.supabasePublishableKey.length > 20;
