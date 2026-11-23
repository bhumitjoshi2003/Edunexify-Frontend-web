import { Injectable } from '@angular/core';

/**
 * Device storage for optional onboarding state (getting-started guides). Website: localStorage,
 * with an in-memory fallback when storage is blocked (private windows), so a guide still works for
 * the current visit. The Android copy uses Capacitor Preferences — the API is the same.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingStoreService {
  private readonly memory = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    try {
      const value = localStorage.getItem(key);
      return value ?? this.memory.get(key) ?? null;
    } catch {
      return this.memory.get(key) ?? null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    this.memory.set(key, value);
    try { localStorage.setItem(key, value); } catch { /* storage blocked: the in-memory copy still works */ }
  }
}
