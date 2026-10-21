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
