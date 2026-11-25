// 09-a-9（TSK · tskc 09696–09736）补证/缺陷复现测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { behavior as congress } from '../content/campaigns/theScarletKeys/scenarios/congressOfTheKeys/behavior.js'
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

test('验收 09716a/09716b/09716c/09720/09729/09732 缺陷复现：三份独立实现/声明读点缺失', () => {
  const texts = ['09716a', '09716b', '09716c'].map(code => fs.readFileSync(findEntry(code), 'utf8'))
  for (const text of texts) {
    assert.match(text, /tskExposed/, '09716a/b/c 各自手写揭露后能力')
    assert.equal(/from '.*_shared.*'/.test(text), false, '09716a/b/c 未复用共享实现（各自独立文件）')
  }
  const engine = engineText()
  for (const key of ['handsKeyToInvestigatorOnDefeat', 'shiftsKeysOnFailedTestAtLocation', 'cannotBeDefeatedHealsAndFlees', 'spawnNearestKeyLocus', 'blocksOtherAttacksWhileReady']) {
    assert.equal(engine.includes(key), false, `${key} 无引擎读点（仅条目声明）`)
  }
  const notes = ['09720', '09729', '09732'].map(code => fs.readFileSync(findEntry(code), 'utf8'))
  assert.match(notes[0], /primitive-requests/, '09720 仍缺揭露限制读点（note 声明 primitive request）')
  assert.match(notes[1], /primitive-requests|读点/, '09729 仍缺攻击/躲避 +1 读点（note 披露）')
  assert.match(notes[2], /primitive-requests\/09732/, '09732 仍缺击败去向覆盖读点（note 披露 primitive request）')
})

test('验收 09718/09719/09723/09724/09725/09728/09733/09734/09735/09736 共享遭遇：条目文件与执行入口齐备', () => {
  for (const code of ['09718', '09719', '09723', '09724', '09725', '09728', '09733', '09734', '09735', '09736']) {
    const file = findEntry(code)
    assert.ok(file, `${code} 条目文件存在`)
    const body = fs.readFileSync(file, 'utf8')
    assert.ok(/encounterResolve|abilities:\s*\[/.test(body), `${code} 有执行入口`)
  }
})
