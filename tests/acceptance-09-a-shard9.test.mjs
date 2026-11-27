// 09-a-9（TSK · tskc 09696–09736）补证/缺陷复现测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { enemy, fixture, move, settle } from './core-fixture.mjs'
import { enemyEvadeValue, enemyFightValue, scenarioRuntime, spawnEnemy } from '../src/engine/engine.js'
import { withEffectSource } from '../src/engine/effect-provenance.js'
import { resolveTransaction } from '../src/engine/resolution.js'

import { behavior as congress } from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/behavior.js'
import { behavior as dancingMad } from '../content/campaigns/theScarletKeys/scenarios/dancingMad/behavior.js'
import * as congressDef from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/definition.js'
import conspiracy from '../src/cards/encounter-entries/theScarletKeys/_shared/crimson_conspiracy/09717.js'
import knives from '../src/cards/encounter-entries/theScarletKeys/_shared/shadow_of_a_doubt/09722.js'
import enforcerA from '../src/cards/encounter-entries/theScarletKeys/_shared/cleanup_crew/09726a.js'
import enforcerB from '../src/cards/encounter-entries/theScarletKeys/_shared/cleanup_crew/09726b.js'
import assassinA from '../src/cards/encounter-entries/theScarletKeys/_shared/cleanup_crew/09727a.js'
import assassinB from '../src/cards/encounter-entries/theScarletKeys/_shared/cleanup_crew/09727b.js'
import keyCharge from '../src/cards/encounter-entries/theScarletKeys/_shared/scarlet_sorcery/09730.js'
import paracausal from '../src/cards/encounter-entries/theScarletKeys/_shared/outsiders/09731.js'

const tree = (root = 'src/cards/encounter-entries/theScarletKeys') => {
  const out = []
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = d + '/' + e.name
      if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) out.push(p)
    }
  }
  walk(root)
  return out
}
const files = tree()
const findEntry = code => files.find(f => f.endsWith('/' + code + '.js'))
const engineText = () => fs.readdirSync('src/engine').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('src/engine/' + f, 'utf8')).join('\n')

test('验收 09696/09697/09698/09699/09700/09701/09702/09703/09704/09705/09706/09707/09708/09709/09710/09711/09712/09713/09714 国会大厦：每张卡在章节 definition/behavior 有承接（数据/读点存在）', () => {
  const defText = fs.readFileSync('content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/definition.js', 'utf8')
  for (const code of ['09696', '09697', '09698', '09699', '09700', '09701', '09702', '09703', '09704', '09705', '09706', '09707', '09708', '09709', '09710', '09711', '09712', '09713', '09714']) {
    assert.ok(defText.includes(code), `${code} 在 congress definition`)
    assert.ok(findEntry(code), `${code} 单卡条目存在`)
  }
  for (const hook of ['agendaReveal', 'actReveal', 'checkObjectives', 'actions', 'performAction']) {
    assert.equal(typeof congress[hook], 'function', `congress behavior.${hook} 读点`)
  }
  assert.ok(congressDef.scenario && typeof congressDef.scenario === 'object', '章节数据可导入')
})

test('验收 09717/09721/09722 共享诡计：真实条目导入 + 执行入口 + tskExposed 窗口读点', () => {
  assert.equal(conspiracy.code, '09717')
  assert.equal(typeof conspiracy.encounterResolve, 'function', '09717 显现结算入口')
  assert.equal(knives.code, '09722')
  assert.equal(typeof knives.encounterResolve, 'function', '09722 显现结算入口')
  const state = { investigators: [{ seat: 0, threat: [] }] }
  const api = { info: () => {}, threat: (seat, code) => state.investigators[0].threat.push({ code, originalCode: code, id: 't1' }) }
  assert.equal(knives.encounterResolve(state, state.investigators[0], { code: '09722' }, api), true)
  assert.equal(state.investigators[0].threat.length, 1, '09722 进入威胁区')
  assert.deepEqual(knives.encounterResolve(state, state.investigators[0], { code: '09722' }, api), { gainSurge: true }, '09722 已存在时涌动')
  assert.ok(findEntry('09721'), '09721 条目文件存在')
  assert.ok(engineText().includes("'tskExposed'"), 'P1-1：tskExposed 窗口引擎派发读点存在')
})

test('验收 09726a/09726b/09727a/09727b/09730/09731 红衣结社与共享敌人：条目规则/能力声明齐备', () => {
  for (const entry of [enforcerA, enforcerB, assassinA, assassinB, paracausal]) {
    assert.equal(entry.scope, 'enemy', `${entry.code} 敌人条目`)
    assert.ok(Object.keys(entry).length > 3, `${entry.code} 含规则/能力声明`)
  }
  assert.equal(keyCharge.scope, 'treachery', '09730 诡计条目')
  const engine = engineText()
  assert.ok(engine.includes('tskKeyShifted') || engine.includes('keys.shift'), 'Shift 派发读点存在')
})

for (const code of ['09716a', '09716b', '09716c']) {
  test(`验收 ${code} 结社特工：共同入阴影流程只放 1 毁灭，揭露可弃掉真身`, () => {
    const state = fixture()
    const inv = state.investigators[0]
    const api = scenarioRuntime(state, [])
    const agent = spawnEnemy(state, code, inv.location, null)
    assert.equal(agent.location, null)
    assert.equal(agent.doom, 1)
    const cards = api.mechanics.tsk.concealed.miniCards()
    assert.equal(cards.filter(card => card.decoy).length, 2)
    const actual = cards.find(card => card.code === code)
    assert.equal(actual.decoy, false)

    inv.location = actual.locationId
    state.locations.find(location => location.id === inv.location).shroud = 0
    move(state, { action: 'fightConcealed', miniId: actual.id, locationId: actual.locationId })
    settle(state, choice => choice.options.find(option => option.label?.includes('结社特工揭露时'))?.id)
    assert.equal(state.enemies.some(item => item.id === agent.id), false)
    assert.ok(state.encounterDiscard.includes(code))
  })
}

test('验收 09716a 疯星乱舞：旧式迷你卡揭露时呈现场上真身，可触发弃置反应且不会重新隐匿', () => {
  const state = fixture()
  state.scenario.id = 'dancingMad'
  const inv = state.investigators[0]
  const mini = scenarioRuntime(state, []).mechanics.tsk.concealed.place({
    kind: 'CoterieAgentA', code: '09716a', locationId: inv.location,
  })
  const expose = draft => dancingMad.exposeMiniCard(draft, draft.investigators[0], mini.id, scenarioRuntime(draft, []))
  resolveTransaction(state, 0, { action: 'revealDancingMadAgent' }, expose)
  assert.ok(state.pendingChoice?.options.some(option => option.label?.includes('结社特工揭露时')))
  while (state.pendingChoice) {
    const choice = state.pendingChoice
    const optionId = choice.options.find(option => option.label?.includes('结社特工揭露时'))?.id ?? choice.options[0].id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, expose)
  }
  assert.ok(state.encounterDiscard.includes('09716a'))
  assert.equal(state.enemies.some(item => item.code === '09716a'), false)
  assert.equal(scenarioRuntime(state, []).mechanics.tsk.concealed.miniCards().length, 0)
})

test('验收 09720 结社代表：重整时拒绝同地玩家卡揭露，仍允许普通揭露或横置后的玩家卡揭露', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const api = scenarioRuntime(state, [])
  const envoy = enemy(state, { code: '09720' })
  const concealed = api.mechanics.tsk.concealed
  const uncover = card => withEffectSource(state, { kind: 'playerCard', code: '01022' },
    () => concealed.expose(card.id, { seat: 0 }))
  const one = concealed.place({ kind: 'decoy', decoy: true, locationId: inv.location })
  assert.equal(uncover(one).cancelled, true)
  assert.ok(concealed.byId(one.id))
  assert.equal(concealed.expose(one.id, { seat: 0 }).decoy, true)

  const two = concealed.place({ kind: 'decoy', decoy: true, locationId: inv.location })
  envoy.exhausted = true
  assert.equal(uncover(two).decoy, true)
  assert.equal(concealed.byId(two.id), null)
})

test('验收 09729 身染猩红：附属时宿主攻击和躲避各 +1，移除附属后恢复', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const host = enemy(state, { fight: 3, evade: 2, traits: ['Coterie'] })
  const api = scenarioRuntime(state, [])
  const before = [enemyFightValue(state, host, inv), enemyEvadeValue(state, host, inv)]
  api.drawEncounter(0, { code: '09729' })
  assert.ok(host.attachments.some(card => card.code === '09729'))
  assert.deepEqual([enemyFightValue(state, host, inv), enemyEvadeValue(state, host, inv)], before.map(value => value + 1))
  api.discardAttachment(host.attachments[0])
  assert.deepEqual([enemyFightValue(state, host, inv), enemyEvadeValue(state, host, inv)], before)
})

test('验收 09732 天启噩兆：选用反应时弃掉敌人并回收空洞，跳过反应时加入胜利区', () => {
  for (const accept of [false, true]) {
    const state = fixture()
    const presage = enemy(state, { code: '09732', name: '天启噩兆', victory: 1, health: 1, fight: 0 })
    scenarioRuntime(state, []).mechanics.tsk.hollow.hollow({ code: '01020', scope: 'investigator', seat: 0 })
    move(state, { action: 'fight', enemyId: presage.id })
    settle(state, choice => accept ? choice.options.find(option =>
      option.label?.includes('选择至多 3 张空洞') || option.id === '01020')?.id : null)
    assert.equal(state.victoryDisplay.some(card => (card.originalCode || card.code) === '09732'), !accept)
    assert.equal(state.encounterDiscard.includes('09732'), accept)
    assert.equal(state.investigators[0].hand.includes('01020'), accept)
  }
})

test('验收 09718/09719/09723/09724/09725/09728/09733/09734/09735/09736 共享遭遇：条目文件与执行入口齐备', () => {
  for (const code of ['09718', '09719', '09723', '09724', '09725', '09728', '09733', '09734', '09735', '09736']) {
    const file = findEntry(code)
    assert.ok(file, `${code} 条目文件存在`)
    const body = fs.readFileSync(file, 'utf8')
    assert.ok(/encounterResolve|abilities:\s*\[/.test(body), `${code} 有执行入口`)
  }
})
