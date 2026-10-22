// Install staged Chinese card images into the local game and register their art paths.
// Source images remain in artifacts/card-translation/zh/cards/ for the CDN upload.

import { createHash } from 'node:crypto'
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const GAME = fileURLToPath(new URL('../', import.meta.url))
const STAGED = path.join(GAME, 'artifacts', 'card-translation', 'zh', 'cards')
const WEB_IMG = path.join(GAME, 'web', 'img')
const LOCAL_CARDS = path.join(WEB_IMG, 'zh', 'cards')
const INVENTORY = path.join(GAME, 'audit', 'local-images.json')
const REGISTRY = path.join(GAME, 'presentation', 'generated-localized-arts.json')
const SAFE_NAME = /^[0-9A-Za-z_-]+\.avif$/

export function installTranslatedImages() {
  const names = readdirSync(STAGED).filter(name => SAFE_NAME.test(name)).sort()
  if (!names.length) throw new Error('没有可迁入的中文卡图')
  mkdirSync(LOCAL_CARDS, { recursive: true })

  let copied = 0
  for (const name of names) {
    const target = path.join(LOCAL_CARDS, name)
    if (existsSync(target)) continue
    copyFileSync(path.join(STAGED, name), target, constants.COPYFILE_EXCL)
    copied++
  }

  const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'))
  registry.arts = [...new Set([...(registry.arts || []), ...names.map(name => `cards/${name}`)])].sort()
  writeFileSync(REGISTRY, JSON.stringify(registry, null, 1) + '\n')

  const inventory = JSON.parse(readFileSync(INVENTORY, 'utf8'))
  const before = new Set(inventory.files)
  const paths = names.map(name => `zh/cards/${name}`)
  inventory.files = [...new Set([...inventory.files, ...paths])].sort()
  const added = paths.filter(relative => !before.has(relative)).length
  inventory.total = inventory.files.length
  inventory.bytes = inventory.files.reduce((sum, relative) => sum + statSync(path.join(WEB_IMG, relative)).size, 0)
  inventory.byLanguage = {
    en: inventory.files.filter(relative => !relative.startsWith('zh/')).length,
    zh: inventory.files.filter(relative => relative.startsWith('zh/')).length,
  }
  inventory.fingerprint = createHash('sha256')
    .update(inventory.files.map(relative => `${relative}:${statSync(path.join(WEB_IMG, relative)).size}`).join('\n'))
    .digest('hex')
  writeFileSync(INVENTORY, JSON.stringify(inventory, null, 1) + '\n')
  return { staged: names.length, copied, registered: registry.arts.length, inventoryAdded: added }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href) {
  try { console.log(JSON.stringify(installTranslatedImages(), null, 2)) }
  catch (error) { console.error(String(error.message || error)); process.exitCode = 1 }
}
