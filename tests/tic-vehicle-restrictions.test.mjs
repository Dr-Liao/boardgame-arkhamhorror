// 载具限制：07183 追猎的深潜者（交战期间不能进入载具/获得资源）与 07188 拖入水底（威胁区禁止进入载具）。
//
// 两条声明共用同一处判定：
//   · `enemyRule.engagedRestrictions: ['enterVehicle','gainResources']` —— 敌方持续限制，
//     读点是 enemy-entry.js#enemyEngagedRestricts，接在 vehicles.js#vehicleAccessError（只禁进入）
//     与 resource-bank.js#gainResource；
//   · `treacheryRule.forbidsVehicles: true` —— 威胁区卡声明，读点同在 vehicleAccessError。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { executeDescriptor, legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { enemy, move, settle } from './core-fixture.mjs'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'

const boatOf = s => (s.storyAssets || []).find(asset => asset.code === '07178')
function transaction(s, execute, select = () => null) {
  resolveTransaction(s, 0, { action: 'testTicVehicleRestrictions' }, execute)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 40, `choice loop ${s.pendingChoice.kind}`)
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(option => choice.options.some(item => item.id === option))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
function reveal(s, code, select = () => null) {
  const entry = registeredEntry(code)
  assert.ok(entry?.encounterResolve, `${code} 必须有 encounterResolve`)
  transaction(s, draft => entry.encounterResolve(draft, draft.investigators[0], { code, name: code },
    scenarioRuntime(draft, [], { type: 'encounter', code })), select)
}
const gain = (s, amount = 3, seat = 0) => {
  let result
  executeDescriptor(s, { inv: s.investigators[seat], source: null, events: [],
    descriptor: { code: '01016', label: '获得资源探针', resolve: ({ api }) => { result = api.gainResources(seat, amount) } } })
  return result
}

test('07183 追猎的深潜者：交战期间不能进入载具，也不能获得资源；解除交战即恢复', () => {
  const s = chapterFixture('devilReef', 1)
  const boat = boatOf(s)
  const api = createMechanicsApi(s)
  api.vehicles.leave(0, boat.id, { forced: true })
  const deepOne = enemy(s, { code: '07183', engagedSeat: 0, health: 9, traits: ['Humanoid', 'Monster', 'Deep One'] })
  s.investigators[0].engaged = [deepOne.id]
  s.investigators[0].resources = 10
  assert.match(String(api.vehicles.accessError(0, boat.id)), /不能进入载具/)
  assert.equal(api.vehicles.enter(0, boat.id), false)
  gain(s, 3)
  assert.equal(s.investigators[0].resources, 10, '交战期间不能获得资源')

  s.enemies = []
  s.investigators[0].engaged = []
  gain(s, 3)
  assert.equal(s.investigators[0].resources, 13, '解除交战后照常获得资源')
  assert.equal(createMechanicsApi(s).vehicles.enter(0, boat.id), true)
})

test('07183 追猎的深潜者：交战后不在载具上失去 2 资源，在载具上则被迫离开', () => {
  const offBoard = chapterFixture('devilReef', 1)
  const boat = boatOf(offBoard)
  createMechanicsApi(offBoard).vehicles.leave(0, boat.id, { forced: true })
  offBoard.investigators[0].resources = 5
  const entry = registeredEntry('07183')
  transaction(offBoard, draft => entry.abilities[0].resolve({ inv: draft.investigators[0], source: { id: 'e9', code: '07183' },
    api: { mechanics: createMechanicsApi(draft), loseResources: (seat, amount) => { draft.investigators[seat].resources -= amount } } }))
  assert.equal(offBoard.investigators[0].resources, 3, '不在载具上：失去 2 资源')

  const aboard = chapterFixture('devilReef', 1)
  const aboardBoat = boatOf(aboard)
  aboard.investigators[0].resources = 5
  transaction(aboard, draft => entry.abilities[0].resolve({ inv: draft.investigators[0], source: { id: 'e9', code: '07183' },
    api: { mechanics: createMechanicsApi(draft), loseResources: (seat, amount) => { draft.investigators[seat].resources -= amount } } }))
  assert.deepEqual(aboard.scenarioFlags.mechanics.vehicles[aboardBoat.id].passengers, [], '在载具上：被迫离开')
  assert.equal(aboard.investigators[0].resources, 5, '离开载具时不失去资源')
})

test('07188 拖入水底：进入威胁区、被迫离开载具，且此后不能进入载具', () => {
  const s = chapterFixture('devilReef', 1)
  const boat = boatOf(s)
  reveal(s, '07188')
  assert.deepEqual(s.investigators[0].threat.map(card => card.code), ['07188'])
  assert.deepEqual(s.scenarioFlags.mechanics.vehicles[boat.id].passengers, [], '显现时被迫离开载具')
  assert.match(String(createMechanicsApi(s).vehicles.accessError(0, boat.id)), /不能进入载具/)
})

test('07188 拖入水底：战斗(3)或敏捷(3)检定成功弃掉本卡后可以再进入载具', () => {
  const s = chapterFixture('devilReef', 1)
  const boat = boatOf(s)
  reveal(s, '07188')
  const actionFor = state => legalMoves(state).find(command => command.action === 'ability'
    && (state.investigators[0].threat || []).some(card => card.id === command.assetId))
  s.chaosBag = ['+5']
  move(s, actionFor(s))
  settle(s, choice => choice.options.some(option => option.id === 'agility') ? 'agility' : null)
  assert.deepEqual(s.investigators[0].threat, [], '检定成功弃掉本卡')
  assert.equal(createMechanicsApi(s).vehicles.enter(0, boat.id), true, '限制随卡离场消失')
})

test('载具限制声明在注册期校验形状', () => {
  assert.throws(() => registerCardAbilities([{ code: 'ticBadEngagedProbe', scope: 'enemy',
    enemyRule: { engagedRestrictions: ['fly'] }, abilities: [] }]), /engaged restriction/i)
  assert.throws(() => registerCardAbilities([{ code: 'ticBadVehicleProbe', scope: 'treachery',
    treacheryRule: { forbidsVehicles: 'yes' }, abilities: [] }]), /vehicle restriction/i)
})
