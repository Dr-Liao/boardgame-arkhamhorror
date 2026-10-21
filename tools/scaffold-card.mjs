// Phase 5 · 测试骨架生成器：把「迁完一张卡要写测试」从 30 分钟降到 5 分钟。
//
// 用法（在 games/arkhamhorror/ 下）：
//   node tools/scaffold-card.mjs 01089           生成 develop/scaffolds/01089.test.mjs
//   node tools/scaffold-card.mjs --batch 5b-1    为整个批次生成骨架
//   node tools/scaffold-card.mjs 01089 --entry   生成 src/cards/entries/01089.js 并重建索引
//   node tools/scaffold-card.mjs 01089 --entry --no-index
//                                               只写单卡文件、不动索引（批量 worker 用；主进程合并后统一重建）
//   node tools/scaffold-card.mjs 01089 --force   覆盖已存在的测试骨架（行为文件永不覆盖）
//   node --test develop/scaffolds/01089.test.mjs 直接跑（骨架默认是绿的）
//
// 骨架内容固定三段：
//   1. 通道断言：旧 DSL 条目已删除、能力层有条目；
//   2. 读点断言：lifecycle 读点/abilitySummary 返回迁移时声明的数据（防止有人改条目忘了改卡）；
//   3. 行为 TODO：留一条可运行的 `play(...)`/`use(...)` 起手式，注释说明该断言什么。
//
// 骨架放在 develop/ 而不是 tests/：它不是回归用例，填完行为断言后由人提升到 tests/
// 并登记分层（tests/suites.mjs + tests/node-suite.mjs 有守卫，不会漏登记）。

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EFFECTS } from '../src/cards/card-effects.js'
import { CARD_ABILITY_ENTRIES } from '../src/cards/card-abilities.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { buildCardIndex } from './build-card-index.mjs'
import { renderEntryModule } from './card-entry-source.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = 'develop/scaffolds'
const LEDGER = 'audit/migration-batches.json'

const READ_POINTS = Object.freeze({
  played: { fn: 'playedEffect', field: 'effect' },
  commit: { fn: 'commitProfile', field: 'skill' },
  weakness: { fn: 'weaknessProfile', field: 'weakness' },
  entersPlay: { fn: 'entersPlayEffect', field: 'entersPlay' },
  leavesPlay: { fn: 'leavesPlayEffect', field: 'leavesPlay' },
})

function batchOf(code, ledger) {
  for (const [name, codes] of Object.entries(ledger.batches || {})) {
    if (codes.includes(code)) return name
  }
  return null
}

function scaffoldFor(code, ledger) {
  const card = ALL_CARDS[code] || {}
  const name = card.nameZh || card.name || code
  const entry = CARD_ABILITY_ENTRIES.find(item => item.code === code) || null
  const descriptors = entry?.abilities || []
  const lifecycle = descriptors.find(descriptor => READ_POINTS[descriptor.kind])
  const actions = descriptors.filter(descriptor => descriptor.kind === 'action' || descriptor.kind === 'free')
  const readPoint = lifecycle ? READ_POINTS[lifecycle.kind] : null
  const batch = batchOf(code, ledger)

  const lines = []
  lines.push(`// 由 tools/scaffold-card.mjs 生成：${code} ${name}${batch ? `（批次 ${batch}）` : ''}`)
  lines.push('//')
  lines.push('// 这是**测试骨架**：通道与读点断言已经写好并且应当保持绿；')
  lines.push('// 行为断言留了起手式，填完再把它提升到 tests/ 并登记分层。')
  lines.push('')
  lines.push("import test from 'node:test'")
  lines.push("import assert from 'node:assert/strict'")
  // core-fixture 会 import 引擎装配点，注册表因此在测试体执行前就填好了。
  lines.push("import { fixture, play, move, asset, use } from '../../tests/core-fixture.mjs'")
  lines.push("import { EFFECTS } from '../../src/cards/card-effects.js'")
  lines.push("import { registeredEntry, abilitySummary } from '../../src/engine/ability.js'")
  const usedReadPoints = [...new Set(descriptors.map(descriptor => READ_POINTS[descriptor.kind]?.fn).filter(Boolean))]
  if (usedReadPoints.length) {
    lines.push(`import { ${usedReadPoints.join(', ')} } from '../../src/engine/lifecycle.js'`)
  }
  lines.push('')
  lines.push(`const CODE = ${JSON.stringify(code)}`)
  lines.push('')
  lines.push(`test('${code} ${name}：旧 DSL 条目已删除，能力层有条目', () => {`)
  lines.push('  assert.equal(EFFECTS[CODE], undefined, `${CODE} 仍留在旧 DSL（EFFECTS）里`)')
  lines.push('  const entry = registeredEntry(CODE)')
  lines.push('  assert.ok(entry, `${CODE} 没有能力层条目`)')
  if (entry) {
    lines.push(`  assert.equal(entry.abilities.length, ${entry.abilities?.length ?? 0}, '描述子条数与实现一致')`)
  }
  if (entry && entry.playCondition) lines.push("  assert.ok(abilitySummary(CODE).playCondition.length, '打出条件有给玩家/AI 看的文案')")
  lines.push('})')
  lines.push('')
  if (descriptors.length) {
    lines.push(`test('${code} ${name}：读点返回迁移时声明的数据体', () => {`)
    let assertions = 0
    for (const descriptor of descriptors) {
      const point = READ_POINTS[descriptor.kind]
      // 用 resolve 实现的钩子没有数据体（playedEffect 返回 null），读点断言没有意义。
      if (!point || descriptor[point.field] == null) continue
      assertions++
      lines.push(`  assert.deepEqual(${point.fn}(CODE), ${JSON.stringify(descriptor[point.field])}, '${point.fn} 必须原样返回')`)
    }
    if (!assertions) {
      lines.push('  // 这张卡用 resolve 实现（没有数据体）：读点由 legalMoves 与窗口枚举覆盖。')
      lines.push('  assert.ok(registeredEntry(CODE).abilities.length > 0)')
    }
    lines.push('})')
    lines.push('')
  }
  lines.push(`test('${code} ${name}：行为断言（TODO）', () => {`)
  lines.push('  const state = fixture()')
  if (readPoint && lifecycle?.kind === 'played') {
    lines.push('  // 从手牌打出，断言效果：')
    lines.push('  // play(state, CODE)')
    lines.push('  // assert.equal(state.investigators[0].resources, 预期值)')
  } else if (readPoint && lifecycle?.kind === 'commit') {
    lines.push('  // 投入技能检定后断言 onSuccess / successBy 的结算：')
    lines.push("  // state.investigators[0].hand.push(CODE)")
    lines.push("  // move(state, { action: 'investigate' }) 之后逐项断言")
  } else if (readPoint && lifecycle?.kind === 'weakness') {
    lines.push('  // 抽到这张弱点时断言揭示结算：')
    lines.push("  // state.investigators[0].deck = [CODE]")
    lines.push("  // move(state, { action: 'draw' })")
  } else if (actions.length) {
    lines.push('  // 使用第一条主动能力，断言效果与费用：')
    lines.push('  const card = asset(state, CODE)')
    lines.push('  // use(state, card)')
  } else {
    lines.push('  // 被动/常驻条目：把这张卡放进场上，断言属性或规则读点。')
    lines.push('  const card = asset(state, CODE)')
    lines.push('  assert.ok(card.code === CODE)')
  }
  lines.push('  assert.ok(state, \'骨架起手式可运行\')')
  lines.push('})')
  lines.push('')
  return lines.join('\n')
}

// 新卡的行为文件骨架：默认只创建空条目，具体描述子由作者按卡面补。
function entryTemplate(code) {
  const card = ALL_CARDS[code] || {}
  const name = card.nameZh || card.name || code
  const text = card.textZh || card.text || ''
  const source = `{
  code: '${code}',
  // TODO: 按卡面实现（abilities / modifiers / playCondition / elderSign）。
  // 只通过 ctx.api 改状态；不要 import engine.js。
  abilities: [],
  modifiers: [],
}`
  return renderEntryModule({ code, name, text, source })
}

async function readLedger() {
  if (!existsSync(path.join(ROOT, LEDGER))) return { batches: {} }
  return JSON.parse(await readFile(path.join(ROOT, LEDGER), 'utf8'))
}

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const withEntry = args.includes('--entry')
  const noIndex = args.includes('--no-index')
  // 支持重复的 --batch：`--batch 5c-2 --batch 5c-3`（每批一次），也兼容卡号混写。
  const batchNames = []
  const codeArgs = []
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--batch') { batchNames.push(args[++index]); continue }
    if (arg.startsWith('--')) continue
    codeArgs.push(arg)
  }
  const ledger = await readLedger()
  let codes = codeArgs
  for (const batch of batchNames) {
    const batchCodes = ledger.batches?.[batch]
    if (!batchCodes) throw new Error(`批次 ${batch} 不在 ${LEDGER} 里（先跑 tools/migrate-card.mjs --write --batch ${batch}）`)
    codes = [...new Set([...batchCodes, ...codes])]
  }
  if (!codes.length) {
    console.error('用法：node tools/scaffold-card.mjs <code…> | --batch <名称> [--entry] [--no-index] [--force]')
    process.exit(2)
  }
  if (withEntry) {
    const entryDir = path.join(ROOT, 'src/cards/entries')
    await mkdir(entryDir, { recursive: true })
    let created = 0
    for (const code of codes) {
      const file = path.join(entryDir, `${code}.js`)
      if (existsSync(file)) {
        // 行为文件绝不覆盖：--force 只用于覆盖测试骨架，不能清空一张已实现的卡。
        console.log(`  跳过行为文件 ${code}：${path.relative(ROOT, file)} 已存在（行为文件不允许 --force 覆盖）`)
        continue
      }
      await writeFile(file, entryTemplate(code), 'utf8')
      created++
      console.log(`  写入行为文件 ${path.relative(ROOT, file).split(path.sep).join('/')}`)
    }
    if (created && !noIndex) await buildCardIndex({ write: true })
    if (created && noIndex) {
      console.log('  --no-index：跳过 entries/index.js 重建；由主进程合并分片后统一重建')
      console.log('  worker 只做 node --check / 结构检查，不要跑 cards:check 或 test:fast（索引此时故意是旧的）')
    } else {
      console.log(`生成 ${created} 个行为文件骨架；补完描述子后运行 npm run test:fast`)
    }
  }
  await mkdir(path.join(ROOT, OUT_DIR), { recursive: true })
  let written = 0
  for (const code of codes) {
    const file = path.join(ROOT, OUT_DIR, `${code}.test.mjs`)
    if (existsSync(file) && !force) {
      console.log(`  跳过 ${code}：${path.relative(ROOT, file)} 已存在（--force 覆盖）`)
      continue
    }
    await writeFile(file, scaffoldFor(code, ledger), 'utf8')
    written++
    console.log(`  写入 ${path.relative(ROOT, file).split(path.sep).join('/')}`)
  }
  console.log(`生成 ${written} 个骨架；直接运行：node --test ${OUT_DIR}/<code>.test.mjs`)
}

await main().catch(error => {
  console.error(error?.stack || String(error))
  process.exit(1)
})
