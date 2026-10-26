import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from '../config/env';

/**
 * Owns the single Supabase client. Only the publishable key is used here;
 * every table is protected by row-level security in the database.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly configured = isSupabaseConfigured();
  private instance: SupabaseClient | null = null;

  get client(): SupabaseClient {
    if (!this.configured) {
      throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
    }
    this.instance ??= createClient(env.supabaseUrl, env.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Implicit flow so a password-reset link works on a different device
        // from the one that requested it.
        detectSessionInUrl: true,
        flowType: 'implicit',
        storageKey: 'marginalia-auth',
      },
      realtime: { params: { eventsPerSecond: 10 } },
    });
    return this.instance;
  }
}
