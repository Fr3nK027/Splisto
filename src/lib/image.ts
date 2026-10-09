/**
 * Ridimensiona in locale (lato lungo max `max` px) e ricodifica in JPEG. Rispetta l'orientamento EXIF.
 * Il ridimensionamento lo fa il browser con il filtro di qualità alta: disegnare la foto grande su un canvas più
 * piccolo (filtro predefinito) la rendeva sgranata. 2048 px e qualità 0,92: i siti ricomprimono comunque, e partire
 * da una foto già povera la peggiora due volte. La ricodifica toglie anche i dati EXIF (es. posizione GPS).
 */
export async function resizeImage(file: Blob, max = 2048, quality = 0.92): Promise<Blob> {
  const full = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(full.width, full.height))
  const width = Math.round(full.width * scale)
  const height = Math.round(full.height * scale)
  const bmp = scale < 1 ? await createImageBitmap(file, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' }) : full
  if (bmp !== full) full.close()
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // PNG trasparenti: fondo bianco invece di nero nel JPEG
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bmp, 0, 0)
  bmp.close()
  return canvas.convertToBlob({ type: 'image/jpeg', quality })
}
