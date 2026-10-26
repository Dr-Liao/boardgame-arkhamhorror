// 一卡一文件守卫（fast tier）。
//
// 规矩（见 ARCHITECTURE.md §3.3 与 docs/card-entry-files.md）：
//   · 每张有行为的卡一个 src/cards/entries/<code>.js，export default 一个条目；
//   · card-abilities.js 只做聚合，不再放条目；
//   · 不存在 BATCH_* / MIGRATED_* 批次大数组；
//   · entries/index.js 是生成物，必须与目录一致。
//
// 这些断言故意不依赖具体卡号：新增/删除卡只改文件与索引，守卫仍然成立。

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { CARD_ABILITY_ENTRIES, CARD_ABILITY_CODES } from '../src/cards/card-abilities.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { actionPreview } from '../src/engine/engine.js'
import { fixture, enemy } from './core-fixture.mjs'
import { buildCardIndex, entryFiles } from '../tools/build-card-index.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ENTRY_DIR = path.join(ROOT, 'src/cards/entries')
const IGNORED = new Set(['index.js', '_shared.js'])

test('每张卡一个文件：文件名 = 条目 code，且只 export default 一个条目', async () => {
  const files = await readdir(ENTRY_DIR)
  const cards = files.filter(file => file.endsWith('.js') && !IGNORED.has(file))
  assert.ok(cards.length > 0, 'entries 目录里没有卡牌文件')

  for (const file of cards) {
    const source = await readFile(path.join(ENTRY_DIR, file), 'utf8')
    assert.equal((source.match(/export default/g) || []).length, 1, `${file} 必须恰好有一个 export default`)
    const module = await import(pathToFileURL(path.join(ENTRY_DIR, file)).href)
    const entry = module.default
    assert.ok(entry && typeof entry === 'object', `${file} 没有 default 条目`)
    assert.equal(entry.code, path.basename(file, '.js'), `${file} 的 code 必须等于文件名`)
  }
})

test('entries/index.js 与目录一致，CARD_ABILITY_ENTRIES 顺序与索引一致', async () => {
  const index = await buildCardIndex({ write: false })
  assert.equal(index.changed, false, 'entries/index.js 过期：运行 node tools/build-card-index.mjs --write')
  assert.deepEqual(CARD_ABILITY_ENTRIES.map(entry => entry.code), index.order,
    'CARD_ABILITY_ENTRIES 的顺序必须等于 entries/index.js 的顺序')
  assert.equal(CARD_ABILITY_CODES.size, CARD_ABILITY_ENTRIES.length, '卡号不能重复')
  assert.equal(CARD_ABILITY_ENTRIES.length, index.files.length, '索引卡数必须等于目录卡数')
})

test('卡牌文件不 import 引擎装配点 / 聚合入口 / 批次大文件', async () => {
  const files = await readdir(ENTRY_DIR)
  const forbidden = [
    { pattern: /from\s+['"][^'"]*card-abilities\.js['"]/, label: 'card-abilities.js' },
    { pattern: /from\s+['"][^'"]*ability-migration-batches\.js['"]/, label: '批次大文件' },
    { pattern: /from\s+['"][^'"]*engine\.js['"]/, label: 'engine.js' },
    { pattern: /from\s+['"][^'"]*content\//, label: 'content/' },
  ]
  for (const file of files) {
    if (!file.endsWith('.js') || file === 'index.js') continue
    const source = await readFile(path.join(ENTRY_DIR, file), 'utf8')
    for (const { pattern, label } of forbidden) {
      assert.doesNotMatch(source, pattern, `${file} 不允许 import ${label}；卡只能经 ctx.api 结算`)
    }
  }
})

test('不存在批次大文件：ability-migration-batches.js 已删除', () => {
  assert.equal(existsSync(path.join(ROOT, 'src/cards/ability-migration-batches.js')), false,
    '不允许恢复 ability-migration-batches.js；一张卡一个文件')
})

test('card-abilities.js 只聚合，不再含条目', async () => {
  const source = await readFile(path.join(ROOT, 'src/cards/card-abilities.js'), 'utf8')
  assert.match(source, /CARD_ENTRY_LIST/, '聚合入口必须 import entries/index.js')
  assert.doesNotMatch(source, /\babilities\s*:/, 'card-abilities.js 不允许再写 abilities 条目')
  assert.doesNotMatch(source, /\bcode\s*:/, 'card-abilities.js 不允许再写卡号条目')
})

// P1 守卫（卡牌保真度审计 §3.1）：描述子的 kind 必须与卡型匹配。
//   · 事件只结算 kind:'played'；写成 action 会让整张卡不可达（03108 的原始 bug）。
//   · 支援的能力只枚举 action/free；只有 played 等于整条能力不存在（04156 的原始 bug）。
test('卡型与描述子 kind 匹配：事件必须有 played，支援不得只有 played', () => {
  const problems = []
  for (const entry of CARD_ABILITY_ENTRIES) {
    const card = ALL_CARDS[entry.code]
    const abilities = entry.abilities || []
    if (!card || !abilities.length) continue
    const kinds = new Set(abilities.map(ability => ability.kind))
    const weakness = card.type === 'event' && Boolean(card.subtype)
    // 快速事件有两种已支持写法：played+fast+trigger，或 reaction+fromHand（窗口内从手牌打出）。
    // 2026-10-25：带 attachTo 的事件（05152/05230）由 doPlay 的附属通道打出，没有 played 描述子。
    const handReaction = abilities.some(ability => ability.fromHand === true
      && (ability.kind === 'reaction' || ability.kind === 'forced'))
    if (card.type === 'event' && !weakness && !kinds.has('played') && !handReaction && !entry.attachTo) {
      problems.push(`${entry.code}（事件）缺少 kind:'played'：${[...kinds].join('/')}`)
    }
    if (card.type === 'asset' && kinds.size === 1 && kinds.has('played')) {
      problems.push(`${entry.code}（支援）只有 kind:'played'，能力不可达`)
    }
  }
  assert.deepEqual(problems, [], `描述子 kind 与卡型不匹配：\n  ${problems.join('\n  ')}`)
})

// ---------------------------------------------------------------------------
// 行动指示（Action Designator）→ 借机攻击豁免守卫（2026-10-26）
//
// 规则：卡面粗体「攻击。/躲避。/谈判。/撤退。」= 按对应行动结算；这四类行动不引发借机攻击
// （Rules Reference「Attack of Opportunity / Action Designators」）。实现上靠描述子的
// countsAs（resolve 能力）或 effect.kind/type，显式写「不引发」的卡用 noOpportunityAttack；
// 快速卡不花行动、也不引发。
//
// 背景：05013 银暮匕首、03153 灵力风暴 曾因为只写了 resolve、没写 countsAs，被引擎当成普通
// 行动 → 与敌人交战时发动/打出先吃一次借机攻击。这里把「卡面指示 ↔ 描述子声明」固化成门禁，
// 同类漏写会在 fast tier 直接失败，而不是等玩家踩到。
// ---------------------------------------------------------------------------

const EXEMPT_DESIGNATORS = {
  fight: ['Fight.', '攻击。'],
  evade: ['Evade.', '躲避。'],
  parley: ['Parley.', '谈判。'],
  resign: ['Resign.', '撤退。'],
}
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// 指示可以出现在行首，也可以出现在「[action] …:」/「[action] …：」之后（中英文冒号）。
const hasDesignator = (text, label) => new RegExp(`(^|[\\n:：])\\s*(\\*\\*)?(${escapeRegExp(label)})(\\*\\*)?`, 'u')
  .test(String(text || ''))
const printedExemptKinds = card => Object.entries(EXEMPT_DESIGNATORS)
  .filter(([, labels]) => labels.some(label => hasDesignator(card.text, label) || hasDesignator(card.textZh, label)))
  .map(([kind]) => kind)
const isExemptKind = kind => ['fight', 'evade', 'parley', 'resign'].includes(kind)
const declaredKinds = ability => [ability.countsAs, ability.effect?.kind, ability.effect?.type].filter(Boolean)

test('卡面「攻击/躲避/谈判/撤退」指示必须在描述子上声明（借机攻击豁免）', () => {
  const problems = []
  for (const entry of CARD_ABILITY_ENTRIES) {
    const card = ALL_CARDS[entry.code]
    if (!card) continue
    const abilities = (entry.abilities || []).filter(ability => ['action', 'played', 'free'].includes(ability.kind))
    // 只守护「能力层真的可打出/可发动」的卡；纯数据/剧情条目（如弱点敌人、剧情支援）没有 played/action。
    if (!abilities.length) continue
    for (const kind of printedExemptKinds(card)) {
      const covered = abilities.some(ability => declaredKinds(ability).includes(kind)
        || ability.noOpportunityAttack === true || ability.fast === true)
      if (!covered) {
        problems.push(`${entry.code}（${card.name}）卡面有「${kind}」指示，但描述子没写 countsAs:'${kind}' / noOpportunityAttack / fast`)
      }
    }
  }
  assert.deepEqual(problems, [], `借机攻击豁免声明缺失：\n  ${problems.join('\n  ')}`)
})

test('带豁免类行动指示的事件卡：打出预览不出现借机攻击', () => {
  const problems = []
  for (const entry of CARD_ABILITY_ENTRIES) {
    const card = ALL_CARDS[entry.code]
    if (!card || card.type !== 'event' || !printedExemptKinds(card).length) continue
    const state = fixture()
    state.investigators[0].hand = [entry.code]
    state.investigators[0].resources = 30
    enemy(state, { damage: 2 })
    const preview = actionPreview(state, 0, { action: 'play', cardId: entry.code })
    if (preview?.opportunityAttacks?.length) problems.push(`${entry.code}（${card.name}）打出预览仍出现借机攻击`)
  }
  assert.deepEqual(problems, [], `事件卡借机攻击豁免失效：\n  ${problems.join('\n  ')}`)
})

test('带豁免类行动指示的 [action] 能力：发动预览不出现借机攻击', () => {
  const problems = []
  for (const entry of CARD_ABILITY_ENTRIES) {
    const card = ALL_CARDS[entry.code]
    if (!card) continue
    ;(entry.abilities || []).forEach((ability, index) => {
      if (ability.kind !== 'action') return
      const kind = declaredKinds(ability).find(isExemptKind)
      if (!kind) return
      const state = fixture()
      state.investigators[0].assets = [{ id: 'preview-asset', code: entry.code, exhausted: false }]
      enemy(state, { damage: 2 })
      const preview = actionPreview(state, 0, { action: 'ability', assetId: 'preview-asset', abilityIndex: index })
      if (preview?.opportunityAttacks?.length) problems.push(`${entry.code}（${card.name}）第 ${index} 条能力预览仍出现借机攻击`)
    })
  }
  assert.deepEqual(problems, [], `[action] 能力借机攻击豁免失效：\n  ${problems.join('\n  ')}`)
})

test('卡面「快速。」必须落在条目（资产）或 played 描述子（事件）上', () => {
  const problems = []
  for (const entry of CARD_ABILITY_ENTRIES) {
    const card = ALL_CARDS[entry.code]
    if (!card) continue
    if (!/(^|\n)\s*(\*\*)?Fast\./.test(String(card.text || ''))) continue
    const abilities = entry.abilities || []
    const hasFast = entry.fast === true || abilities.some(ability => ability.fast === true)
    const hasPlayed = abilities.some(ability => ability.kind === 'played')
    if (card.type === 'asset' && !hasFast) {
      problems.push(`${entry.code}（${card.name}）是快速资产，条目缺少 fast: true`)
    } else if (card.type === 'event' && hasPlayed && !hasFast) {
      problems.push(`${entry.code}（${card.name}）是快速事件，played 描述子缺少 fast: true`)
    }
  }
  assert.deepEqual(problems, [], `快速关键字未落数据：\n  ${problems.join('\n  ')}`)
})
