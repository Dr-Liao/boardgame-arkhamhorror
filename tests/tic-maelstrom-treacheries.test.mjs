// 07337 深海恐惧症（《暗潮之下》诡计）：
//   · 无人在淹没地点 → 涌动；否则部分淹没者 1 恐惧、完全淹没者 1 点不能防止的直接恐惧。
// 读点：treachery-tokens.js#entryRevelation → 条目 encounterResolve；返回 { gainSurge:true }
// 走引擎既有涌动抽取；floodLevel 读 flood.js；直接恐惧走 api.directHorror。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { floodLevel } from '../src/engine/flood.js'

function transaction(s, execute) {
  resolveTransaction(s, 0, { action: 'testTic07337' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, 'choice loop')
    const choice = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
const codeOf = entity => entity?.originalCode || entity?.code
const placeDefinition = (s, code) => {
  const key = Object.entries(s.scenario.locations)
    .find(([, definition]) => codeOf(definition) === code)?.[0]
  assert.ok(key, `scenario has no location ${code}`)
  transaction(s, draft => { scenarioRuntime(draft, []).place(key) })
  return s.locations.find(location => codeOf(location) === code)
}

function resolveThalassophobia(s) {
  let returned
  transaction(s, draft => {
    returned = registeredEntry('07337').encounterResolve(draft, draft.investigators[0], { code: '07337' },
      scenarioRuntime(draft, []))
  })
  return returned
}

test('07337：注册为 treachery 且实现', () => {
  const entry = registeredEntry('07337')
  assert.ok(entry)
  assert.equal(entry.scope, 'treachery')
  assert.equal(entry.implemented, true)
  assert.equal(typeof entry.encounterResolve, 'function')
})

test('07337：没有调查员在淹没地点 → 获得涌动', () => {
  const s = chapterFixture('intoTheMaelstrom', 2)
  const api = createMechanicsApi(s)
  for (const location of s.locations) api.water.set(location.id, 0)
  const returned = resolveThalassophobia(s)
  assert.deepEqual(returned, { gainSurge: true }, '无淹没者时返回涌动')
  for (const inv of s.investigators) {
    assert.equal(inv.horror, 0, '涌动分支不造成恐惧')
  }
  assert.ok(floodLevel(s, s.investigators[0].location) === 0)
})

test('07337：部分淹没 1 恐惧、完全淹没 1 直接恐惧（互不影响）', () => {
  const s = chapterFixture('intoTheMaelstrom', 2)
  const api = createMechanicsApi(s)
  const partial = s.locations.find(location => floodLevel(s, location.id) === 1)
  const full = placeDefinition(s, '07324')
  assert.ok(partial && full)
  assert.equal(floodLevel(s, full.id), 2, '07324 入场完全淹没')
  s.investigators[0].location = partial.id
  s.investigators[1].location = full.id
  const returned = resolveThalassophobia(s)
  assert.equal(returned, false, '有淹没者时不涌动')
  const horrorByName = new Map(s.investigators.map(inv => [inv.name, inv.horror]))
  assert.deepEqual([...horrorByName.values()].sort(), [1, 1], '两人各 1 点恐惧')
  assert.equal(s.investigators[0].damage, 0)
  assert.equal(s.investigators[1].damage, 0)
})
