// P7 第三章《深陷其中》四张议程（07124/07125/07126/07127）：
// 正面「每个[[嫌犯]]敌人失去冷漠、不能谈判」+ 回合末全淹没强制；背面各自布置/结局。
//
// 读点：
//   · enemyLosesAloof ← hidden-rules.aloofPreventsAttack（攻击/交战判定）与 engine/enemies 的自动交战；
//   · parleyBlocked ← moves.js 的谈判合法性与提交校验；
//   · 回合末强制走既有 turnEnded 窗口（forced 实体能力，limit perWindow）；
//   · 背面用既有原语：water.change / takeFromSetAside / shuffleIntoEncounterDeck / shuffleDiscard /
//     spawn / keys.placeRandom / drawEncounter / setCampaignRecord / addTrauma + defeatInvestigator / finish。

import test from 'node:test'
import assert from 'node:assert/strict'
import { chapterFixture } from './tic-chapter-fixture.mjs'
import { legalMoves, settle, validateMove } from './core-fixture.mjs'
import { aloofPreventsAttack, reactionWindow, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { floodLevel } from '../src/engine/flood.js'
import { hasTrait } from '../src/engine/matcher.js'

function transaction(s, execute, select = () => null) {
  const run = draft => {
    try { return execute(draft) } catch (error) { if (error.constructor?.name !== 'ScenarioEnded') throw error }
  }
  resolveTransaction(s, 0, { action: 'ticInTooDeep' }, run)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, 'choice loop')
    const choice = s.pendingChoice
    const id = select(choice, s) ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
}
const codeOf = entity => entity?.originalCode || entity?.code
const locationByCode = (s, code) => s.locations.find(item => codeOf(item) === code)

function agendaFixture(index) {
  const s = chapterFixture('inTooDeep', 2)
  s.agendaIndex = index
  return s
}
function spawnSuspect(s, loc) {
  const foe = scenarioRuntime(s, []).spawn('07078', loc)
  const current = s.enemies.find(item => item.id === foe.id)
  current.aloof = true
  current.printedAloof = true
  return current
}
function advance(s) {
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
}

test('07124/07125/07126/07127：注册为 agenda 且正面规则/强制齐全', () => {
  for (const code of ['07124', '07125', '07126', '07127']) {
    const entry = registeredEntry(code)
    assert.ok(entry, `${code} 未注册`)
    assert.equal(entry.scope, 'agenda')
    assert.equal(entry.implemented, true)
    assert.equal(typeof entry.agendaRule.enemyLosesAloof, 'function')
    assert.equal(typeof entry.agendaRule.parleyBlocked, 'function')
    assert.equal(typeof entry.agendaRule.onReveal, 'function')
    assert.equal(entry.abilities.length, 1, `${code} 有回合末强制`)
    assert.ok([].concat(entry.abilities[0].trigger).includes('turnEnded'), `${code} 在 turnEnded 窗口触发`)
  }
})

test('正面：[[嫌犯]]敌人失去冷漠且不能谈判（agenda 离场后恢复）', () => {
  const s = agendaFixture(0)
  const foe = spawnSuspect(s, s.investigators[0].location)
  assert.equal(aloofPreventsAttack(s, s.investigators[0], foe), false, '议程在场时冷漠失效')
  assert.equal(validateMove(s, 0, { action: 'fight', enemyId: foe.id }), null, '可以攻击未交战的嫌犯')
  assert.equal(validateMove(s, 0, { action: 'entityAbility', entityType: 'enemy', entityId: foe.id, abilityIndex: 0 }),
    '当前不能与该目标谈判')
  assert.equal(legalMoves(s).some(move => move.action === 'entityAbility' && move.entityId === foe.id && move.actionKind === 'parley'),
    false, '合法列表里没有该嫌犯的谈判')
  s.agendaIndex = 9
  assert.equal(aloofPreventsAttack(s, s.investigators[0], foe), true, '议程离场后冷漠恢复')
  assert.equal(validateMove(s, 0, { action: 'fight', enemyId: foe.id }) != null, true, '未交战冷漠敌人不能直接攻击')
})

test('正面强制：回合结束时位于完全淹没地点——07124 受 1 伤；07127 受 1 伤 1 恐弃 2 手牌', () => {
  const damageCase = agendaFixture(0)
  const here = damageCase.investigators[0].location
  scenarioRuntime(damageCase, []).mechanics.water.set(here, 2)
  transaction(damageCase, draft => reactionWindow(draft, 'turnEnded',
    { when: 'turnEnded', seat: 0, location: here }, []))
  assert.equal(damageCase.investigators[0].damage, 1)
  assert.equal(damageCase.investigators[0].horror, 0)

  const rage = agendaFixture(3)
  const loc = rage.investigators[0].location
  scenarioRuntime(rage, []).mechanics.water.set(loc, 2)
  rage.investigators[0].hand = ['01017', '01017']
  transaction(rage, draft => reactionWindow(draft, 'turnEnded',
    { when: 'turnEnded', seat: 0, location: loc }, []))
  assert.equal(rage.investigators[0].damage, 1)
  assert.equal(rage.investigators[0].horror, 1)
  assert.equal(rage.investigators[0].hand.length, 0, '随机弃 2 张手牌')
})

test('07124 背面：海岸涨水 + 放一边的深海劫掠者/年幼深潜者洗回遭遇牌库与弃牌堆', () => {
  const s = agendaFixture(0)
  const coastal = s.locations.filter(location => hasTrait(location, 'Coastal'))
  assert.ok(coastal.length, '本关有海岸地点')
  const before = new Map(coastal.map(location => [location.id, floodLevel(s, location.id)]))
  const deckBefore = s.encounterDeck.length
  advance(s)
  for (const location of coastal) {
    assert.equal(floodLevel(s, location.id), Math.min(2, before.get(location.id) + 1),
      `${codeOf(location)} 涨水一级（封顶完全淹没）`)
  }
  assert.equal(s.scenarioZones.setAside.includes('07145'), false, '劫掠者离开放一边')
  assert.equal(s.scenarioZones.setAside.includes('01181'), false, '年幼深潜者离开放一边')
  assert.equal(s.encounterDeck.filter(code => code === '07145').length, 2)
  assert.equal(s.encounterDeck.filter(code => code === '01181').length, 2)
  assert.ok(s.encounterDeck.length > deckBefore, '洗回后牌库更大')
})

test('07125 背面：城中心涨水 + 愤怒暴民在印斯茅斯广场生成并带一把暗置钥匙', () => {
  const s = agendaFixture(1)
  const midtown = s.locations.filter(location => hasTrait(location, 'Midtown'))
  assert.ok(midtown.length)
  const before = new Map(midtown.map(location => [location.id, floodLevel(s, location.id)]))
  advance(s)
  for (const location of midtown) {
    assert.equal(floodLevel(s, location.id), Math.min(2, before.get(location.id) + 1), `${codeOf(location)} 涨水`)
  }
  const square = locationByCode(s, '07139')
  assert.ok(square, '印斯茅斯广场在场')
  const mob = s.enemies.find(enemy => codeOf(enemy) === '07062b')
  assert.ok(mob, '愤怒暴民从 setAside 生成')
  assert.equal(mob.location, square.id)
  assert.equal(keysAt(s, `enemy:${mob.id}`).length, 1, '随机暗置钥匙放在暴民上')
})

test('07126 背面：所有地点涨水且按玩家顺序每位调查员抽 1 张遭遇卡', () => {
  const s = agendaFixture(2)
  const all = s.locations
  const before = new Map(all.map(location => [location.id, floodLevel(s, location.id)]))
  advance(s)
  for (const location of all) {
    assert.equal(floodLevel(s, location.id), Math.min(2, before.get(location.id) + 1), `${codeOf(location)} 涨水`)
  }
  // 显现/涌动会把抽到的牌放进威胁区或弃牌堆，因此不比总量；直接数日志里的「翻开遭遇卡」
  // 至少等于未败退调查员数（07126 让每位调查员各抽 1 张，涌动的额外抽取只会更多）。
  const draws = (s.log || []).map(line => (typeof line === 'string' ? line : JSON.stringify(line)))
    .filter(line => line.includes('翻开遭遇卡')).length
  assert.ok(draws >= s.investigators.filter(inv => !inv.defeated && !inv.resigned).length,
    `每位调查员都抽了遭遇卡（实际 ${draws} 次翻开）`)
})

test('07127 背面：记录怒潮吞没；未撤退调查员被击败+1 肉体创伤；按 noResolution 结束', () => {
  const s = agendaFixture(3)
  let ended = false
  const run = draft => {
    try { scenarioRuntime(draft, []).advanceAgenda() } catch (error) {
      if (error.constructor?.name === 'ScenarioEnded') ended = true
      else throw error
    }
  }
  resolveTransaction(s, 0, { action: 'ticInTooDeep' }, run)
  for (let guard = 0; s.pendingChoice; guard++) {
    assert.ok(guard < 80, 'choice loop')
    const choice = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0].id
    resolveTransaction(s, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, run)
  }
  assert.equal(ended, true, '剧本结束（ScenarioEnded）')
  assert.equal(s.campaign.records.InnsmouthWasConsumedByTheRisingTide, true)
  for (const inv of s.investigators) {
    assert.equal(inv.defeated, true, `${inv.name} 被击败`)
    assert.equal(s.campaign.trauma[inv.seat].physical, 1, '1 点肉体创伤')
  }
  assert.equal(s.campaign.scenarioResults.at(-1).scenarioId, 'inTooDeep')
  assert.equal(s.campaign.scenarioResults.at(-1).resolution, 'noResolution', '未达成结局 → noResolution（剧本的失败分支）')
})
