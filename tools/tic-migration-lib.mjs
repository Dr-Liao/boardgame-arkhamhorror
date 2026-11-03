import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MOD = fileURLToPath(new URL('../', import.meta.url))
export const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
export const REFERENCE = join(WORKSPACE, '参考资源/ArkhamHorror-main')
export const RUN = join(WORKSPACE, 'artifacts/migration/tic')
export const sha = value => createHash('sha256').update(value).digest('hex')
export const json = value => JSON.stringify(value, null, 2) + '\n'
export const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
export const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? walk(join(dir, entry.name)) : [join(dir, entry.name)]).sort()
export function writeJson(path, data) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, json(data)) }
export function sourceLock(path, root = REFERENCE) {
  const bytes = readFileSync(join(root, path))
  return { path: path.replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes) }
}
export function referenceFiles() {
  const arkham = join(REFERENCE, 'backend/arkham-api/library/Arkham')
  return [...walk(arkham).filter(path => path.includes('TheInnsmouthConspiracy') || /[\\/](ChaosToken|Key|FloodLevel)\.hs$/.test(path)),
    ...['en', 'zh'].flatMap(lang => walk(join(REFERENCE, `frontend/src/locales/${lang}/theInnsmouthConspiracy`))),
    join(REFERENCE, 'frontend/src/arkham/data/theInnsmouthConspiracy.json'),
    ...['cards.json', 'cards_en.json', 'cards_zh.json', 'cards_zh-cn.json'].map(file => join(REFERENCE, 'frontend/public', file)),
  ].map(path => relative(REFERENCE, path).replaceAll('\\', '/')).sort()
}
// Tracked audit snapshots are sufficient for clean-checkout checks. Runtime logs stay outside the Mod.
export function emit(name, report) {
  const target = join(MOD, `audit/tic-${name}.json`)
  if (process.argv.includes('--write')) {
    writeJson(target, report); writeJson(join(RUN, name + '.json'), report)
    console.log(`tic ${name}: 已写入 ${target}`)
  } else if (process.argv.includes('--check')) {
    if (!existsSync(target) || readFileSync(target, 'utf8') !== json(report)) throw new Error(`${target} 漂移；审阅来源/实现变化后显式 --write`)
    console.log(`tic ${name}: 复算一致`)
  } else console.log(json(report))
  if (report.gates && Object.values(report.gates).some(value => value !== true)) throw new Error(`tic ${name} 门禁失败：${json(report.gates)}`)
}
