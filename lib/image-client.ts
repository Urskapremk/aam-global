// Client-side image helpers. Shrinking happens in the browser (canvas) so we
// never push a 3–5 MB phone photo over Madagascar mobile data — the receipt
// only needs to be legible, not full resolution.

// Draw the picked file onto a canvas, capped at `max` px on the longest edge,
// and return a JPEG data URL. Same approach the catch-photo flow uses.
export function shrinkImageToDataUrl(file: File, max = 1600, quality = 0.8) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image()
    // No crossOrigin: the source is a local object URL from the picked file,
    // and setting it can make some engines refuse to decode.
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no canvas'))
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('bad image'))
    img.src = URL.createObjectURL(file)
  })
}

// Turn a JPEG data URL back into a File so it can ride in FormData to the
// server-side `uploadImage` action.
export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, body] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name, { type: mime })
}
