// 八循环《绯红密钥》（The Scarlet Keys）迁移工具共用库。
//
// 与 TIC/TDE/EotE 的 <cycle>-migration-lib.mjs 同一口径：
//   · 参考实现只读，逐文件锁 SHA-256；卡表四份（cards*.json）是卡号/卡文/归属的事实源；
//   · 可复算账本签入 audit/tsk-<name>.json，运行镜像写大厅根目录 artifacts/migration/tsk/；
//   · `--write` 生成，`--check` 逐字节复算（来源或归属变化即失败），无参数只打印 JSON。
//
// 注意：本 Mod 目录是独立 git 仓库，参考资源在大厅仓库根目录的 `参考资源/ArkhamHorror-main/`。
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MOD = fileURLToPath(new URL('../', import.meta.url))
export const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url))
export const REFERENCE = join(WORKSPACE, '参考资源/ArkhamHorror-main')
// 运行资料放大厅仓库根目录，不写进 Mod 的 artifacts/（见 README §2）。
export const RUN = join(WORKSPACE, 'artifacts/migration/tsk')

export const sha = value => createHash('sha256').update(value).digest('hex')
export const json = value => JSON.stringify(value, null, 2) + '\n'
export const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
export const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? walk(join(dir, entry.name)) : [join(dir, entry.name)]).sort()

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, json(data))
}

export function sourceLock(path, root = REFERENCE) {
  const bytes = readFileSync(join(root, path))
  return { path: path.replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes) }
}

// 本循环的全部参考来源：TheScarletKeys 参考实现（战役/关卡/卡牌定义与实现）、
// 中英剧情与指南、剧本身份 JSON、卡表四份。卡表用于核对卡号/卡文/encounterCode。
export function referenceFiles() {
  const arkham = join(REFERENCE, 'backend/arkham-api/library/Arkham')
  return [
    ...walk(arkham).filter(path => path.includes('TheScarletKeys')),
    ...['en', 'zh'].flatMap(lang => walk(join(REFERENCE, `frontend/src/locales/${lang}/theScarletKeys`))),
    join(REFERENCE, 'frontend/src/arkham/data/theScarletKeys.json'),
    ...['cards.json', 'cards_en.json', 'cards_zh.json', 'cards_zh-cn.json'].map(file => join(REFERENCE, 'frontend/public', file)),
  ].map(path => relative(REFERENCE, path).replaceAll('\\', '/')).sort()
}

// 可复算账本：audit/tsk-<name>.json 签入，运行镜像同步一份到 artifacts/migration/tsk/。
// 空目录不建；RUN 里的过程资料（workers/、reports/、日志、截图）不签入。
export function emit(name, report) {
  const target = join(MOD, `audit/tsk-${name}.json`)
  if (process.argv.includes('--write')) {
    writeJson(target, report)
    writeJson(join(RUN, name + '.json'), report)
    console.log(`tsk ${name}: 已写入 ${target}`)
  } else if (process.argv.includes('--check')) {
    if (!existsSync(target) || readFileSync(target, 'utf8') !== json(report)) {
      throw new Error(`${target} 漂移；审阅来源/实现变化后显式 --write`)
    }
    console.log(`tsk ${name}: 复算一致`)
  } else {
    console.log(json(report))
  }
  if (report.gates && Object.values(report.gates).some(value => value !== true)) {
    throw new Error(`tsk ${name} 门禁失败：${json(report.gates)}`)
  }
}
