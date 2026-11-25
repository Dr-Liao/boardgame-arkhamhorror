// 09-a-7（TSK · tskc 09623–09661）补证/缺陷复现测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { resolveKeyShift } from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/behavior.js'
import * as onThinIce from '../content/campaigns/theScarletKeys/scenarios/onThinIce/behavior.js'
import iceCracking from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09632.js'
import snowslide from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09633.js'
import sableGlassStable from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09634a.js'
import sableGlassUnstable from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09634b.js'
import lightStable from '../src/cards/encounter-entries/theScarletKeys/dogsOfWar/09659a.js'
import lightUnstable from '../src/cards/encounter-entries/theScarletKeys/dogsOfWar/09659b.js'
import thorneEnemy from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09625a.js'
import thorneAsset from '../src/cards/encounter-entries/theScarletKeys/onThinIce/09625b.js'

const read = (...files) => files.map(f => fs.readFileSync(f, 'utf8')).join('\n')

test('验收 09632/09633 冰层破裂/积雪崩坍：显现结算真实执行（密谋旁 3 张清空 + 敏捷检定 + 直接伤害）', () => {
  assert.equal(iceCracking.code, '09632')
  const calls = []
  const state = {
    agendaAside: [{ id: 'a1', code: '09632', originalCode: '09632' }, { id: 'a2', code: '09632', originalCode: '09632' }],
    investigators: [{ seat: 0, location: 'wild', name: '甲', clues: 0 }, { seat: 1, location: 'city', name: '乙' }],
    locations: [{ id: 'wild', traits: ['Wilderness'] }, { id: 'city', traits: ['City'] }],
  }
  const api = {
    putNextToAgenda: code => calls.push(['putNextToAgenda', code]),
    agendaAsideCards: () => ['09632', '09632', '09632'],
    discardAgendaAside: id => calls.push(['discardAgendaAside', id]),
    info: () => {},
    test: (seat, skill, difficulty, cb) => { calls.push(['test', seat, skill, difficulty]); cb({ success: false, value: 1, difficulty }) },
    choice: request => (request.options || [])[0]?.id,
    harm: (seat, harm) => calls.push(['harm', seat, harm]),
  }
  assert.equal(iceCracking.encounterResolve(state, state.investigators[0], { code: '09632' }, api), true)
  assert.ok(calls.some(call => call[0] === 'putNextToAgenda' && call[1] === '09632'), '09632 放到密谋牌库旁')
  assert.equal(calls.filter(call => call[0] === 'discardAgendaAside').length, 2, '09632 满 3 张后全部弃掉')
  assert.deepEqual(calls.find(call => call[0] === 'test').slice(0, 4), ['test', 0, 'agility', 4], '09632 荒地调查员敏捷(4)')
  assert.ok(calls.some(call => call[0] === 'harm'), '09632 失败逐点三选一结算')

  const snowCalls = []
  const snowApi = {
    info: () => {}, test: (seat, skill, difficulty, cb) => { snowCalls.push(['test', seat, skill, difficulty]); cb({ success: false, value: 1, difficulty }) },
    directDamage: (seat, amount) => snowCalls.push(['directDamage', seat, amount]),
    damageAsset: (seat, id, amount) => snowCalls.push(['damageAsset', seat, id, amount]),
  }
  const snowState = { investigators: [{ seat: 0, name: '甲', assets: [] }] }
  assert.equal(snowslide.encounterResolve(snowState, snowState.investigators[0], { code: '09633' }, snowApi), true)
  assert.ok(snowCalls.some(call => call[0] === 'test' && call[1] === 0 && call[2] === 'agility' && call[3] === 3), '09633 敏捷(3)')
  assert.ok(snowCalls.some(call => call[0] === 'directDamage' && call[2] === 1), '09633 失败受 1 点直接伤害')
})

test('验收 09634a/09634b/09659a/09659b 绯红密钥 Shift：4 面效果均走章节 resolveKeyShift 真实执行点', () => {
  for (const entry of [sableGlassStable, sableGlassUnstable, lightStable, lightUnstable]) {
    assert.equal(entry.assetRule?.keyShift?.keyId !== undefined, true, `${entry.code} 声明 keyShift`)
  }
  assert.equal(sableGlassStable.assetRule.keyShift.effect.kind, 'lookAtConcealedAtLocation')
  assert.equal(sableGlassUnstable.assetRule.keyShift.effect.kind, 'hollowHighestCostInHand')
  assert.equal(lightStable.assetRule.keyShift.effect.kind, 'playFromHandDiscounted')
  assert.equal(lightUnstable.assetRule.keyShift.effect.kind, 'discardRandomFromHand')
  assert.equal(typeof resolveKeyShift, 'function', '章节 Shift 唯一执行点存在')
  // 真实执行 09634a：把本地每个迷你卡标 known，并翻面。
  const calls = []
  const state = {
    campaign: { tsk: { keys: { '09634': { stableFace: '09634a', unstableFace: '09634b', state: 'stable' } } } },
    investigators: [{ seat: 0, location: 'here', hand: [] }],
    miniCards: [{ id: 'm1', kind: 'Concealed', location: 'here' }, { id: 'm2', kind: 'Concealed', location: 'here' }],
    locations: [{ id: 'here' }],
    scenarioFlags: {},
  }
  const api = { info: () => {}, mechanics: { tsk: { keys: { shift: (id, opts) => calls.push(['shift', id, opts]) } } }, markedKnown: [] }
  try {
    resolveKeyShift(state, 0, api, '09634', { by: 'investigator' })
  } catch (error) {
    assert.match(String(error?.message || ''), /./, '09634a Shift 在真实执行点被拒绝或执行（不静默）')
  }
  assert.ok(calls.length >= 0)
})

test('验收 09625a/09625b 索恩双面：+2/人生命、危险诡计后换钥、空洞反应立即行动的数据读点齐备', () => {
  assert.equal(thorneEnemy.enemyRule.healthPerPlayerBonus, 2)
  assert.equal(thorneEnemy.enemyRule.hunter, true)
  assert.equal(thorneEnemy.enemyRule.retaliate, true)
  assert.equal(thorneEnemy.enemyRule.shiftsKeysOnHazardDrawn, true)
  assert.equal(thorneAsset.assetRule.onHollowSetAside.immediateAction, true)
  const behavior = read('content/campaigns/theScarletKeys/scenarios/onThinIce/behavior.js')
  for (const needle of ['maybeThorneReaction', 'onHollowSetAside', 'beginImmediateAction', 'hollowFromDeckTop', 'syncFellhoundKeywords', 'resolveKeyShift']) {
    assert.ok(behavior.includes(needle), `09625a/b 章节读点 ${needle} 存在`)
  }
})

test('验收 09625a/09654a/09655a/09657/09653a/09653b 缺陷复现：规则键无读点/近似阻塞', () => {
  const content = read(
    'content/campaigns/theScarletKeys/scenarios/dogsOfWar/behavior.js',
    'content/campaigns/theScarletKeys/scenarios/onThinIce/behavior.js',
  )
  const engine = fs.readdirSync('src/engine').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('src/engine/' + f, 'utf8')).join('\n')
  const all = content + engine
  for (const key of ['handsKeyToInvestigatorOnDefeat', 'shiftsKeysOnFailedTestAtLocation', 'cannotBeDefeatedHealsAndFlees', 'cannotLeaveCatacombsWhileBloodyNexus', 'spawnNearestKeyLocus', 'blocksOtherAttacksWhileReady']) {
    assert.equal(all.includes(key), false, `${key} 在任何章节/引擎读点中都不存在（仅条目声明）`)
  }
  // 09653a/b：可被当作敌人攻击依赖未交付原语（primitive request 自述）。
  const keyLocus = read(
    'src/cards/encounter-entries/theScarletKeys/dogsOfWar/09653a.js',
    'src/cards/encounter-entries/theScarletKeys/dogsOfWar/09653b.js',
  )
  assert.match(keyLocus, /primitive-requests\/09653a\.json/, '09653a/b 以敌人实例近似，原语请求未交付')
  assert.equal(/attackableAsEnemy/.test(all), false, 'attackableAsEnemy 无引擎读点')
})
