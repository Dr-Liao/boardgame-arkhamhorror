// P0 回归：软锁、未实现弱点、能力 API 漂移与不可结算移动。
//
// 这些用例对应 2026-10 全量扫描发现的 P0：
//   1. 04100「毒蛇召来」在 2 人以上局里产生没有 id 的选项；
//   2. 03227 / 03142 两张剧本弱点没有实现，抽到即抛错；
//   3. addBasicWeakness 从全目录抽弱点，会抽到未实现的基础弱点；
//   4. 条目调用 api.locName，但能力 API 只有 locationName；
//   5. 杜克调查能力引用了未定义的 effect；
//   6. 《苍白面具》进入未揭示地下墓穴时，线索不足的移动仍被列为合法动作；
//   7. 弱点敌人（03059 苍白面具下的男子）从「放到一边」生成时缺少牌组归属，
//      被击败时 addVictory 抛错，整次行动中止（联机还会提示强制同步）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { fixture, move, settle } from './core-fixture.mjs'
import { createGameState, addBasicWeakness, spawnEnemy } from '../src/engine/engine.js'
import { weaknessProfile } from '../src/engine/lifecycle.js'
import { requestChoice } from '../src/engine/resolution.js'
import { contentRegistry } from '../content/registered.js'
import { encounterRules as tfaRules } from '../content/campaigns/theForgottenAge/encounter-rules.js'

test('P0 选择事务拒绝缺失或重复的选项 id，避免产出不可提交的合法动作', () => {
  const context = () => ({ _resolution: { id: 1, answers: [], cursor: 0 } })
  assert.throws(() => requestChoice(context(), {
    kind: 'test', source: 'p0', seat: 0, prompt: '缺少 id', options: [{ label: 'A' }],
  }), /字符串 id/)
  assert.throws(() => requestChoice(context(), {
    kind: 'test', source: 'p0', seat: 0, prompt: '重复 id', options: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }],
  }), /重复/)
  const state = context()
  state._resolution.answers.push({ choiceId: 'q1-0', kind: 'test', source: 'p0', seat: 0, optionId: 'a' })
  assert.equal(requestChoice(state, {
    kind: 'test', source: 'p0', seat: 0, prompt: 'ok', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
  }), 'a')
})

test('P0 TFA 04100 毒蛇召来：中毒弱点放入抽到者的威胁区域', () => {
  const state = {
    investigators: [
      { seat: 0, name: 'A', location: 'x', defeated: false, resigned: false },
      { seat: 1, name: 'B', location: 'x', defeated: false, resigned: false },
    ],
    locations: [{ id: 'x', clues: 0 }],
  }
  const poisoned = []
  const api = {
    choose: request => (request.options.some(option => option.id === 'poison') ? 'poison' : request.options[0]?.id),
    poison: seat => poisoned.push(seat),
    drawEncounter: () => {},
  }
  tfaRules.resolveEncounter(state, state.investigators[0], { code: '04100' }, api)
  assert.deepEqual(poisoned, [0], '固定是抽到它的调查员，不能改选别人')
})

test('P0 03227 失魂落魄：抽到后按疑惑/确信检定，不再抛「未实现弱点」', () => {
  assert.ok(weaknessProfile('03227'), '03227 必须有 weakness profile')
  const state = fixture()
  state.chaosBag = ['autofail']
  state.investigators[0].deck = ['03227']
  move(state, { action: 'draw' })
  settle(state)
  assert.equal(state.investigators[0].damage, 2)
  assert.ok(state.investigators[0].discard.includes('03227'))
})

test('P0 03142 黑玛瑙扣环：剧情弱点留在手牌中，不进入弱点结算', () => {
  assert.equal(weaknessProfile('03142'), null)
  const state = fixture()
  state.investigators[0].deck = ['03142']
  move(state, { action: 'draw' })
  settle(state)
  assert.ok(state.investigators[0].hand.includes('03142'))
})

test('P0 addBasicWeakness 只从本战役开放、且已实现的基础弱点里抽', () => {
  const state = createGameState({ campaignHub: true, campaignId: 'theForgottenAge', seed: 'p0-basic-weakness' }, [{ seat: 0 }])
  const inv = state.investigators[0]
  inv.deck = []
  inv.discard = []
  const added = []
  for (let index = 0; index < 40; index++) added.push(addBasicWeakness(state, inv, [], ['madness', 'injury']))
  assert.ok(added.some(Boolean), '应至少抽到一张基础弱点')
  for (const code of added.filter(Boolean)) {
    assert.ok(weaknessProfile(code), `${code} 没有弱点实现，不能被注入牌库`)
    assert.ok(['01096', '01097', '01099', '01100', '04038', '04040'].includes(code), `非本战役基础弱点：${code}`)
  }
})

test('P0 能力 API 覆盖条目里所有 api.* 调用（locName 回归）', async () => {
  const factories = await Promise.all([
    import('../src/engine/api-misc.js').then(module => module.createMiscApi),
    import('../src/engine/api-test.js').then(module => module.createTestApi),
    import('../src/engine/api-clue.js').then(module => module.createClueApi),
    import('../src/engine/api-enemy.js').then(module => module.createEnemyApi),
    import('../src/engine/api-card.js').then(module => module.createCardApi),
  ])
  const proxy = new Proxy(function () {}, {
    get: (target, key) => key === 'then' ? undefined : proxy,
    apply: () => proxy,
  })
  const api = Object.assign({}, ...factories.map(create => create(proxy, proxy, proxy)))
  const entries = fileURLToPath(new URL('../src/cards/entries/', import.meta.url))
  const missing = new Map()
  for (const name of readdirSync(entries).filter(file => file.endsWith('.js') && !['index.js', '_shared.js'].includes(file))) {
    const text = readFileSync(entries + name, 'utf8')
    for (const match of text.matchAll(/\bapi\.([A-Za-z_$][\w$]*)/g)) {
      if (!(match[1] in api)) {
        const codes = missing.get(match[1]) || []
        codes.push(name.replace(/\.js$/, ''))
        missing.set(match[1], codes)
      }
    }
  }
  assert.deepEqual([...missing.entries()], [], `条目调用了能力 API 不存在的方法：${[...missing.keys()].join(',')}`)
})

test('P0 杜克调查能力不再因未定义的 effect 抛错', () => {
  const state = fixture('02005')
  state.investigators[0].assets = [{ id: 'duke', code: '02014', exhausted: false }]
  state.investigators[0].actionsLeft = 5
  move(state, { action: 'ability', assetId: 'duke', abilityIndex: 1 })
  settle(state)
  assert.equal(state.investigators[0].clues, 1)
})

test('P0 苍白面具：线索不足时通往未揭示地下墓穴的移动不是合法动作', () => {
  const behavior = contentRegistry.getBehavior('thePallidMask')
  const state = {
    scenario: { id: 'thePallidMask' },
    numInvestigators: 2,
    locations: [{ id: 'lobby', originalCode: '03240' }],
    investigators: [{ seat: 0, location: 'lobby', clues: 1 }, { seat: 1, location: 'lobby', clues: 0 }],
  }
  const destination = { id: 'catacomb', revealed: false }
  assert.match(behavior.moveError(state, state.investigators[0], destination), /共同线索/)
  state.investigators[1].clues = 1
  assert.equal(behavior.moveError(state, state.investigators[0], destination), null)
  assert.equal(behavior.moveError(state, state.investigators[0], { id: 'catacomb', revealed: true }), null)
})

// 03059 苍白面具下的男子是 subtype=weakness 的剧本敌人：剧本会绕过「抽到者=归属者」的
// 牌库路径，直接把它从「放到一边」/承受者牌库生成。没有交战座位时必须从战役牌组补归属，
// 否则击败结算会抛「弱点敌人缺少牌组归属」，整次行动中止（大厅只看到一行报错）。
function fightWeaknessEnemyToDeath(state, code = '03059') {
  const inv = state.investigators[0]
  inv.combat = 99
  inv.actionsLeft = 10
  state.chaosBag = ['0']
  state.phase = 'investigation'
  state.currentSeat = 0
  const man = spawnEnemy(state, code, inv.location, null, true)
  assert.equal(man.bearerSeat, state.campaign.investigators[0].deck.includes(code) ? 0 : null)
  // 直接建立交战（冷漠敌人正常要先花行动交战；这里只测击败结算）。
  man.engagedSeat = 0
  inv.engaged.push(man.id)
  man.damageTaken = 2
  move(state, { action: 'fight', enemyId: man.id })
  settle(state)
  return man
}

test('P0 弱点敌人从「放到一边」生成时按战役牌组补归属，击败后进入归属者弃牌堆', () => {
  const state = fixture('01001')
  state.campaign.investigators[0].deck.push('03059')
  fightWeaknessEnemyToDeath(state)
  assert.ok(!state.enemies.some(enemy => enemy.code === '03059'), '男子已被击败')
  assert.ok(state.investigators[0].discard.includes('03059'), '弱点牌进入归属者弃牌堆')
  assert.ok(!state.encounterDiscard.includes('03059'))
})

test('P0 弱点敌人没有牌组归属时被击败不再抛错，改为进入遭遇弃牌堆', () => {
  // 旧存档或剧本中途生成的弱点敌人可能既没有 bearerSeat、战役牌组里也没有这张牌。
  const state = fixture('01001')
  assert.doesNotThrow(() => fightWeaknessEnemyToDeath(state))
  assert.ok(!state.enemies.some(enemy => enemy.code === '03059'))
  assert.ok(state.encounterDiscard.includes('03059'))
  assert.ok(!state.investigators[0].discard.includes('03059'))
})
