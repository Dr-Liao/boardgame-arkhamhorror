// Encode delivery copies without changing the generated PNG originals, dimensions or alpha silhouette.
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage()
  for (const name of ['desk', 'casefile', 'manor']) {
    const source = new URL(`../web/img/ui/hub-${name}.png`, import.meta.url)
    const bytes = readFileSync(source)
    const encoded = await page.evaluate(async data => {
      const img = new Image(); img.src = data; await img.decode()
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      return canvas.toDataURL('image/webp', .94).split(',')[1]
    }, `data:image/png;base64,${bytes.toString('base64')}`)
    const result = Buffer.from(encoded, 'base64')
    writeFileSync(new URL(`../web/img/ui/hub-${name}.webp`, import.meta.url), result)
    console.log(`${name}: ${bytes.length} → ${result.length} bytes`)
  }
} finally { await browser.close() }
