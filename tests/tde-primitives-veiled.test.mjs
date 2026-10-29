// TDE P4：掩藏地点（location.veiled）的 Node 验收（按官方 rules.veiled 更正 P3 口径）。
//
// 官方规则（en 剧本来源 theSearchForKadath / pointOfNoReturn 的 rules.locations 与 rules.veiled）：
//   · 掩藏地点没有未揭示面，以已揭示面入场并按线索值放置线索；
//   · 位于该地点、且该地点上没有线索的调查员，可以作为一个 [fast] 能力把它翻面；
//   · 一旦翻面并读过故事文本，本局剩余时间不能再翻回。
// 所以「能否调查」不是关键词规则：有线索的掩藏地点照常可以调查，线索才是翻面的门槛。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canFlipVeiledLocation, flipVeiledLocation, isVeiledLocation, isVeiledRevealed,
  normalizeVeiledScenario, shuffleVeiledIntoDeck, veiledFlipBlockedReason, veiledLocationsOf,
} from '../src/engine/veiled.js'

const location = (overrides = {}) => ({ id: 'loc1', code: '06127', revealed: true, ...overrides })

test('识别 Veiled：字段、keywords、卡文首行', () => {
  assert.equal(isVeiledLocation({ veiled: true }), true)
  assert.equal(isVeiledLocation({ keywords: ['Veiled'] }), true)
  assert.equal(isVeiledLocation({ text: 'Veiled. Forced - After you enter…' }), true)
  assert.equal(isVeiledLocation({ text: 'Hunter. Alert.' }), false)
  assert.equal(isVeiledLocation(null), false)
})

test('掩藏地点以已揭示面入场：revealed=true 不影响翻面，线索才是门槛', () => {
  const loc = location({ veiled: true, revealed: true })
  assert.equal(canFlipVeiledLocation(loc), true)
  assert.equal(veiledFlipBlockedReason(loc), null)
  // 有线索 → 不能翻面；线索被调查干净 → 可以翻面。
  assert.equal(veiledFlipBlockedReason(loc, 2), '地点上还有线索')
  assert.equal(canFlipVeiledLocation(loc, 0), true)
  // 地点实例自己记着线索时也能判。
  assert.equal(canFlipVeiledLocation(location({ veiled: true, clues: 1 })), false)
})

test('翻面：[fast] 能力，被阻止时返回原因而不是抛错', () => {
  const loc = location({ veiled: true, clues: 1 })
  const state = { locations: [loc] }
  assert.deepEqual(flipVeiledLocation(state, 'loc1'), { changed: false, storyCode: null, reason: '地点上还有线索' })
  assert.equal(loc.veiledRevealed, undefined)
  loc.clues = 0
  assert.deepEqual(flipVeiledLocation(state, 'loc1'), { changed: true, storyCode: null, reason: null })
  assert.equal(loc.veiledRevealed, true)
  // 翻过一次后本局不能再翻。
  assert.deepEqual(flipVeiledLocation(state, 'loc1'), { changed: false, storyCode: null, reason: '已经翻面' })
})

test('普通地点不受影响（行为零变化）', () => {
  const loc = location({ code: '01001' })
  assert.equal(veiledFlipBlockedReason(loc), '不是掩藏地点')
  const state = { locations: [loc] }
  assert.deepEqual(flipVeiledLocation(state, 'loc1'), { changed: false, storyCode: null, reason: '不是掩藏地点' })
  assert.equal('veiledRevealed' in loc, false)
})

test('翻面带出背面故事卡卡号', () => {
  const loc = location({ veiled: true, backCode: '06129b' })
  const state = { locations: [loc] }
  assert.equal(flipVeiledLocation(state, 'loc1').storyCode, '06129b')
  assert.equal(loc.storyCode, '06129b')
  const viaLink = location({ id: 'loc2', veiled: true, linkedToCode: '06254b' })
  const state2 = { locations: [viaLink] }
  assert.equal(flipVeiledLocation(state2, 'loc2').storyCode, '06254b')
})

test('翻面后洗回遭遇牌堆：地点移出、卡号入堆', () => {
  const loc = location({ veiled: true, veiledRevealed: true, originalCode: '06254' })
  const state = { locations: [loc], encounterDeck: ['x'] }
  assert.deepEqual(shuffleVeiledIntoDeck(state, 'loc1'), { moved: true, code: '06254', deck: 'encounter' })
  assert.deepEqual(state.encounterDeck, ['x', '06254'])
  assert.equal(state.locations.length, 0)
})

test('未翻面不能洗回；未知牌堆/地点抛错', () => {
  const state = { locations: [location({ veiled: true })] }
  assert.throws(() => shuffleVeiledIntoDeck(state, 'loc1'), /未翻面/)
  assert.throws(() => shuffleVeiledIntoDeck(state, 'nope'), /地点不存在/)
  assert.throws(() => shuffleVeiledIntoDeck(state, 'loc1', 'library'), /未知牌堆/)
})

test('注册期校验：缺背面故事卡且未声明 shuffleBack 时报 missing', () => {
  const scenario = {
    locations: [
      { code: '06127', veiled: true, backCode: '06127b' },
      { code: '06254', veiled: true, shuffleBack: true },
      { code: '06257', veiled: true },
      { code: '01001' },
    ],
  }
  assert.deepEqual(normalizeVeiledScenario(scenario), { total: 3, withStory: 1, shuffleBack: 1, missing: ['06257'] })
  assert.deepEqual(normalizeVeiledScenario({ locations: [] }), { total: 0, withStory: 0, shuffleBack: 0, missing: [] })
})

test('veiledLocationsOf 只返回 Veiled 地点；isVeiledRevealed 默认 false', () => {
  const state = { locations: [location({ veiled: true }), location({ id: 'loc2' })] }
  assert.deepEqual(veiledLocationsOf(state).map(loc => loc.id), ['loc1'])
  assert.equal(isVeiledRevealed(location({ veiled: true })), false)
  assert.equal(isVeiledRevealed({ veiledRevealed: true }), true)
})
