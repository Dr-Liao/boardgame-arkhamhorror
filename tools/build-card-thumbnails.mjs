// Build-time thumbnails for portable installs that do not ship a native encoder.
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createImageAssetCache } from '../src/integration/image-cache.js'

export async function buildCardThumbnails(modRoot) {
  await import('sharp') // Fail the build clearly if the build dependency is absent.
  const webRoot = path.join(modRoot, 'web')
  const cache = createImageAssetCache({ webRoot })
  const files = []
  async function walk(relative) {
    for (const entry of await readdir(path.join(webRoot, relative), { withFileTypes: true }).catch(error => {
      if (error.code === 'ENOENT') return []
      throw error
    })) {
      const child = relative + '/' + entry.name
      if (entry.isDirectory()) await walk(child)
      else if (/\.(avif|webp|png|jpe?g|gif)$/.test(entry.name)) files.push(child)
    }
  }
  for (const dir of ['img/cards', 'img/zh/cards', 'img/backs', 'img/zh/backs']) await walk(dir)
  const queue = [...files]
  const worker = async () => {
    while (queue.length) {
      const original = queue.shift(), extension = path.extname(original).slice(1)
      const relative = original.replace('img/', 'img/thumbs/').replace(/\.[^.]+$/, '.webp')
      if (!await cache({ relative, searchParams: new URLSearchParams({ source: extension }) })) throw new Error('Thumbnail generation failed: ' + original)
    }
  }
  await Promise.all([worker(), worker()])
  return files.length
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await buildCardThumbnails(path.resolve(process.argv[2] || fileURLToPath(new URL('..', import.meta.url))))
  console.log('Generated/reused thumbnails: ' + count)
}
