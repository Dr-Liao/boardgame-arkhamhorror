// 万象无终（TCU）第 2 步 P2.10 原语验收：遗留记忆 / 看守人 / 战役资产。
//
// 覆盖路线图 §4.1 的必测项：发现/划掉、数量分支、牌组、跨章。
// 三者都落在战役记录（纯 JSON）上：Memento 用 string[]、看守人用两个 string[]、
// 战役资产走 campaignCardChange 加入战役牌组（不占 30 张、下一章带入）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './core-fixture.mjs'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import {
  MEMENTOS, MEMENTO_RECORD, WATCHER_RECORD, WATCHER_TAKEN_RECORD, clearHunted, crossOffMemento,
  hasMemento, isBeingHunted, isMemento, markHunted, markTakenByWatcher, mementoCount,
  mementosDiscovered, recordMemento, takenByWatcher, watcherAndMementoProjection,
} from '../src/campaign/mementos.js'
import { campaignProjection } from '../src/cards/campaign-view.js'

function campaignFixture() {
  const state = fixture('01001', 1)
  return state
}

test('P2.10 Memento 词表：10 个稳定 id，未知 id 直接失败', () => {
  assert.equal(MEMENTOS.length, 10)
  assert.equal(new Set(MEMENTOS).size, 10)
  assert.equal(isMemento('mesmerizingFlute'), true)
  assert.equal(isMemento('nope'), false)
  assert.equal(MEMENTO_RECORD, 'mementosDiscovered')
})

test('P2.10 Memento：发现去重、划掉、数量分支', () => {
  const state = campaignFixture()
  assert.equal(mementoCount(state), 0)
  recordMemento(state, 'mesmerizingFlute')
  recordMemento(state, 'mesmerizingFlute')
  assert.deepEqual(mementosDiscovered(state), ['mesmerizingFlute'])
  assert.equal(hasMemento(state, 'mesmerizingFlute'), true)
  assert.equal(mementoCount(state), 1)
  recordMemento(state, 'bloodyTreeCarvings')
  assert.equal(mementoCount(state), 2)
  // 数量分支（幕间/结局按数量计分）。
  assert.equal(mementoCount(state) >= 2, true)
  crossOffMemento(state, 'mesmerizingFlute')
  assert.deepEqual(mementosDiscovered(state), ['bloodyTreeCarvings'])
  assert.throws(() => recordMemento(state, 'unknownRelic'), /未知的遗留记忆/)
  assert.throws(() => crossOffMemento(state, 'unknownRelic'), /未知的遗留记忆/)
})

test('P2.10 看守人：跨章的「被追捕 / 被带走」记录', () => {
  const state = campaignFixture()
  assert.equal(isBeingHunted(state, 0), false)
  markHunted(state, 0)
  assert.equal(isBeingHunted(state, 0), true)
  assert.equal(isBeingHunted(state, 1), false)
  clearHunted(state, 0)
  assert.equal(isBeingHunted(state, 0), false)
  markHunted(state, 0)
  markTakenByWatcher(state, '05046')
  assert.deepEqual(takenByWatcher(state), ['05046'])
  // 记录是纯 JSON：存档往返后仍在。
  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(isBeingHunted(restored, 0), true)
  assert.deepEqual(takenByWatcher(restored), ['05046'])
  assert.deepEqual(restored.campaign.records[WATCHER_RECORD], ['0'])
  assert.deepEqual(restored.campaign.records[WATCHER_TAKEN_RECORD], ['05046'])
})

test('P2.10 投影：Memento 与看守人是公开信息，非空时才出现', () => {
  const state = campaignFixture()
  assert.equal('mementos' in campaignProjection(state), false)
  assert.equal('watcher' in campaignProjection(state), false)
  recordMemento(state, 'wornCrucifix')
  markHunted(state, 0)
  markTakenByWatcher(state, '05047')
  assert.deepEqual(campaignProjection(state).mementos, ['wornCrucifix'])
  assert.deepEqual(campaignProjection(state).watcher, { huntedSeats: [0], taken: ['05047'] })
  assert.deepEqual(watcherAndMementoProjection(state), { mementos: ['wornCrucifix'], watcher: { huntedSeats: [0], taken: ['05047'] } })
})

test('P2.10 战役资产：addCampaignCardToDeck 加入战役牌组（每张卡一份）', () => {
  const state = campaignFixture()
  const seat = 0
  assert.ok(state.campaign.investigators[seat], 'fixture 应已登记战役身份')
  const before = state.campaign.investigators[seat].deck.length
  const code = '01006'
  const copies = state.campaign.investigators[seat].deck.filter(item => item === code).length
  applyCampaignEffect(state, { type: 'addCampaignCardToDeck', code, seat })
  assert.equal(state.campaign.investigators[seat].deck.length, before + 1)
  assert.equal(state.campaign.investigators[seat].deck.filter(item => item === code).length, copies + 1)
  // 牌组保持排序（campaignCardChange 的约定），下一章直接带入。
  assert.deepEqual([...state.campaign.investigators[seat].deck].sort(), state.campaign.investigators[seat].deck)
  assert.throws(() => applyCampaignEffect(state, { type: 'addCampaignCardToDeck' }), /需要卡号/)
  assert.throws(() => applyCampaignEffect(state, { type: 'addCampaignCardToDeck', code: '99999' }), /无效的战役卡牌变更/)
})

test('P2.10 战役资产：多人时按 seats 逐个加入', () => {
  const state = fixture('01001', 2)
  applyCampaignEffect(state, { type: 'addCampaignCardToDeck', code: '01006', seats: [0, 1] })
  for (const seat of [0, 1]) {
    assert.equal(state.campaign.investigators[seat].deck.includes('01006'), true)
  }
})
