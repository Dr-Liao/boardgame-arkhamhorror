// Phase 6 · 战役插件化第二批（stateSlice / project / agentHints）
//
// 契约：
//   1. 战役专属状态的**公开投影**由内容层提供（`campaignProjection`），observation 不再认字段；
//   2. 战役作者可以给 AI 写 `agentHints`（只写公开信息；没写就不进提示词）；
//   3. 两项都不得改变对局状态 —— replay 指纹必须逐条一致。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { campaignAgentHints, campaignProjection } from '../src/cards/campaign-view.js'
import { createCampaignState } from '../src/cards/campaign-state.js'

const ROOT = process.cwd()

test('战役投影：探索牌库只给张数、弃牌堆给内容', () => {
  const view = campaignProjection({
    explorationDeck: ['a', 'b', 'c'],
    explorationDiscard: ['d'],
    campaign: { id: 'theForgottenAge', records: {} },
  })
  assert.deepEqual(view.exploration, { deck: 3, discard: ['d'] })
  assert.equal(campaignProjection({ campaign: {} }).exploration.deck, 0)
})

test('战役投影：古代遗物 / 领队 / 复仇 / 伊格之怒字段名与旧投影一致', () => {
  const view = campaignProjection({
    relicOfAges: { code: '04061', location: 'chamberOfTime', seat: null },
    expeditionLeaderSeat: 2,
    victoryDisplay: [{ vengeance: 2 }, { vengeance: 0 }],
    campaign: { id: 'theForgottenAge', records: { yigsFury: 5 } },
  })
  assert.deepEqual(view.relicOfAges, { code: '04061', location: 'chamberOfTime', seat: null })
  assert.equal(view.expeditionLeaderSeat, 2)
  assert.equal(view.vengeance, 2)
  assert.equal(view.yigsFury, 5)
  // 领队回落到战役记录（旧存档只有 campaign.expeditionLeader）
  assert.equal(campaignProjection({ campaign: { expeditionLeader: 1 } }).expeditionLeaderSeat, 1)
})

test('战役投影：两个剧本的公开标记只在对应关卡出现', () => {
  assert.equal(campaignProjection({ campaign: {}, scenario: { id: 'theUntamedWilds' } }).threadsOfFate, undefined)
  const threads = campaignProjection({
    campaign: {},
    scenario: { id: 'threadsOfFate' },
    scenarioFlags: { alejandro: { code: '04051', location: 'townHall' }, ichtacasPrey: ['a'], ichtacasDestinations: ['b'] },
  })
  assert.deepEqual(threads.threadsOfFate.prey, ['a'])
  assert.deepEqual(threads.threadsOfFate.destinations, ['b'])
  assert.equal(threads.threadsOfFate.alejandro.location, 'townHall')
  const depths = campaignProjection({
    campaign: {},
    scenario: { id: 'theDepthsOfYoth' },
    scenarioFlags: { depthLevel: 3 },
    scenarioZones: { pursuit: ['x'], childrenOfValusia: ['y'] },
    agendas: [{ attachments: [{ code: '04061' }] }],
    agendaIndex: 0,
  })
  assert.equal(depths.depths.depthLevel, 3)
  assert.deepEqual(depths.depths.pursuit, ['x'])
  assert.deepEqual(depths.depths.agendaAttachments, ['04061'])
})

test('agentHints：战役清单里的提示原样给出；没有清单时为空', () => {
  const hints = campaignAgentHints({ campaign: { id: 'theForgottenAge' } })
  assert.ok(Array.isArray(hints) && hints.length >= 1, '失落的时代应有公开提示')
  assert.equal(campaignAgentHints({ campaign: { id: 'nightOfTheZealot' } }).length, 0)
  assert.equal(campaignAgentHints({}).length, 0)
})

test('观察投影不再自己认战役字段（插件化的机械守卫）', () => {
  const file = path.join(ROOT, 'src', 'integration', 'observation.js')
  const text = fs.readFileSync(file, 'utf8')
  for (const token of ['relicOfAges', 'yigsFury', 'expeditionLeaderSeat', 'threadsOfFate', 'theDepthsOfYoth', 'explorationDeck']) {
    assert.equal(text.includes(token), false, `observation.js 里不应再出现战役字段 ${token}`)
  }
})

test('stateSlice：字段名与形状保持不变，只把读写收进访问器', () => {
  const slice = createCampaignState()
  const state = { round: 3, currentSeat: 1 }
  const inv = { actionsLeft: 2 }
  // 打出折扣
  slice.setPlayDiscount(inv, 2)
  assert.equal(inv.carcosaPlayDiscount, 2, '字段名必须保持不变（进 stateHash）')
  assert.equal(slice.playDiscount(inv), 2)
  slice.clearPlayDiscount(inv)
  assert.equal(slice.playDiscount(inv), 0)
  // 本回合帷幕（写入回合/座位，跨回合失效）
  const loc = {}
  slice.setTurnShroudModifier(loc, state, -1)
  assert.deepEqual(loc.carcosaShroudModifier, { amount: -1, round: 3, turnSeat: 1 })
  assert.equal(slice.turnShroudModifier(loc, state), -1)
  assert.equal(slice.turnShroudModifier(loc, { round: 4, currentSeat: 1 }), 0)
  // 伤害加成（取用即清）/ 减伤
  const enemy = {}
  slice.setDamageBonus(enemy, state, 2)
  assert.equal(slice.consumeDamageBonus(enemy, state), 2)
  assert.equal(slice.consumeDamageBonus(enemy, state), 0)
  slice.setDamageReduction(enemy, 1)
  assert.equal(slice.damageReduction(enemy), 1)
  // 押注资源 / 演出奖励行动（同一 round:seat 只给一次）
  slice.addWager(inv, '02001', 3)
  assert.equal(slice.wager(inv, '02001'), 3)
  slice.clearWager(inv, '02001')
  assert.equal(slice.wager(inv, '02001'), 0)
  assert.equal(slice.grantActionGain(inv, state, 'asset1'), true)
  assert.equal(slice.grantActionGain(inv, state, 'asset1'), false)
  assert.equal(inv.actionsLeft, 3)
})

test('stateSlice：引擎模块不再直接读写这些战役字段（机械守卫）', () => {
  const fields = ['carcosaPlayDiscount', 'carcosaShroudModifier', 'carcosaActionGains',
    'carcosaWagers', 'tfaDamageBonus', 'tfaDamageReduction', 'tfaNoReadyRound', 'tfaRoundEndDiscard']
  const dir = path.join(ROOT, 'src', 'engine')
  const offenders = []
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.js')) continue
    const text = fs.readFileSync(path.join(dir, name), 'utf8')
    for (const field of fields) {
      if (text.includes(field)) offenders.push(`${name}: ${field}`)
    }
  }
  assert.deepEqual(offenders, [], '战役状态字段只允许出现在 src/cards/campaign-state.js')
})
