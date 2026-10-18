import test from 'node:test'
import assert from 'node:assert/strict'
import { handleApi } from '../src/integration/web-api.js'
import { scenarioCardCodes } from '../src/integration/scenario-images.js'

const get = path => handleApi({ path, searchParams: new URLSearchParams() })

test('关卡卡图清单覆盖剧本参考、密谋、场景、地点与遭遇牌，参考与密谋优先', () => {
  const codes = scenarioCardCodes('theGathering')
  assert.equal(codes[0], '01104')
  assert.deepEqual(codes.slice(1, 7), ['01105', '01106', '01107', '01108', '01109', '01110'])
  for (const code of ['01111', '01115', '01116', '01117', '01159', '01168']) assert.ok(codes.includes(code), code)
  assert.equal(new Set(codes).size, codes.length)

  const carcosa = scenarioCardCodes('curtainCall')
  for (const code of ['03043', '03044', '03047a', '03049', '03058', '03059', '03060']) assert.ok(carcosa.includes(code), code)
})

test('关卡卡图接口下发图鉴同款描述符，并拒绝未知或非法关卡', () => {
  const response = get('scenarios/theMidnightMasks/images')
  assert.equal(response.body.scenarioId, 'theMidnightMasks')
  assert.ok(response.body.cards.length > 20)
  for (const entry of response.body.cards) {
    assert.ok(Array.isArray(entry.images.front.candidates) && Array.isArray(entry.images.back.candidates), entry.code)
  }
  assert.equal(get('scenarios/unknownScenario/images').status, 404)
  assert.equal(get('scenarios/..%2F/images').status, 400)
})
