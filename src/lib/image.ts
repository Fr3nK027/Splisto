/** Ridimensiona in locale (lato lungo max `max` px) e ricodifica in JPEG. Rispetta l'orientamento EXIF. */
export async function resizeImage(file: Blob, max = 1600, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale))
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return canvas.convertToBlob({ type: 'image/jpeg', quality })
}
