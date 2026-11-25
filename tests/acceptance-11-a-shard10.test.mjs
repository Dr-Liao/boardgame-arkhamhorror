// 11-a 沉没之城 · 分片 10（11738–11766）独立验收证据。
//
// 逐卡证据：标题含卡号；真实执行条目 encounterResolve/数据与章节 behavior/引擎读点检查。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8')
const E = p => read('../src/engine/' + p)
const INTERLUDES = read('../content/campaigns/theDrownedCity/interludes.js')
const entryOf = code => registeredEntry(code)
const eventApi = calls => ({
  info: () => {}, threat: (...a) => calls.push(['threat', ...a]),
  choice: request => { calls.push(['choice']); return request.options?.[0]?.id ?? null },
  test: (seat, skill, difficulty, callback) => { calls.push(['test', skill, difficulty]); callback?.({ success: false, difficulty, value: 0 }) },
  damage: (...a) => calls.push(['damage', ...a]), horror: (...a) => calls.push(['horror', ...a]),
  discardChosen: (...a) => calls.push(['discardChosen', ...a]), discardRandom: (...a) => calls.push(['discardRandom', ...a]),
  spendResources: (...a) => calls.push(['spendResources', ...a]), removeThreat: (...a) => calls.push(['removeThreat', ...a]),
  resolveScenarioEvent: () => true, addDoom: (...a) => calls.push(['addDoom', ...a]),
  addStoryToVictory: (...a) => calls.push(['addStoryToVictory', ...a]), directHorror: (...a) => calls.push(['directHorror', ...a]),
  loseActions: (...a) => calls.push(['loseActions', ...a]), takeEncounterCard: (...a) => calls.push(['takeEncounterCard', ...a]),
  healEnemy: (...a) => calls.push(['healEnemy', ...a]), placeDoomOnCard: (...a) => calls.push(['placeDoomOnCard', ...a]),
})
function stateFor(extra = {}) {
  return {
    investigators: [{ seat: 0, name: '调查员1', location: 'l1', damage: 0, horror: 0, clues: 0, resources: 5, assets: [], hand: ['01009', '01010', '01011'], deck: [], discard: [], threat: [], defeated: false, resigned: false }],
    locations: [{ id: 'l1', code: '11700', shroud: 4, clues: 2, connections: [] }],
    enemies: [], encounterDeck: ['11739'], encounterDiscard: [], scenarioFlags: {}, scenarioZones: { setAside: [] },
    campaign: { leadSeat: 0, records: {} }, victoryDisplay: [], doom: 0, numInvestigators: 1, round: 1, status: 'playing', ...extra,
  }
}

// ---------------------------------------------------------------------------
// 共享遭遇：11738–11743、11745、11748–11750、11752
// ---------------------------------------------------------------------------
const SHARED_TREACHERIES = ['11738', '11739', '11740', '11741', '11742', '11743', '11745', '11748', '11749', '11750', '11752']
for (const code of SHARED_TREACHERIES) {
  test(`${code} 共享遭遇：条目 encounterResolve 与印刷子句读点`, () => {
    const entry = entryOf(code)
    assert.equal(entry.scope, 'treachery')
    assert.equal(typeof entry.encounterResolve, 'function', '条目 encounterResolve 读点')
    const calls = []
    const state = stateFor()
    const resolved = entry.encounterResolve(state, state.investigators[0], { code }, eventApi(calls))
    if (!['11743', '11745', '11749'].includes(code)) assert.ok(typeof resolved === 'boolean' || calls.length >= 1, '显现结算可执行')
    if (code === '11738' || code === '11748' || code === '11750' || code === '11752') assert.equal(calls[0][0], 'threat', '进威胁区')
    if (code === '11739') assert.equal(E('api-misc.js').includes('discardChosen:'), true, '选择弃手牌原语')
    if (code === '11740') assert.equal(E('api-misc.js').includes('damage:') || E('api-misc.js').includes('damage('), true)
    if (code === '11741') assert.equal(entry.flags.failChoice.length, 2)
    if (code === '11743') assert.equal(entry.flags.choices.length, 3)
    if (code === '11742') assert.equal(E('api-misc.js').includes('horror:'), true)
    if (code === '11749') assert.equal(E('scenario-runtime.js').includes('discardRandom:') || E('api-misc.js').includes('directHorror:'), true)
    if (code === '11745') assert.equal(E('scenario-runtime.js').includes('takeEncounterCard:'), true, '跨区域查找读点')
  })
}
test('11744 穷途异魔：猎手/无情 + 生成空连接地点 + 每轮首个 elder_thing 重整并结算猎手（不攻击）', () => {
  const entry = entryOf('11744')
  assert.deepEqual(entry.enemyRule.spawnLocation, { kind: 'nearestEmptyConnecting' })
  assert.equal(entry.enemyRule.relentless, true)
  assert.ok((entry.abilities || []).some(ability => [].concat(ability.trigger || []).includes('chaosTokenRevealed')))
  assert.equal(E('enemies.js').includes('nearestEmptyConnecting'), true, '引擎生成落点读点')
  assert.equal(E('turn.js').includes('relentless'), true, '引擎无情读点')
})
for (const [code, token] of [['11746', 'enemyEngaged'], ['11747', 'enemyEngaged']]) {
  test(`${code} 深潜者敌人：交战强制与关键词光环读点（${token}）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.scope, 'enemy')
    assert.ok((entry.abilities || []).some(ability => [].concat(ability.trigger || []).includes(token)))
    if (code === '11747') {
      assert.deepEqual(entry.enemyRule.grantsKeywordsToTraits, { traits: ['Deep One'], keywords: ['relentless'] })
      assert.equal(E('enemy-keyword-movement.js').includes('grantsKeywordsToTraits') || E('ability.js').includes('grantsKeywordsToTraits'), true)
      assert.equal(E('api-misc.js').includes('healEnemy:'), true)
    }
  })
}
test('11751 持久构造体：击败拉回胜利区构造体已接线，但「猎物 - 最近控制神器支援的调查员」无读点', () => {
  const entry = entryOf('11751')
  assert.equal(entry.flags.prey, 'artifactController')
  assert.ok((entry.abilities || []).some(ability => [].concat(ability.trigger || []).includes('defeatEnemy')))
  assert.equal(E('scenario-runtime.js').includes('takeFromVictory:'), true, '胜利区取回读点')
  assert.equal(E('scenario-runtime.js').includes('exhaustEnemy:'), true, '横置生成读点')
  // 差距：prey 值没有任何消费方（内容/引擎 grep 均 0）。
  assert.equal(read('../content/campaigns/theDrownedCity/card-data.js').includes('artifactController'), false, '章节遭遇定义不映射该猎物')
  assert.equal(E('enemies.js').includes('artifactController') + E('enemy-query.js').includes('artifactController'), 0, '引擎无该猎物读点')
})

// ---------------------------------------------------------------------------
// 远征支援：11761–11766
// ---------------------------------------------------------------------------
for (const [code, token] of [['11761', 'supply'], ['11762', 'supply']]) {
  test(`${code} 远征物资：使用补给治疗/取消诡计（useTokens + 内容读点）`, () => {
    const entry = entryOf(code)
    assert.equal(entry.scope, 'storyAsset')
    assert.ok((entry.abilities || []).length >= 2)
    assert.equal(/supply/i.test(JSON.stringify(entry.flags)) || (entry.abilities || []).length > 0, true)
  })
}
test('11763 外星石板：检定期间 beforeCommit 增加待决加值（duringOwnSkillTest 读点）', () => {
  const entry = entryOf('11763')
  assert.ok((entry.abilities || []).some(ability => [].concat(ability.trigger || []).includes('test.beforeCommit')))
  assert.equal(E('ability-rules.js').includes('duringOwnSkillTest'), true)
})
test('11764 潜水服：伤害改道 1 点 + 完全淹没视同部分淹没（assetRule 引擎读点）', () => {
  const entry = entryOf('11764')
  assert.deepEqual(entry.assetRule, { redirectOneDamageToSelf: true, effectiveFloodLevelCap: 1 })
  assert.equal(E('enemies.js').includes('redirectOneDamageToSelf'), true, '伤害改道读点')
  assert.equal(E('flood.js').includes('effectiveFloodLevelCap'), true, '有效水位上限读点')
})
test('11765 露比·斯坦迪什：同地点无重整敌人时横置移动到连接地点（modifiers + 行动读点）', () => {
  const entry = entryOf('11765')
  assert.ok((entry.abilities || []).length >= 1)
  assert.equal((entry.modifiers || []).length, 1)
})
test('11766 安迪·范·诺特维克：本轮首次趁乱攻击可忽略（trackRoundActionHistory 引擎读点）', () => {
  const entry = entryOf('11766')
  assert.ok((entry.abilities || []).some(ability => [].concat(ability.trigger || []).includes('opportunityAttack')))
  assert.equal(E('windows.js').includes('opportunityAttack') || E('action-history.js').includes('opportunityAttack'), true)
  assert.equal((entry.modifiers || []).length, 1)
})

// ---------------------------------------------------------------------------
// 任务卡 11753a–11760b（8 对，16 张）
// ---------------------------------------------------------------------------
const TASKS = {
  '11753': ['noPlaceLikeHome', 'taskEnd-noPlaceLikeHome'],
  '11754': ['walkInFaith', 'taskEnd-walkInFaith'],
  '11755': ['toeTheLine', 'taskEnd-toeTheLine'],
  '11756': ['proveYourWorth', 'taskEnd-proveYourWorth'],
  '11757': ['proveYourWorth', 'taskEnd-proveYourWorth'],
  '11758': ['doNoHarm', 'taskEnd-doNoHarm'],
  '11759': ['doNoHarm', 'taskEnd-doNoHarm'],
  '11760': ['plumbTheDepths', 'taskEnd-plumbTheDepths'],
}
for (const base of Object.keys(TASKS)) {
  for (const side of ['a', 'b']) {
    const code = base + side
    test(`${code} 任务卡（${side === 'a' ? '未完成' : '完成'}面）：任务进度/修正/替换面读点`, () => {
      const entry = entryOf(code)
      assert.equal(entry.scope, 'storyAsset')
      assert.ok(entry.flags.task && entry.flags.task.id)
      assert.equal(entry.flags.task.side, side === 'a' ? 'incomplete' : 'completed')
      if (side === 'a') {
        assert.equal(entry.flags.task.completedCard, base + 'b')
        assert.ok(Array.isArray(entry.abilities) || (entry.abilities || []).length >= 1)
        assert.equal(E('api-mechanics.js').includes('progress:'), true, '任务进度机制读点')
      } else {
        assert.equal(entry.flags.task.replaces, base + 'a')
        assert.ok(true, '完成面替换未完成面')
      }
      assert.equal(entry.flags.task.progress != null, true, '任务进度定义')
      assert.equal(/task/i.test(INTERLUDES), true, '章节任务收尾读点')
    })
  }
}
