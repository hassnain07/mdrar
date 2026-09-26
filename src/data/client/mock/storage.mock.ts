/**
 * Mock storage — stores blobs in an in-memory Map and returns blob: URLs.
 * No base64 in app state. Components consume { url, path } exactly like
 * they will from Supabase Storage.
 */
import { simulate } from './latency';

const store = new Map<string, string>(); // path → blob URL

export const storageMock = {
  async upload(_bucket: string, path: string, file: File): Promise<{ url: string; path: string }> {
    await simulate();
    // Revoke old URL if replacing
    const old = store.get(path);
    if (old) URL.revokeObjectURL(old);
    const url = URL.createObjectURL(file);
    store.set(path, url);
    return { url, path };
  },

  async remove(_bucket: string, path: string): Promise<void> {
    await simulate();
    const url = store.get(path);
    if (url) URL.revokeObjectURL(url);
    store.delete(path);
  },
};
