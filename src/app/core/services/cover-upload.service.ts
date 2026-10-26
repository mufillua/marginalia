import { inject, Injectable } from '@angular/core';
import { AppError, toAppError } from './app-error';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { ConnectivityService } from './connectivity.service';

const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_WIDTH = 900;

/**
 * Uploads a cover photo to the "covers" storage bucket under the reader's
 * own folder. Images are resized in the browser first to keep them light.
 */
@Injectable({ providedIn: 'root' })
export class CoverUploadService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly connectivity = inject(ConnectivityService);

  async upload(file: File): Promise<string> {
    const userId = this.auth.userId();
    if (!userId) throw new AppError('auth', 'Sign in again to upload a cover.');
    if (!this.connectivity.online()) throw new AppError('offline', "You're offline. Connect to upload a cover.");
    if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.type)) {
      throw new AppError('validation', 'Choose a JPEG, PNG or WebP image.');
    }
    if (file.size > MAX_SOURCE_BYTES) throw new AppError('validation', 'That image is larger than 15 MB. Choose a smaller one.');

    const blob = await resize(file);
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const storage = this.supabase.client.storage.from('covers');
    const { error } = await storage.upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
    if (error) throw toAppError(error, 'upload the cover');
    return storage.getPublicUrl(path).data.publicUrl;
  }
}

async function resize(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AppError('validation', "We couldn't read that image. Try a JPEG or PNG.");
  }
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AppError('unknown', "We couldn't prepare that image.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new AppError('unknown', "We couldn't prepare that image."))), 'image/jpeg', 0.86),
  );
}
