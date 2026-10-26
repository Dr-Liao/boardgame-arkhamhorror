// 架构守卫（重构路线 Phase 0）：把"五件唯一"里可机械判定的部分钉死。
//
// 守住四件事：
//   1. 冻结集合——engine.js 的 5 位码、EFFECTS 的键、描述子 kind，都只减不增；
//   2. 分层方向——内容层不得 import 引擎装配点；
//   3. 窗口接线——描述子声明的 trigger 必须是 windows.js 已注册的窗口；
//   4. 产物同步——audit/ability-coverage.json 必须与当前实现一致，指标变化要进 diff。
//
// 新增一条引擎分支或一个 EFFECTS 条目时，这个用例会失败——这是设计意图：
// 先评审（改白名单），再写代码；不能让"顺手把守卫调绿"成为默认路径。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path, { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCoverage, collect } from '../tools/audit-abilities.mjs'
// Phase 5（5a）：旧原语分派点的死代码检测——引擎里不得留「已经没有数据引用」的分支。
import { collectDeadPrimitives } from '../tools/audit-dead-primitives.mjs'
// Phase 3（D1）：非玩家卡条的修正目标在实体读点上校验（与 C1 的「声明即接线」同一口径）。
import { describeEntityRules } from '../src/engine/modifiers.js'
// 外部硬编码守卫（REPORT.md 第 0 批）：引擎实体 id / 卡牌层卡号 / 未接线原语。
import { collectHardcodes, compareWhitelist } from '../tools/hardcode-audit.mjs'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const serialize = value => `${JSON.stringify(value, null, 2)}\n`
const sorted = values => [...values].sort()

// 描述子的 kind 是规则模型的一部分：加新 kind 必须同时改文档与这里。
// Phase 1 在 played / commit 之外补齐了三个生命周期钩子：weakness / entersPlay / leavesPlay。
const FROZEN_KINDS = ['action', 'free', 'reaction', 'forced', 'constant', 'elderSign',
  // Phase 5（5c-39）：开局效果（「原定计划」）——新增 kind 需要同步更新文档与本用例。
  'setup',
  'played', 'commit', 'weakness', 'entersPlay', 'leavesPlay']

const data = await collect()

test('engine.js 的 5 位码集合与白名单一致（只减不增）', () => {
  const whitelist = JSON.parse(read('audit/card-code-whitelist.json'))
  assert.equal(whitelist.count, whitelist.codes.length, '白名单 count 与 codes 长度不一致')
  const added = data.engineCodes.filter(code => !whitelist.codes.includes(code))
  const removed = whitelist.codes.filter(code => !data.engineCodes.includes(code))
  assert.deepEqual(added, [],
    `engine.js 新增了 ${added.length} 个 5 位码：重构期不允许新增卡号分支。\n`
    + `  确有需要时先人工评审，再重跑 node tools/audit-abilities.mjs --write --allow-growth。`)
  assert.deepEqual(removed, [],
    `白名单里有 ${removed.length} 个码已从 engine.js 删除：这是迁移成果，请重跑 `
    + 'node tools/audit-abilities.mjs --write 让账本一起下降。')
})

test('EFFECTS 键集合与白名单一致（只减不增）', () => {
  const whitelist = JSON.parse(read('audit/effects-whitelist.json'))
  assert.equal(whitelist.count, whitelist.codes.length, '白名单 count 与 codes 长度不一致')
  const added = data.effectsCodes.filter(code => !whitelist.codes.includes(code))
  const removed = whitelist.codes.filter(code => !data.effectsCodes.includes(code))
  assert.deepEqual(added, [],
    `card-effects.js 新增了 ${added.length} 个 EFFECTS 条目：新卡请写 card-abilities.js 描述子。\n`
    + `  ${added.join(', ')}`)
  assert.deepEqual(removed, [],
    `白名单里有 ${removed.length} 个 EFFECTS 条目已被删除：请重跑 node tools/audit-abilities.mjs --write。`)
})

test('描述子 kind 冻结在 12 种', () => {
  assert.deepEqual(data.abilityKinds, FROZEN_KINDS,
    'ABILITY_KINDS 变了：新增 kind 需要先更新 docs/architecture-refactor-roadmap.md §4、'
    + 'docs/card-model.md §3 与本用例')
})

test('描述子声明的时机窗口都已注册', () => {
  assert.deepEqual(data.unknownTriggers, [],
    `这些窗口被描述子引用但没有在 windows.js 注册：${data.unknownTriggers.join(', ')}`)
})

test('内容层不得 import 引擎装配点', () => {
  const offenders = []
  const walk = (dir, files = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full, files)
      else if (entry.name.endsWith('.js')) files.push(full)
    }
    return files
  }
  for (const dir of ['src/cards', 'content']) {
    for (const file of walk(fileURLToPath(new URL(dir, root)))) {
      if (/from\s+'[^']*engine\/engine\.js'/.test(readFileSync(file, 'utf8'))) {
        offenders.push(relative(fileURLToPath(root), file).replace(/\\/g, '/'))
      }
    }
  }
  assert.deepEqual(offenders, [],
    `内容层只能依赖 ability/matcher/modifiers/windows 这些稳定契约，不能反向 import engine.js：\n  ${offenders.join('\n  ')}`)
})

test('覆盖度产物与当前实现一致', () => {
  const expected = serialize(buildCoverage(data))
  const actual = read('audit/ability-coverage.json')
  assert.equal(actual, expected,
    'audit/ability-coverage.json 与实现不一致。运行 node tools/audit-abilities.mjs --write 后审阅 diff：'
    + '指标下降是迁移成果，上升一定有问题。')
})

// Phase 3（D1）：非玩家卡通道的守卫。
test('非玩家卡描述子只能声明实体修正/规则目标', () => {  assert.ok(data.phase3.nonPlayerCards > 0, '非玩家卡通道至少要有敌人/地点条目')
  const fake = { locations: [], enemies: [], acts: [], agendas: [], victoryDisplay: [], investigators: [] }
  for (const code of data.phase3.nonPlayerCodes) {
    // 读一遍会规范化修正目标：未知目标（例如把 skill:combat 写到敌人条目上）在这里就暴露。
    assert.doesNotThrow(() => describeEntityRules(fake, { id: `probe:${code}`, code }),
      `非玩家卡 ${code} 声明了无法实现的修正目标`)
  }
})

// Phase 3（D3）：behavior.js 的行数只减不增——这是"剧本声明化"的机械证据。
test('behavior.js 总行数不超过 Phase 3 基线，且至少一个关卡已声明化', () => {
// P8（2026-10-24）：四循环 9 章剧本接入，新增约 5,900 行 behavior.js（实测 20,759 - 14,831）（新循环内容，不是 Phase 3 的
// 旧战役命令式债务）；基线按实测 20,858 重锁，此后只减不增。
// 2026-10-25 TFA 修复战役：4R 审计问题修复（04283/04284/04291/04303/04073/04161/04162 等
// 场景钩子与记录写入）新增约 200 行，实测 21,057，按实测重锁；仍要求只减不增。
// 2026-10-25 TCU 修复战役：四循环审计后的卡面行为修复（9 章 behavior.js 的 spawnLocation/
// enemyMoved/胜利点/混沌袋/翻面语义等）新增约 578 行，实测 21,638，按实测重锁；仍要求只减不增。
// 2026-10-25 第二轮：章节转发/胜利点/祭品/谈判与中低频卡修复继续落在 behavior.js（含 TSN/UAD/FGG/
// ADDS 的共享钩子转发），实测 21,878，按实测重锁；后续新增流程仍要求走 scenario-declaration。
// 2026-10-25 第三轮（全卡审计修复）：各章补齐 spawnLocation/preyRank/parleyBlocked/agenda 反应/
// 宇宙网格重写等，实测 22,784；再次按实测重锁（+现有余量），仍要求后续只减不增。
// 2026-10-26 卡尔克萨审计修复：P0/P1 与交互层修复（黑星升起双密谋/威胁区诡计/线索翻毁灭/
// 03052 揭示、地下墓穴入场费、共享遭遇组轮末结算等），实测 23,529，按实测重锁。
const BUDGET = 23529
  assert.ok(data.phase3.behaviorLines <= BUDGET,
    `behavior.js 总行数 ${data.phase3.behaviorLines} 超过基线 ${BUDGET}：新增关卡流程请写 `
    + 'content/scenario-declaration.js 的声明，不要往 behavior.js 加命令式钩子。')
  assert.ok(data.phase3.declaredScenarios >= 3,
    `已声明化的关卡只有 ${data.phase3.declaredScenarios} 个：新关卡必须用 declareScenario`)
})

// Phase 5（5b/5c）：迁走的卡必须登记进卡包的 abilityLayerCodes。
// 不登记 → 包的 deckbuilding 变成 false → 自动牌组池少一张 → 开局牌组与 replay 基线都会变。
test('卡包清单登记了所有迁到能力层的卡', async () => {
  const { registeredCodes } = await import('../src/engine/ability.js')
  const packs = [
    ['dunwichPlayer', await import('../content/packs/dunwichPlayer/manifest.js')],
    ['carcosaPlayer', await import('../content/packs/carcosaPlayer/manifest.js')],
    ['dunwichSupport', await import('../content/packs/dunwichSupport/manifest.js')],
  ]
  const registered = new Set(registeredCodes())
  const offenders = []
  for (const [id, mod] of packs) {
    for (const card of mod.manifest.cards) {
      if (!registered.has(card.code)) continue
      // deckbuilding=false 的卡（基础弱点等）按设计不进自动牌组池，不需要登记。
      if (card.deckbuilding === false) continue
      if (Object.hasOwn(mod.effects, card.code)) continue
      if (mod.abilityLayerCodes.includes(card.code)) continue
      offenders.push(`${id}:${card.code}`)
    }
  }
  assert.deepEqual(offenders, [],
    '这些卡已迁到能力层，但没有登记进卡包的 abilityLayerCodes（会让自动牌组池缺卡）：\n  '
    + offenders.join('\n  '))
})

// Phase 5（5a）：旧原语分派点不得残留死代码。
// 判据：`effect.action === 'X'` 的分派点在 EFFECTS / 描述子数据体 / 内容层源码 / 引擎其它位置
// 四处都没有引用 ⇒ 卡已经迁到描述子，分支该删（迁移证据 = 引擎变小、卡号减少）。
test('引擎里没有已无数据引用的旧原语分支', () => {
  const result = collectDeadPrimitives()
  assert.deepEqual(result.dead.map(row => row.name), [],
    '这些旧原语分支已经没有数据引用，请删除（tools/audit-dead-primitives.mjs --check 可复算）：\n  '
    + result.dead.map(row => `${row.name} (L${row.lines.join(', L')})`).join('\n  '))
})

// ---------------------------------------------------------------------------
// 外部硬编码守卫（REPORT.md §9 第 0 批）
//
// 口径：卡号只允许出现在 entries/<code>.js、encounter-entries/<归属>/<code>.js 与 cards-data.js；
// 引擎不得出现内容实体 id；效果原语必须在数据里被引用。当前债务冻结在
// audit/hardcode-whitelist.json，只减不增。
// 修复后运行 `node tools/hardcode-audit.mjs --write` 让基线下降——这是迁移成果的证据。
// ---------------------------------------------------------------------------
const hardcode = collectHardcodes()
const hardcodeWhitelist = JSON.parse(read('audit/hardcode-whitelist.json'))
const hardcodeDiff = compareWhitelist(hardcode, hardcodeWhitelist)

function assertNoHardcodeGrowth(label) {
  assert.deepEqual(hardcodeDiff.growth, [],
    `${label}：检测到新增外部硬编码。\n`
    + hardcodeDiff.growth.map(line => `  + ${line}`).join('\n')
    + '\n卡牌行为请写 src/cards/entries/<code>.js；非玩家卡写 src/cards/encounter-entries/<归属>/<code>.js；'
    + '不要为了绕开守卫把卡号搬到另一个公共文件。')
}

function assertHardcodeBaselineFresh(label) {
  assert.deepEqual(hardcodeDiff.stale, [],
    `${label}：这些硬编码已经消失，但 audit/hardcode-whitelist.json 还留着旧基线。\n`
    + hardcodeDiff.stale.map(line => `  - ${line}`).join('\n')
    + '\n运行 node tools/hardcode-audit.mjs --write 让基线随迁移下降。')
}

test('引擎模块没有新增 5 位卡号（src/engine/**）', () => {
  assertNoHardcodeGrowth('src/engine/**')
  assertHardcodeBaselineFresh('src/engine/**')
})

test('引擎模块没有新增内容实体 id（地点/敌人/剧本/战役）', () => {
  assertNoHardcodeGrowth('src/engine/** 实体 id')
  assertHardcodeBaselineFresh('src/engine/** 实体 id')
})

test('卡牌层非 entries 文件没有新增卡号（src/cards/**）', () => {
  assertNoHardcodeGrowth('src/cards/**（非 entries）')
  assertHardcodeBaselineFresh('src/cards/**（非 entries）')
})

test('效果原语都必须有数据引用', () => {
  assertNoHardcodeGrowth('EFFECT_PRIMITIVES')
  assertHardcodeBaselineFresh('EFFECT_PRIMITIVES')
})

// 第 8 批收尾守卫（第 127 轮）：`web/**/*.js` 里不再出现 5 位卡号字面量。
// 浏览器端的「哪张卡」由 web/ui-cards.js 声明（纯数据表，唯一允许的卡号来源），
// 其余前端代码只读数据；这条守卫防止再把卡号写回 UI 代码。
const WEB_CARD_CODE_BASELINE = 0
const WEB_CARD_DATA_MODULE = 'web/ui-cards.js'

function webJsFiles() {
  const files = []
  const walk = dir => {
    for (const entry of readdirSync(new URL(dir, root), { withFileTypes: true })) {
      const path = `${dir}${entry.name}`
      if (entry.isDirectory()) {
        if (['node_modules', 'img', 'audio'].includes(entry.name)) continue
        walk(`${path}/`)
      } else if (entry.name.endsWith('.js')) files.push(path)
    }
  }
  walk('web/')
  return files
}

test('web 代码里没有卡号字面量（第 8 批：改读 web/ui-cards.js）', () => {
  const hits = []
  for (const file of webJsFiles()) {
    if (file === WEB_CARD_DATA_MODULE) continue
    const source = readFileSync(new URL(file, root), 'utf8')
    for (const match of source.matchAll(/['"`]0\d{4}[a-z]?['"`]/g)) hits.push(`${file}: ${match[0]}`)
  }
  assert.ok(hits.length <= WEB_CARD_CODE_BASELINE,
    `web 里新增了卡号字面量（基线 ${WEB_CARD_CODE_BASELINE}）：\n  ${hits.join('\n  ')}`)
})

// 第 128 轮守卫：浏览器模块必须自包含在 web/ 内。
// 大厅只把 Mod 的 web 目录挂到 /mods/<id>/（lib/mods.js 的 web 契约）；相对导入一旦跨出
// 这个目录，浏览器会把它解析成 /mods/<越界路径> 并 404（例如 /mods/presentation/ui-cards.js），
// 整个 Mod 界面随之加载失败：启动页退回大厅通用弹窗，开局后停在「正在加载界面…」。
// Node 能正常解析这些路径，所以单元测试必须按浏览器口径静态检查。
test('web 模块的导入不越出 web/ 挂载目录', () => {
  const offenders = []
  for (const file of webJsFiles()) {
    const source = readFileSync(new URL(file, root), 'utf8')
    const dir = path.posix.dirname(file)
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1]
      if (!specifier.startsWith('.')) {
        offenders.push(`${file}: 裸模块名「${specifier}」——浏览器没有 import map，无法解析`)
        continue
      }
      const target = path.posix.normalize(path.posix.join(dir, specifier))
      if (!target.startsWith('web/')) {
        offenders.push(`${file}: ${specifier} → /mods/${target.slice('web/'.length)}（跨出 web/ 挂载点，浏览器会 404）`)
        continue
      }
      if (!existsSync(new URL(target, root))) offenders.push(`${file}: ${specifier} → ${target}（文件不存在）`)
    }
  }
  assert.deepEqual(offenders, [],
    'web/ 是挂给浏览器的唯一目录，模块只能从其中导入：\n  ' + offenders.join('\n  ')
    + '\n浏览器界面代码请放在 web/ 内（纯数据表见 web/ui-cards.js）；'
    + '服务端模块如需复用，应由 Node 侧 import web/ 中的文件，而不是反过来。')
})

// 第 7 批长尾守卫：content/ 的章节脚本里写死的卡号只能减少，不能新增。
// 基线是 2026-10-22 迁移到第 7 批时的实测值；每迁走一批就调低这个数字。
const CONTENT_CARD_CODE_BASELINE = 1105
// 与上面的字面量口径分开统计「规则分支」：DoD 要求内容层 `code === '0xxxx'` 分支归零。
// 口径包含 content/ 下全部 .js（此前只扫 behavior/encounter-rules/card-data，漏掉
// later-behaviors.js 这类共享章节文件）。
// 第 120 轮达成 **0**：跨章共用议程用 `agendaRuleByScenario`、04092 走条目、
// 04214 的幕规则挂在遭遇条目的 actRule 上。之后只减不增（任何新增都会直接失败）。
const CONTENT_BRANCH_BASELINE = 0

function contentJsFiles() {
  const files = []
  const walk = dir => {
    for (const entry of readdirSync(new URL(dir, root), { withFileTypes: true })) {
      const path = `${dir}${entry.name}`
      if (entry.isDirectory()) { walk(`${path}/`); continue }
      if (entry.name.endsWith('.js')) files.push(path)
    }
  }
  walk('content/')
  return files
}

function countContentCardCodes() {
  let total = 0
  for (const file of contentJsFiles()) {
    if (!/(behavior|encounter-rules|card-data)\.js$/.test(file)) continue
    total += (read(file).match(/['"]0\d{4}[a-z]?['"]/g) || []).length
  }
  return total
}

function countContentCardBranches() {
  let total = 0
  for (const file of contentJsFiles()) {
    total += (read(file).match(/(?:code|originalCode)\s*===\s*['"]0\d{4}[a-z]?['"]/g) || []).length
  }
  return total
}

test('内容层章节脚本的卡号字面量只减不增', () => {
  const count = countContentCardCodes()
  assert.ok(count <= CONTENT_CARD_CODE_BASELINE,
    `content 卡号字面量 ${count} 超过基线 ${CONTENT_CARD_CODE_BASELINE}：新增了硬编码`)
})

test('内容层按卡号的规则分支只减不增（含 later-behaviors 等共享章节文件）', () => {
  const count = countContentCardBranches()
  assert.ok(count <= CONTENT_BRANCH_BASELINE,
    `content 按卡号分支 ${count} 超过基线 ${CONTENT_BRANCH_BASELINE}：新增了按卡号分支，`
    + '应写进 src/cards/entries/<code>.js 或 src/cards/encounter-entries/<归属>/<code>.js 的条目')
})
