// 07-a-7（TIC · lod 07261–07300b）逐卡验收补证测试。
//
// 目的：
//   1) 为全分片唯一缺「标题含卡号」证据的 07271 / 07272 补真实执行用例；
//   2) 复现审计判出的三处缺陷（见验收报告失败清单）：
//      · 07267 承载区 capturedCards 已投影为 capturedCardCount，但 web 无渲染读点（新承载区未三处接线）；
//      · 07273 新使用标记类型 `corruption` 未登记展示契约（USE_TOKEN_DISPLAY / i18n）；
//      · 07280/07281/07282 三张达贡幕的同一句印刷模板（嫌犯修正 + 花钥匙清屏障）三份手写声明。
// 全部 import 真实条目/引擎模块执行，不做「条目存在」式断言。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { windows, isKnownWindow } from '../src/engine/windows.js'
import { publicCardInstance } from '../src/integration/presentation-state.js'
import favorOfMoon from '../src/cards/entries/07271.js'
import favorOfSun from '../src/cards/entries/07272.js'
import ikiaq from '../src/cards/entries/07267.js'
import purifying from '../src/cards/entries/07273.js'
import oathOne from '../src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07280.js'
import oathTwo from '../src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07281.js'
import oathThree from '../src/cards/encounter-entries/theInnsmouthConspiracy/theLairOfDagon/07282.js'

function recordingApi(overrides = {}) {
  const calls = []
  const api = {
    calls,
    info: () => {},
    choice: request => (overrides.choose ? overrides.choose(request) : request.options?.[0]?.id),
    gainResources: (seat, amount) => calls.push(['gainResources', seat, amount]),
    playerTools: {
      sealUpTo: (...args) => { calls.push(['sealUpTo', ...args]); return [] },
      revealSealedInstead: (...args) => { calls.push(['revealSealedInstead', ...args]); return overrides.revealSealedInstead ?? true },
      captureWeakness: (...args) => calls.push(['captureWeakness', ...args]),
      returnCapturedWeaknesses: (...args) => calls.push(['returnCapturedWeaknesses', ...args]),
    },
    scenario: {
      detachEncounterAttachment: attachment => calls.push(['detachEncounterAttachment', attachment.code || attachment.originalCode]),
    },
    ...overrides,
  }
  return api
}

const favorState = sourceId => ({
  chaos: { sealed: [{ source: sourceId, token: 'curse' }] },
  investigators: [{ seat: 0, name: '调查员' }],
})

test('验收 07271 月之恩惠：快速封印至多3诅咒；无封印即弃；将揭示时改为揭示封印诅咒并获1资源', () => {
  assert.equal(favorOfMoon.code, '07271')
  assert.equal(favorOfMoon.fast, true, '07271 快速')
  assert.equal(favorOfMoon.assetRule.discardWithoutSealedTokens, true, '07271 无封印标记时弃置（uses.js 读点）')
  const enterApi = recordingApi()
  const source = { id: 'asset:moon', code: '07271' }
  assert.equal(favorOfMoon.abilities[0].kind, 'entersPlay')
  favorOfMoon.abilities[0].resolve({ inv: { seat: 0 }, source, api: enterApi })
  assert.deepEqual(enterApi.calls[0], ['sealUpTo', 0, 'asset:moon', 'curse', 3], '07271 入场封印至多 3 个诅咒')
  const reaction = favorOfMoon.abilities[1]
  assert.equal(reaction.trigger, 'beforeChaosTokenReveal')
  assert.equal(isKnownWindow(reaction.trigger), true, '07271 触发窗口已在 windows.js 注册')
  const state = favorState('asset:moon')
  const context = { seat: 0 }
  assert.equal(reaction.criteria({ inv: state.investigators[0], source, context, state }), true)
  const api = recordingApi()
  reaction.resolve({ inv: state.investigators[0], source, context, api })
  assert.deepEqual(api.calls, [['revealSealedInstead', context, 'asset:moon'], ['gainResources', 0, 1]], '07271 改为揭示封印诅咒并获得 1 资源')
  // 没有封印时就无法发动。
  const empty = favorState('other')
  assert.equal(reaction.criteria({ inv: empty.investigators[0], source, context, state: empty }), false)
})

test('验收 07272 日之恩惠：快速封印至多3祝福；将揭示时改为揭示封印祝福（不获得资源）', () => {
  assert.equal(favorOfSun.code, '07272')
  assert.equal(favorOfSun.fast, true)
  assert.equal(favorOfSun.assetRule.discardWithoutSealedTokens, true)
  const enterApi = recordingApi()
  const source = { id: 'asset:sun', code: '07272' }
  favorOfSun.abilities[0].resolve({ inv: { seat: 0 }, source, api: enterApi })
  assert.deepEqual(enterApi.calls[0], ['sealUpTo', 0, 'asset:sun', 'bless', 3], '07272 入场封印至多 3 个祝福')
  const reaction = favorOfSun.abilities[1]
  assert.equal(reaction.trigger, 'beforeChaosTokenReveal')
  assert.equal(isKnownWindow(reaction.trigger), true)
  const state = { chaos: { sealed: [{ source: 'asset:sun', token: 'bless' }] }, investigators: [{ seat: 0 }] }
  const context = { seat: 0 }
  assert.equal(reaction.criteria({ inv: state.investigators[0], source, context, state }), true)
  const api = recordingApi()
  reaction.resolve({ inv: state.investigators[0], source, context, api })
  assert.deepEqual(api.calls, [['revealSealedInstead', context, 'asset:sun']], '07272 改为揭示封印祝福，不获得资源')
})

test('验收 07267 伊恰克缺陷复现：弱点承载区只有投影计数、web 无渲染读点（未按承载区三处接线）', () => {
  assert.equal(ikiaq.code, '07267')
  // 规则本身：基础 +1，每个下方弱点 -1。
  const amount = ikiaq.modifiers[0].amount
  assert.equal(amount({ source: { capturedCards: [] } }), 1)
  assert.equal(amount({ source: { capturedCards: [{ code: '01023' }, { code: '01024' }] } }), -1, '07267 每个下方弱点 -1')
  // 承载区投影：publicCardInstance 把 capturedCards 折成 capturedCardCount。
  const projected = publicCardInstance({ id: 'a1', code: '07267', capturedCards: [{ code: '01023', seat: 0 }, { code: '01024', seat: 1 }] })
  assert.equal(projected.capturedCardCount, 2, '07267 弱点数量进入观察投影')
  assert.equal(projected.capturedCards, undefined, '原始承载区不直接下发')
  // 缺陷复现：web 侧没有任何 capturedCardCount 渲染读点（ARCHITECTURE §3.5 要求承载区三处接线）。
  const webSources = fs.readdirSync('web').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('web/' + f, 'utf8')).join('\n')
  assert.equal(webSources.includes('capturedCardCount'), false,
    '07267 缺陷复现：web/** 无 capturedCardCount 读点 → 玩家看不到伊恰克下方的弱点数量（应补展示登记 + i18n）')
})

test('验收 07273 净化腐败缺陷复现：新使用标记类型 corruption 未登记展示契约与词典', () => {
  assert.equal(purifying.code, '07273')
  assert.equal(purifying.uses, 0)
  assert.equal(purifying.usesType, 'corruption', '07273 使用「腐化」使用标记')
  const tableComponents = fs.readFileSync('web/table-components.js', 'utf8')
  assert.equal(/corruption\s*:/.test(tableComponents), false,
    '07273 缺陷复现：USE_TOKEN_DISPLAY 未登记 corruption（ARCHITECTURE §3.5 / AGENTS 要求新增使用标记类型同轮补展示登记 + 中英词典）')
  const locales = ['web/locales/zh-CN.table.js', 'web/locales/en.table.js']
  for (const file of locales) {
    const text = fs.readFileSync(file, 'utf8')
    assert.equal(/corruption/i.test(text), false, `${file} 无 corruption 文案（未登记词典）`)
  }
  // 行为本身可执行：取消显现 + 放置 1 个腐化，第 3 个腐化时移出游戏。
  const calls = []
  const source = { id: 'asset:purifying', code: '07273', uses: 2 }
  const api = {
    playerTools: { cancelRevelation: context => calls.push(['cancelRevelation', context]), removeAssetFromGame: (seat, id) => calls.push(['removeAssetFromGame', seat, id]) },
    addUses: (card, amount) => { card.uses += amount; calls.push(['addUses', amount]) },
    info: () => {},
  }
  const reaction = purifying.abilities[0]
  reaction.resolve({ inv: { seat: 0 }, source, context: { seat: 0 }, api })
  assert.deepEqual(calls, [['cancelRevelation', { seat: 0 }], ['addUses', 1], ['removeAssetFromGame', 0, 'asset:purifying']], '07273 第 3 个腐化时移出游戏')
})

test('验收 07280/07281/07282 缺陷复现：三张达贡幕的同一句印刷模板三份手写声明（原语/工厂未上收）', () => {
  const entries = [oathOne, oathTwo, oathThree]
  assert.deepEqual(entries.map(entry => entry.code), ['07280', '07281', '07282'])
  // ① 嫌犯修正三行模板逐字重复。
  for (const entry of entries) {
    assert.deepEqual(entry.modifiers.map(row => row.target), ['enemyHealth', 'loses:aloof', 'cannot:parley'],
      `${entry.code} 三行嫌犯修正模板`)
    assert.equal(typeof entry.modifiers[0].amount({ state: { numInvestigators: 3 } }), 'number')
  }
  // ② [fast] 花钥匙清屏障能力的印刷文本与费用逐字相同。
  const labels = entries.map(entry => entry.abilities[0].label)
  assert.equal(new Set(labels).size, 1, '三张幕的 [fast] 能力标签逐字相同（同句重复手写）')
  for (const entry of entries) {
    assert.deepEqual(entry.abilities[0].additionalKeyCost.colors, ['blue', 'red', 'white', 'yellow'])
    assert.equal(entry.abilities[0].actionKind, 'activate')
    assert.equal(typeof entry.abilities[0].resolve, 'function')
  }
  // ③ 行为可执行（说明只是复用债务、不是行为缺陷）：清掉所在地点的 Obstacle 附属。
  for (const entry of entries) {
    const calls = []
    const state = { locations: [{ id: 'loc:here', attachments: [{ code: '07299', originalCode: '07299' }] }] }
    const inv = { seat: 0, location: 'loc:here' }
    const api = { scenario: { detachEncounterAttachment: attachment => calls.push(['detach', attachment.code]) }, info: () => {} }
    entry.abilities[0].resolve({ state, inv, api })
    assert.deepEqual(calls, [['detach', '07299']], `${entry.code} [fast] 清屏障行为可执行`)
  }
  // ④ 三张幕都有各自的 objective/onReveal（行为在，问题只在模板复用）。
  for (const entry of entries) {
    assert.equal(typeof entry.actRule.objective, 'function')
    assert.equal(typeof entry.actRule.onReveal, 'function')
  }
})
