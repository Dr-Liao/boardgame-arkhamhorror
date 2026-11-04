// 回归：真实遭遇抽取必须把「调查员所在地点」作为第 5 参传给单卡条目的 encounterResolve。
//
// 背景：01168（朦胧之雾）、04076/04088/04093、03091/03094、03262 等共享/核心条目声明
//   encounterResolve(state, inv, card, api, { location })
// 而 treachery-tokens.js#resolveTreacheryBody 之前只传 4 参，导致这些卡一旦被真实遭遇抽到就抛
//   TypeError: Cannot destructure property 'location' of 'undefined'
// 原有测试直接调用条目或走别名，从未覆盖「真实抽牌 → 条目结算」链路，因此漏检。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './core-fixture.mjs'
import { drawEncounter } from '../src/engine/engine.js'

test('真实遭遇抽取把所在地点作为第 5 参传入 encounterResolve（01168 不再崩溃且正确附属）', () => {
  const state = fixture()
  state.encounterDeck = ['01168']
  drawEncounter(state, state.investigators[0], [])
  const location = state.locations.find(entry => entry.id === state.investigators[0].location)
  assert.equal(location.fogCode, '01168', '朦胧之雾应以帷幕形式附属到调查员所在地点')
  assert.equal(location.shroudMod, 2, '每张朦胧之雾 +2 隐藏值')
})
