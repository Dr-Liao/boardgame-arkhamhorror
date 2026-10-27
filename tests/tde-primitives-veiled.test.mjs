// TDE P3 批次 2：掩藏地点（location.veiled）的 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isVeiledLocation, isVeiledRevealed, normalizeVeiledScenario, revealVeiledLocation,
  shuffleVeiledIntoDeck, veiledBlocksInvestigation, veiledLocationsOf,
} from '../src/engine/veiled.js'

const location = (overrides = {}) => ({ id: 'loc1', code: '06127', revealed: false, ...overrides })

test('识别 Veiled：字段、keywords、卡文首行', () => {
  assert.equal(isVeiledLocation({ veiled: true }), true)
  assert.equal(isVeiledLocation({ keywords: ['Veiled'] }), true)
  assert.equal(isVeiledLocation({ text: 'Veiled. Forced - After you enter…' }), true)
  assert.equal(isVeiledLocation({ text: 'Hunter. Alert.' }), false)
  assert.equal(isVeiledLocation(null), false)
})

test('未揭示的 Veiled 地点禁止调查；翻面后放行', () => {
  const loc = location({ veiled: true })
  assert.equal(veiledBlocksInvestigation(loc), true)
  const state = { locations: [loc], encounterDeck: [] }
  const result = revealVeiledLocation(state, 'loc1')
  assert.deepEqual(result, { changed: true, storyCode: null })
  assert.equal(loc.veiledRevealed, true)
  assert.equal(veiledBlocksInvestigation(loc), false)
  assert.equal(revealVeiledLocation(state, 'loc1').changed, false)
})

test('普通地点不受影响（行为零变化）', () => {
  const loc = location({ code: '01001' })
  assert.equal(veiledBlocksInvestigation(loc), false)
  const state = { locations: [loc] }
  assert.deepEqual(revealVeiledLocation(state, 'loc1'), { changed: false, storyCode: null })
})

test('翻面带出背面故事卡卡号', () => {
  const loc = location({ veiled: true, backCode: '06129b' })
  const state = { locations: [loc] }
  assert.equal(revealVeiledLocation(state, 'loc1').storyCode, '06129b')
  assert.equal(loc.storyCode, '06129b')
  const viaLink = location({ id: 'loc2', veiled: true, linkedToCode: '06254b' })
  const state2 = { locations: [viaLink] }
  assert.equal(revealVeiledLocation(state2, 'loc2').storyCode, '06254b')
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
