export const MAX_BILLS = 3;
const MAX_CHARS = 350_000; // base64 chars per bill; Firestore docs are capped at ~1 MiB

/** Shrink a photo to a JPEG data URL small enough to store in Firestore. */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`);
  const bmp = await createImageBitmap(file);
  let dim = 1280;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, dim / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    for (const q of [0.7, 0.55, 0.4]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length <= MAX_CHARS) { bmp.close(); return url; }
    }
    dim = Math.round(dim * 0.75);
  }
  bmp.close();
  throw new Error('Could not shrink that image enough. Try a smaller photo.');
}
