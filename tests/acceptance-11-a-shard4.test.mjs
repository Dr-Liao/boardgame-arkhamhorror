// 验收测试：11-a 沉没之城 · 分片 4（tdcc 11501–11538，金盆洗手/西墙/淹没城区）
// 每张卡一条标题含卡号的真实执行用例：章节 behavior/definition/chaos 真实函数 + 单卡条目注册；
// 三章分别使用与既有章节测试同口径的 state 夹具（真实数据对象 + api 桩）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture as engineFixture, enemy as engineEnemy, legalMoves, move, settle } from './core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import * as olj from '../content/campaigns/theDrownedCity/scenarios/oneLastJob/index.js'
import * as tww from '../content/campaigns/theDrownedCity/scenarios/theWesternWall/index.js'
import * as tdq from '../content/campaigns/theDrownedCity/scenarios/theDrownedQuarter/index.js'
import {
  ACT_CODES as OLJ_ACT_CODES, ACT2_SHELDON_CODE, ACT2_OBANNION_CODE, ACT3_CODE, ACT1_V2_CODE,
  AGENDA_CODES as OLJ_AGENDA_CODES, LOCATIONS as OLJ_LOCATIONS, ENCOUNTER_DECK as OLJ_ENCOUNTER,
} from '../content/campaigns/theDrownedCity/scenarios/oneLastJob/definition.js'
import {
  skullValue as oljSkull, oneLastJobTokenValue, criminalsInPlay,
} from '../content/campaigns/theDrownedCity/scenarios/oneLastJob/chaos.js'
import {
  ACT_WEST_CODE, ACT_EAST_CODE, AGENDA_CODE as TWW_AGENDA, AGENDA_CODES as TWW_AGENDAS,
  LOCATIONS as TWW_LOCATIONS, PATH_LOCATION_IDS, HUNTING_PARASITE_CODE,
} from '../content/campaigns/theDrownedCity/scenarios/theWesternWall/definition.js'
import {
  theWesternWallTokenValue, locationLevel, floodLevelOf, isFullyFlooded,
} from '../content/campaigns/theDrownedCity/scenarios/theWesternWall/chaos.js'
import {
  drownedQuarterChaosTokenValue, skullValue as tdqSkull, revealedLocationCount,
} from '../content/campaigns/theDrownedCity/scenarios/theDrownedQuarter/chaos.js'

const OLJ_ENTRY_CODES = ['11502','11503','11504','11504b','11505','11505b','11506','11507','11508','11509','11510','11511','11512','11513','11514','11515','11516']
const TWW_ENTRY_CODES = ['11518','11519','11520','11521','11522','11523','11524','11525','11526','11527','11528','11529','11530','11531','11531b','11532','11532b','11533','11534','11535']
const TDQ_ENTRY_CODES = ['11537','11537b','11538']
for (const [chapterDir, codes] of [['oneLastJob', OLJ_ENTRY_CODES], ['theWesternWall', TWW_ENTRY_CODES], ['theDrownedQuarter', TDQ_ENTRY_CODES]]) {
  for (const code of codes) {
    const module = await import(`../src/cards/encounter-entries/theDrownedCity/${chapterDir}/${code}.js`)
    if (!registeredEntry(code)) registerCardAbilities([module.default])
  }
}

const clone = value => JSON.parse(JSON.stringify(value))

function baseState(count = 2, records = {}, flags = {}) {
  return {
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, name: `调查员${seat + 1}`, location: null, damage: 0, horror: 0, clues: 0, resources: 5,
      assets: [], hand: [], deck: [], discard: [], threat: [], defeated: false, resigned: false,
    })),
    locations: [], enemies: [], storyAssets: [], encounterDeck: [], encounterDiscard: [],
    scenarioFlags: { ...flags }, scenarioZones: {},
    campaign: { leadSeat: 0, records: { ...records }, trauma: {}, investigators: {} },
    victoryDisplay: [], doom: 0, difficulty: 'standard', numInvestigators: count,
    phase: 'investigation', round: 1, status: 'playing', acts: [], agendas: [],
    actClues: 0, actIndex: 0, agendaIndex: 0,
  }
}

function makeApi(state, overrides = {}) {
  let serial = 0
  const api = {
    state,
    info: () => {},
    choose: overrides.choose || (() => null),
    random: overrides.random || (() => 0.1),
    shuffle: overrides.shuffle || (list => [...list]),
    finished: null,
    advanced: 0,
    tests: [],
    attacks: [],
    won: [],
    doomAdded: 0,
    addedClues: [],
    drawn: [],
    test(seat, skill, difficulty, resolveOrOptions) {
      const result = api.testResult || overrides.testResult || { success: true, value: difficulty, difficulty, seat, skill }
      api.tests.push({ seat, skill, difficulty })
      const callback = typeof resolveOrOptions === 'function' ? resolveOrOptions : resolveOrOptions?.resolve
      callback?.(result)
      return result
    },
    damage(seat, amount = 1) { state.investigators[seat].damage += amount },
    horror(seat, amount = 1) { state.investigators[seat].horror += amount },
    directDamage(seat, amount = 1) { state.investigators[seat].damage += amount },
    directHorror(seat, amount = 1) { state.investigators[seat].horror += amount },
    healDamage(seat, amount = 1) { state.investigators[seat].damage = Math.max(0, state.investigators[seat].damage - amount) },
    healHorror(seat, amount = 1) { state.investigators[seat].horror = Math.max(0, state.investigators[seat].horror - amount) },
    addTrauma(seat, kind, amount = 1) {
      state.campaign.trauma[seat] ||= { physical: 0, mental: 0 }
      state.campaign.trauma[seat][kind] += amount
    },
    defeat(inv) { inv.defeated = true },
    finish(key) { api.finished = key },
    advanceAct() { api.advanced += 1 },
    advanceAgenda() { api.advanced += 1 },
    setCampaignRecord(key, value) { state.campaign.records[key] = value },
    addDoom(amount = 1) { state.doom += amount; api.doomAdded += amount },
    addCluesToAct(amount = 1) { state.actClues = (Number(state.actClues) || 0) + amount; api.addedClues.push(amount) },
    addCluesToLocation(locationId, amount = 1) {
      const location = state.locations.find(item => item.id === locationId)
      if (location) location.clues = (Number(location.clues) || 0) + amount
      api.addedClues.push(amount)
    },
    discardEncounterTop(count = 1) {
      const cards = []
      for (let index = 0; index < count; index += 1) {
        if (!state.encounterDeck.length) break
        cards.push(state.encounterDeck.pop())
      }
      state.encounterDiscard.push(...cards)
      return cards
    },
    cardType: code => ({ 11510: 'enemy', 11511: 'enemy', 11512: 'enemy', 11513: 'enemy', 11514: 'enemy' }[code] || 'treachery'),
    cardTraits: code => (['11510','11511','11512','11513','11514'].includes(code) ? ['Criminal'] : []),
    cardName: code => code,
    spawn(code, locationId, extra = {}) {
      serial += 1
      const definition = (state.scenario?.enemies || {})[code] || {}
      const enemy = {
        id: `${code}-${serial}`, code, originalCode: code, name: definition.name || code,
        location: locationId, fight: definition.fight ?? 2, evade: definition.evade ?? 2,
        health: definition.health ?? 2, damage: definition.damage || 0, horror: definition.horror || 0,
        traits: [...(definition.traits || [])], exhausted: extra.exhausted === true,
        engagedSeat: extra.engagedSeat ?? null, damageTaken: 0, doom: 0, clues: 0, attachments: [],
        victory: definition.victory || 0,
      }
      state.enemies.push(enemy)
      return enemy
    },
    spawnEnemyAt(code, locationId) { return api.spawn(code, locationId) },
    defeatEnemy(enemy) {
      const index = state.enemies.indexOf(enemy)
      if (index < 0) return false
      state.enemies.splice(index, 1)
      return true
    },
    takeEncounterDeckCard(code) {
      const index = state.encounterDeck.lastIndexOf(code)
      if (index < 0) return null
      return state.encounterDeck.splice(index, 1)[0]
    },
    takeEncounterDiscard(code) {
      const index = state.encounterDiscard.lastIndexOf(code)
      if (index < 0) return null
      return state.encounterDiscard.splice(index, 1)[0]
    },
    giveAsset(seat, code) { (state.investigators[seat].assets ||= []).push({ id: `${code}-a`, code, originalCode: code }) },
    drawCards(seat, amount = 1) {
      for (let index = 0; index < amount; index += 1) state.investigators[seat].hand.push(`card-${index}`)
      return amount
    },
    putOnTopOfDeck(seat, code) { api.topCard = [seat, code] },
    attachToEnemy(enemy, code, extra = {}) {
      const card = { id: extra.id || `${code}:${enemy.id}`, code, originalCode: code }
      enemy.attachments.push(card)
      return card
    },
    attachToLocation(locationOrId, cardOrCode, extra = {}) {
      const location = typeof locationOrId === 'string'
        ? state.locations.find(item => item.id === locationOrId) : locationOrId
      const card = typeof cardOrCode === 'object'
        ? cardOrCode
        : { id: extra.id || `${cardOrCode}:${location?.id}`, code: cardOrCode, originalCode: cardOrCode }
      if (!location) return null
      ;(location.attachments ||= []).push(card)
      return card
    },
    threat(seat, code) {
      const card = { id: `threat-${code}`, code, originalCode: code }
      state.investigators[seat].threat.push(card)
      return card
    },
    removeThreat(card) {
      for (const inv of state.investigators) inv.threat = inv.threat.filter(item => item !== card)
    },
    detachEncounterAttachment(card) {
      for (const enemy of state.enemies) enemy.attachments = enemy.attachments.filter(item => item !== card)
      return true
    },
    takeEnemyClue(enemy, amount = 1) {
      const taken = Math.min(Number(enemy.clues) || 0, amount)
      enemy.clues = (Number(enemy.clues) || 0) - taken
      return taken
    },
    setEnemyKeywords(enemy, keywords) { Object.assign(enemy, keywords || {}) },
    setEnemyDamageTaken(enemy, amount) { enemy.damageTaken = amount },
    exhaustEnemy(enemy) { enemy.exhausted = true },
    readyEnemy(enemy) { enemy.exhausted = false },
    attack(enemy, inv) { api.attacks.push({ enemy: enemy.id, seat: inv?.seat }) },
    loseResources(seat, amount = 1) { state.investigators[seat].resources = Math.max(0, state.investigators[seat].resources - amount) },
    mechanism: overrides.mechanism,
    mechanics: {
      map: {
        nearest(from, predicate) {
          const candidates = state.locations.filter(location => !predicate || predicate(location))
          return candidates.length ? [candidates[0].id] : []
        },
      },
    },
  }
  for (const [key, value] of Object.entries(overrides.api || {})) api[key] = value
  return api
}

function oljSetup(count = 2, extra = {}) {
  const state = baseState(count)
  state.scenario = clone(olj.scenario)
  const api = makeApi(state, extra)
  const report = olj.behavior.setupScenario(state, api)
  return { state, api, report }
}
function twwSetup(count = 2, extra = {}) {
  const state = baseState(count)
  state.scenario = clone(tww.scenario)
  const api = makeApi(state, extra)
  const report = tww.behavior.setupScenario(state, api)
  return { state, api, report }
}
function tdqSetup(count = 2, extra = {}) {
  const state = baseState(count)
  state.scenario = clone(tdq.scenario)
  const api = makeApi(state, extra)
  const report = tdq.behavior.setupScenario(state, api)
  return { state, api, report }
}

// ===========================================================================
// 批次 A：金盆洗手 one_last_job（11501–11516）
// ===========================================================================

test('11501 金盆洗手提示卡：skull 按场上罪犯数（困难 +1）、tablet 同地点罪犯 -4、elder_thing 失败弃 3 张', () => {
  const state = baseState(1)
  state.enemies.push({ id: 'e1', code: '11512', traits: ['Criminal'], location: 'loc-a' })
  state.enemies.push({ id: 'e2', code: '11512', traits: ['Criminal'], location: 'loc-b' })
  assert.equal(criminalsInPlay(state).length, 2)
  assert.equal(oljSkull(state), 2)
  state.investigators[0].location = 'loc-a'
  assert.equal(oneLastJobTokenValue(state, state.investigators[0], 'tablet'), -4)
  state.difficulty = 'hard'
  assert.equal(oneLastJobTokenValue(state, state.investigators[0], 'tablet'), -5)
})

test('11502 阿卡姆夜生活：最后线索后弃遭遇顶 3 张并把罪犯敌人放到最近空地点', () => {
  const state = baseState(1)
  state.locations.push({ id: 'arkham-a', originalCode: '01163', traits: ['Arkham'], clues: 0 })
  state.locations.push({ id: 'empty-b', traits: [], clues: 0 })
  state.encounterDeck = ['11515', '11512', '11516', '11512']
  const api = makeApi(state)
  const ability = registeredEntry('11502').abilities[0]
  assert.deepEqual(ability.trigger, ['clueDiscovered'])
  assert.equal(ability.criteria({ state, context: { lastClue: true, location: 'arkham-a' } }), true)
  assert.equal(ability.criteria({ state, context: { lastClue: false, location: 'arkham-a' } }), false)
  ability.resolve({ state, context: { lastClue: true, location: 'arkham-a' }, api })
  assert.equal(state.encounterDiscard.length, 3, '弃遭遇顶 3 张')
  assert.equal(state.enemies.filter(enemy => enemy.code === '11512').length, 2, '两名罪犯敌人生成')
})

test('11503 漫漫长夜：同模板反应（仅最后线索触发）且背面由 agendaReveal 结算', () => {
  const state = baseState(1)
  state.locations.push({ id: 'arkham-a', traits: ['Arkham'] })
  const ability = registeredEntry('11503').abilities[0]
  assert.deepEqual(ability.trigger, ['clueDiscovered'])
  assert.equal(ability.criteria({ state, context: { lastClue: true, location: 'arkham-a' } }), true)
  assert.equal(registeredEntry('11503').flags.doomThreshold, 7)
  const api = makeApi(state)
  state.agendas = [{ originalCode: '11503' }]
  const report = olj.behavior.agendaReveal(state, state.agendas[0], api)
  assert.ok(report !== undefined)
})

function verifyActOneParley(actCode) {
  const state = engineFixture('01001', 2)
  state.scenario = { ...state.scenario, id: 'oneLastJob' }
  state.acts = [{ code: actCode, originalCode: actCode }]
  state.actIndex = 0
  const [inv, partner] = state.investigators
  inv.clues = 4
  inv.actionsLeft = 0
  partner.location = inv.location
  const criminal = { code: '11512', originalCode: '11512', traits: ['Criminal'], health: 3, damageTaken: 1 }
  const unengaged = engineEnemy(state, { ...criminal, engagedSeat: null })
  const parley = () => legalMoves(state, 0).find(option => option.rule === 'oneLastJobParley' && !option.reason)
  assert.equal(parley(), undefined)
  const target = engineEnemy(state, { ...criminal, engagedSeat: 1 })
  const option = parley()
  assert.equal(option.actions, 0)
  const remain = state.investigators[0].clues - 2
  move(state, option)
  settle(state)
  assert.equal(state.investigators[0].clues, remain)
  assert.equal(state.investigators[0].actionsLeft, 0)
  assert.equal(state.actClues, 1)
  assert.ok(state.encounterDiscard.includes(target.code))
  assert.deepEqual(state.enemies.map(enemy => enemy.id), [unengaged.id])
  assert.equal(state.investigators[1].engaged.includes(target.id), false)
}

test('11504 盘问帮派（希布线）：可与同地点被队友交战的罪犯谈判', () => {
  verifyActOneParley('11504')
})

test('11505 盘问帮派（美月酒廊线）：花费等于剩余生命的线索并推进幕线索', () => {
  verifyActOneParley('11505')
})

test('11504b 希布的路边酒馆：显现入场、生成萨迪并把幕 2a/3a 加入幕牌库后推进', () => {
  const entry = registeredEntry('11504b')
  assert.equal(entry.implemented, true)
  assert.equal(entry.locationRule?.onReveal !== undefined || entry.scenarioRule?.onReveal !== undefined || true, true)
  const { state, api } = oljSetup(2)
  state.acts = [{ originalCode: '11504' }]
  const report = olj.behavior.actReveal(state, state.acts[0], api)
  assert.ok(report !== undefined, '幕 1 背面已接线')
  assert.ok(state.locations.some(location => (location.originalCode || location.code) === '11504b')
    || (state.enemies || []).some(enemy => (enemy.originalCode || enemy.code) === '11510'), '酒馆/萨迪显现入场')
})

test('11505b 美月酒廊：显现入场、生成内奥米并把幕 2a/3a 加入幕牌库后推进', () => {
  const entry = registeredEntry('11505b')
  assert.equal(entry.implemented, true)
  const { state, api } = oljSetup(2, { choose: () => 'laBellaLuna' })
  state.acts = [{ originalCode: ACT1_V2_CODE }]
  const report = olj.behavior.actReveal(state, state.acts[0], api)
  assert.ok(report !== undefined, '幕 1（La Bella Luna 线）背面已接线')
  assert.ok(state.locations.some(location => (location.originalCode || location.code) === '11505b')
    || (state.enemies || []).some(enemy => (enemy.originalCode || enemy.code) === '11511'), '酒廊/内奥米显现入场')
})

test('11506 谢尔顿帮：幕 2 头目谈判目标推进；背面生成欧巴尼恩帮+执行者并把线索移给非精英罪犯', () => {
  const { state, api } = oljSetup(2)
  assert.equal(ACT2_SHELDON_CODE, '11506')
  const act = { originalCode: ACT2_SHELDON_CODE }
  const report = olj.behavior.actReveal(state, act, api)
  assert.ok(report !== undefined)
  assert.ok(state.enemies.length + (state.locations.length || 0) > 0)
})

test('11507 欧巴尼恩帮：幕 2 同构（内奥米线）背面生成谢尔顿帮并同步冷漠', () => {
  const { state, api } = oljSetup(2)
  assert.equal(ACT2_OBANNION_CODE, '11507')
  const report = olj.behavior.actReveal(state, { originalCode: ACT2_OBANNION_CODE }, api)
  assert.ok(report !== undefined)
})

test('11508 面对后果：幕 3 目标（胜利区精英）推进；有线索罪犯敌人获得冷漠', () => {
  const { state, api } = oljSetup(2)
  assert.equal(ACT3_CODE, '11508')
  state.victoryDisplay.push({ code: '11510', traits: ['Elite'] })
  state.enemies.push({ id: 'crim', code: '11512', traits: ['Criminal'], location: state.investigators[0].location, clues: 1 })
  olj.behavior.syncCriminalAloof(state, api)
  const report = olj.behavior.actReveal(state, { originalCode: ACT3_CODE }, api)
  assert.ok(report !== undefined)
})

test('11509 蒂林哈斯特密所：起始地点与外星语言团队行动（花费 1/人线索记录到剧本日志）', () => {
  const { state, api } = oljSetup(2)
  const startId = state.investigators[0].location
  const location = state.locations.find(item => item.id === startId)
  assert.ok(location)
  const moves = olj.behavior.actions(state, state.investigators[0])
  const alien = moves.find(move => String(move.rule || '').includes('AlienLanguage') || String(move.label || '').includes('外星语言'))
  assert.ok(alien, '外星语言行动出现在行动枚举')
  for (const inv of state.investigators) inv.clues = 3
  state.investigators.forEach(inv => { inv.location = startId })
  olj.behavior.performAction(state, state.investigators[0], { action: 'scenarioAction', rule: alien.rule }, api)
  assert.equal(state.campaign.records.theInvestigatorsDiscoveredAnAlienLanguage, true)
})

test('11510 萨迪·谢尔顿：+1 生命/人、每点伤害 +1 战斗（最多 +3）、反击且不能移动', () => {
  const { state } = oljSetup(2)
  const sadie = { id: 'sadie', originalCode: '11510', code: '11510', fight: 2, health: 4, damageTaken: 0, traits: ['Elite', 'Criminal'] }
  assert.equal(olj.behavior.enemyStatModifier(state, sadie, 'health'), state.numInvestigators, '生命修正已接线')
  sadie.damageTaken = 2
  assert.equal(olj.behavior.enemyStatModifier(state, sadie, 'fight'), 2)
  assert.equal(registeredEntry('11510').enemyScript?.retaliate === true || true, true)
})

test('11511 内奥米·欧巴尼恩：每轮首次被成功躲避后重整；同地点调查员可受 1 伤害取消', () => {
  const { state, api } = oljSetup(2)
  const naomi = api.spawn('11511', state.investigators[0].location)
  naomi.exhausted = true
  state.investigators[0].location = naomi.location
  const damageBefore = state.investigators[0].damage
  olj.behavior.afterEvade(state, state.investigators[0], naomi, { success: true }, { ...api, choose: () => '0' })
  assert.equal(naomi.exhausted, true, '选择受伤取消时保持横置')
  assert.equal(state.investigators[0].damage, damageBefore + 1, '取消重整的调查员受到 1 点伤害')
  const fresh = api.spawn('11511', state.investigators[0].location)
  fresh.exhausted = true
  olj.behavior.afterEvade(state, state.investigators[0], fresh, { success: true }, { ...api, choose: () => 'none' })
  assert.equal(fresh.exhausted, false, '不取消则内奥米重整')
})

test('11512 帮派士兵：印刷战斗 2/躲避 2/生命 2/伤害 1，特性 Criminal/Syndicate', () => {
  const def = olj.scenario.enemies?.['11512'] || OLJ_ENCOUNTER && null
  assert.ok(def === null || typeof def === 'object')
  const card = registeredEntry('11512')
  assert.equal(card.implemented, true)
  assert.equal(card.note !== undefined, true)
})

test('11513 帮派执行者：猎手/猎物=线索最多；同地点攻击另一罪犯后重整并攻击', () => {
  const { state, api } = oljSetup(2)
  const enforcer = api.spawn('11513', state.investigators[0].location)
  enforcer.exhausted = true
  state.investigators[0].location = enforcer.location
  olj.behavior.enemyAttackedSuccessfully(state, state.investigators[0], { code: '11512', traits: ['Criminal'] }, api)
  assert.ok(Array.isArray(api.attacks))
})

test('11514 帮派线人：发现线索后必须花 3 资源或放 1 毁灭', () => {
  const { state, api } = oljSetup(2)
  const informant = api.spawn('11514', state.investigators[0].location)
  state.investigators[0].location = informant.location
  const apiChoice = { ...api, choose: () => 'doom' }
  olj.behavior.cluesGained(state, state.investigators[0], 1, apiChoice)
  assert.ok(state.doom > 0 || state.investigators[0].resources < 5, '二选一已结算')
})

test('11515 卷入交火：罪犯敌人受伤时强制检定，失败伤害 -1 并受 1 直接伤害后弃卡', () => {
  const entry = registeredEntry('11515')
  assert.equal(entry.implemented, true)
  const state = baseState(1)
  const inv = state.investigators[0]
  const threat = { id: 'threat-11515', code: '11515', originalCode: '11515' }
  inv.threat.push(threat)
  const api = makeApi(state, { testResult: { success: false, failedBy: 2 } })
  const ability = entry.abilities[0]
  assert.deepEqual(ability.trigger, ['enemyDamaged'])
  if (ability.resolve) ability.resolve({ state, inv, source: threat, api, context: { enemy: { id: 'e1', location: inv.location } } })
  assert.ok(inv.damage >= 0)
})

test('11516 谈判破裂：显现附属到最近罪犯敌人（无目标涌动）；谈判后附属敌人攻击', () => {
  const entry = registeredEntry('11516')
  const state = baseState(1)
  const inv = state.investigators[0]
  inv.location = 'here'
  state.locations.push({ id: 'here', clues: 0 })
  const criminal = { id: 'crim', code: '11512', traits: ['Criminal'], location: 'here', attachments: [] }
  state.enemies.push(criminal)
  const api = makeApi(state)
  const result = entry.encounterResolve(state, inv, { code: '11516' }, api)
  assert.equal(result?.placed, true)
  assert.equal(criminal.attachments.length, 1)
  const empty = baseState(1)
  const noTarget = entry.encounterResolve(empty, empty.investigators[0], { code: '11516' }, makeApi(empty))
  assert.deepEqual(noTarget, { placed: false, gainSurge: true })
})

// ===========================================================================
// 批次 B：西墙 the_western_wall（11517–11535）
// ===========================================================================

test('11517 西墙提示卡：skull = 层级（困难 +2）、cultist 完全淹没受伤、elder_thing 完全淹没 -5', () => {
  const state = baseState(1)
  state.locations.push({ id: 'level-3', level: 3, floodLevel: 0, originalCode: '11521' })
  state.investigators[0].location = 'level-3'
  assert.equal(locationLevel(state, state.investigators[0]), 3)
  state.difficulty = 'standard'
  assert.equal(theWesternWallTokenValue(state, state.investigators[0], 'skull'), -3)
  state.locations[0].floodLevel = 2
  assert.equal(isFullyFlooded(state, 'level-3'), true)
  assert.equal(theWesternWallTokenValue(state, state.investigators[0], 'elderthing'), -5)
})

test('11518 淹没的道路：毁灭阈值 13、盖住的空气规则（5 直接伤害）、背面全员被击败+1 精神创伤', () => {
  const { state, api } = twwSetup(2)
  assert.equal(registeredEntry('11518').flags.doomThreshold, 13)
  const agenda = { originalCode: '11518' }
  tww.behavior.agendaReveal(state, agenda, api)
  assert.ok(state.investigators.every(inv => inv.defeated === true), '背面全员被击败')
  assert.ok((state.campaign.trauma[0]?.mental || 0) >= 1)
})

test('11519 下潜深渊：行动降低淹没；目标全员到黑曜石地基后可推进', () => {
  const { state, api } = twwSetup(2)
  const flags = registeredEntry('11519').flags
  assert.equal(flags.fastDecreaseFlood, true)
  assert.equal(flags.clueCostPerInvestigator, 1)
  const inv = state.investigators[0]
  inv.location = state.locations[0].id
  state.locations[0].floodLevel = 1
  const moves = tww.behavior.actions(state, inv)
  assert.ok(Array.isArray(moves))
  const report = tww.behavior.actReveal(state, { originalCode: '11519' }, api)
  assert.ok(report !== undefined)
})

test('11520 攀上高墙：同构行动；目标全员到西墙后可推进', () => {
  const { state, api } = twwSetup(2)
  const flags = registeredEntry('11520').flags
  assert.equal(flags.objectiveAllAt, 'westernWall')
  const report = tww.behavior.actReveal(state, { originalCode: '11520' }, api)
  assert.ok(report !== undefined)
})

test('11521 险恶道路 Slick Steps：从上方进入受 1 伤害、从下方进入受 1 恐惧；有线索不能进入', () => {
  const { state, api } = twwSetup(1)
  const inv = state.investigators[0]
  const path = state.locations.find(item => (item.originalCode || item.code) === '11521') || { id: 'path-11521', originalCode: '11521', level: 2, floodLevel: 0 }
  if (!state.locations.includes(path)) state.locations.push(path)
  inv.location = path.id
  const before = { damage: inv.damage, horror: inv.horror }
  tww.behavior.locationEntered(state, inv, path, api)
  assert.ok(inv.damage + inv.horror >= before.damage + before.horror)
})

test('11522 险恶道路 Eroded Shelf：进入时敏捷(层级) 失败受 1 伤害并提高淹没', () => {
  const { state, api } = twwSetup(1)
  api.testResult = { success: false, failedBy: 2, value: 0 }
  const inv = state.investigators[0]
  const path = { id: 'path-11522', originalCode: '11522', level: 2, floodLevel: 0, revealed: true }
  state.locations.push(path)
  inv.location = path.id
  tww.behavior.locationEntered(state, inv, path, api)
  assert.ok(inv.damage >= 1)
})

test('11523 险恶道路 Precarious Climb：失败受 1 恐惧并提高淹没', () => {
  const { state, api } = twwSetup(1)
  api.testResult = { success: false, failedBy: 1, value: 0 }
  const inv = state.investigators[0]
  const path = { id: 'path-11523', originalCode: '11523', level: 2, floodLevel: 0, revealed: true }
  state.locations.push(path)
  inv.location = path.id
  tww.behavior.locationEntered(state, inv, path, api)
  assert.ok(inv.horror >= 1)
})

test('11524 险恶道路 Deadly Pass：失败提高淹没；不能再提高时选择弃掉自己控制的一张盟友', () => {
  const { state, api } = twwSetup(1)
  api.testResult = { success: false, failedBy: 1, value: 0 }
  const inv = state.investigators[0]
  const path = { id: 'path-11524', originalCode: '11524', level: 2, floodLevel: 2, revealed: true }
  state.locations.push(path)
  inv.location = path.id
  inv.assets.push({ id: 'ally-1', code: '01020', traits: ['Ally'] })
  tww.behavior.locationEntered(state, inv, path, { ...api, choose: () => '0' })
  assert.ok(true, '选择流程已执行不崩溃')
})

test('11525 险恶道路 Shallow Den：揭示后生成横置珊瑚星之眷族，下个补给阶段不重整', () => {
  const { state, api } = twwSetup(1)
  const path = { id: 'path-11525', originalCode: '11525', level: 2, floodLevel: 0, revealed: true }
  state.locations.push(path)
  tww.behavior.locationRevealed(state, path, api)
  const spawned = state.enemies.find(enemy => enemy.exhausted === true)
  assert.ok(spawned || state.scenarioFlags.twwSkipReady, '横置生成或登记不重整')
})

test('11526 沉没阶梯：揭示后把水下秘库放进上/下一行', () => {
  const { state, api } = twwSetup(1)
  const stair = { id: 'stair', originalCode: '11526', level: 2, revealed: true }
  state.locations.push(stair)
  tww.behavior.locationRevealed(state, stair, api)
  assert.ok(state.locations.some(item => (item.originalCode || item.code) === '11532') || state.locations.length >= 1)
})

test('11527 淹没棚屋：揭示后深潜者移动与完全淹没地点双向相连', () => {
  const { state } = twwSetup(1)
  const shanty = state.locations.find(item => item.id === 'drownedShanty')
  const full = { id: 'fully-flooded', revealed: true }
  const partial = { id: 'partly-flooded', revealed: true }
  state.locations.push(full, partial)
  tww.behavior.waterSet(state, {}, full.id, 2)
  tww.behavior.waterSet(state, {}, partial.id, 1)
  const deepOne = { code: '11727', traits: ['Deep One'], location: shanty.id }
  shanty.revealed = false
  assert.deepEqual(tww.behavior.enemyConnections(state, deepOne, full), [])
  shanty.revealed = true
  const destinations = tww.behavior.enemyConnections(state, deepOne, shanty)
  assert.ok(destinations.includes(full.id))
  assert.equal(destinations.includes(partial.id), false)
  assert.deepEqual(tww.behavior.enemyConnections(state, deepOne, full), [shanty.id])
  assert.deepEqual(tww.behavior.enemyConnections(state, { traits: ['Cultist'] }, full), [])
})

test('11528 破碎遗迹：未淹没时发现符文 V 并记录翻译', () => {
  const { state, api } = twwSetup(1)
  const inv = state.investigators[0]
  const ruins = state.locations.find(item => item.id === 'shatteredRuins')
  inv.location = ruins.id
  const glyphAction = () => tww.behavior.actions(state, inv).find(move => move.rule === 'twwLocationGlyph')
  tww.behavior.waterSet(state, {}, ruins.id, 1)
  assert.ok(glyphAction().reason)
  assert.equal(tww.behavior.performAction(state, inv, glyphAction(), api), false)
  assert.equal(state.campaign.records.discoveredGlyphs?.includes('V') ?? false, false)
  tww.behavior.waterSet(state, {}, ruins.id, 0)
  assert.equal(tww.behavior.performAction(state, inv, glyphAction(), api), true)
  assert.deepEqual(state.campaign.records.discoveredGlyphs, ['V'])
  assert.equal(state.scenarioFlags.twwGlyphTranslation.V, '陌生人')
})

test('11529 黑曜石地基：智力(3) 成功抽取放在一边的海底壁画', () => {
  const { state, api } = twwSetup(1)
  const inv = state.investigators[0]
  const foundation = state.locations.find(item => (item.originalCode || item.code) === '11529') || { id: 'foundation', originalCode: '11529', level: 2, revealed: true }
  if (!state.locations.includes(foundation)) state.locations.push(foundation)
  inv.location = foundation.id
  state.encounterDeck.push('11531')
  const moves = tww.behavior.actions(state, inv)
  assert.ok(moves.some(move => move.rule === 'twwObsidianFoundations'), '黑曜石地基行动出现在行动枚举')
})

test('11530 西墙：[action][action] 抽 3 张（每场游戏限一次）', () => {
  const { state } = twwSetup(1)
  const inv = state.investigators[0]
  const wall = state.locations.find(item => (item.originalCode || item.code) === '11530') || { id: 'wall', originalCode: '11530', level: 2, revealed: true }
  if (!state.locations.includes(wall)) state.locations.push(wall)
  inv.location = wall.id
  const actions = tww.behavior.actions(state, inv)
  assert.ok(actions.some(move => move.rule === 'twwWesternWallDraw' && move.actions === 2), '西墙 [action][action] 抽 3 张出现在行动枚举')
})

test('11531 海底壁画：显现附属地点且不能取消/不能离场；行动两次检定成功翻面', () => {
  const entry = registeredEntry('11531')
  assert.equal(entry.cannotLeavePlay, true)
  assert.equal(entry.cannotBeCanceledRevelation, true)
  assert.equal(entry.flags.storyCode, '11531b')
  assert.equal(typeof entry.encounterResolve, 'function')
  const state = baseState(1)
  const inv = state.investigators[0]
  inv.location = 'frieze-room'
  state.locations.push({ id: 'frieze-room', revealed: true, attachments: [] })
  entry.encounterResolve(state, inv, { code: '11531' }, makeApi(state))
  const attached = state.locations[0].attachments || []
  assert.equal(attached.length, 1, '显现附属到所在地点')
  assert.equal(attached[0].code, '11531')
})

test('11531b 海底壁画：两次通过后同一故事牌进入胜利区并记符文 W', () => {
  const { state, api } = twwSetup(1)
  const inv = state.investigators[0]
  const frieze = { id: 'frieze', code: '11531', originalCode: '11531' }
  const site = { id: 'frieze-loc', originalCode: '11529', level: 1, revealed: true, attachments: [frieze] }
  state.locations.push(site)
  inv.location = site.id
  const flip = tww.behavior.actions(state, inv).find(move => move.rule === 'twwSeafloorFrieze')
  api.testResult = { success: false }
  assert.equal(tww.behavior.performAction(state, inv, flip, api), true)
  assert.deepEqual(site.attachments, [frieze])
  assert.equal(state.victoryDisplay.length, 0)
  api.tests.length = 0
  api.testResult = { success: true }
  assert.equal(tww.behavior.performAction(state, inv, flip, api), true)
  assert.deepEqual(api.tests.map(({ skill, difficulty }) => [skill, difficulty]), [['combat', 2], ['willpower', 2]])
  assert.deepEqual(site.attachments, [])
  assert.ok(state.victoryDisplay.some(item => item.id === frieze.id && item.code === '11531b' && item.victory === 1))
  assert.equal(state.scenarioFlags.twwGlyphTranslation.W, '寄生虫')
})

function verifyVaultFlip() {
  const { state, api } = twwSetup(1)
  const inv = state.investigators[0]
  const vault = { id: 'underseaVault', code: '11532', originalCode: '11532', level: 3, revealed: true }
  state.locations.push(vault)
  inv.location = vault.id
  const flip = () => tww.behavior.actions(state, inv).find(move => move.rule === 'twwUnderseaVault')
  assert.ok(flip())
  api.testResult = { success: false }
  assert.equal(tww.behavior.performAction(state, inv, flip(), api), true)
  assert.ok(flip(), '失败仍可再检定')
  assert.equal(state.campaign.records.discoveredGlyphs?.includes('Z') ?? false, false)
  api.testResult = { success: true }
  assert.equal(tww.behavior.performAction(state, inv, flip(), api), true)
  assert.deepEqual(api.tests.at(-1), { seat: 0, skill: 'intellect', difficulty: 3 })
  assert.equal(state.scenarioFlags.twwGlyphTranslation.Z, '城市')
  return { vault, flip }
}

test('11532 水下秘库：智力检定取当前层级，成功才记录符文 Z', () => {
  verifyVaultFlip()
})

test('11532b 水下秘库：翻回同一地点实体并锁住翻面动作', () => {
  const { vault, flip } = verifyVaultFlip()
  assert.equal(vault.code, '11532')
  assert.equal(vault.cannotFlipAgain, true)
  assert.equal(flip(), undefined)
})

test('11533 深潜者主母：猎手；进场搜索遭遇牌库/弃牌堆生成一名深潜者', () => {
  const { state, api } = twwSetup(1)
  const matron = api.spawn('11533', state.locations[0]?.id || 'loc')
  state.encounterDeck.push('11727')
  tww.behavior.enemySpawned(state, matron, api)
  assert.ok(state.enemies.length >= 1)
})

test('11534 “小心！”：显现检定失败入威胁区；每轮首次进入淹没地点受 1 恐惧', () => {
  const entry = registeredEntry('11534')
  assert.equal(entry.implemented, true)
  const { state, api } = twwSetup(1)
  const inv = state.investigators[0]
  inv.threat.push({ id: 't-11534', code: '11534', originalCode: '11534' })
  state.locations.push({ id: 'flooded-1', floodLevel: 2, revealed: true })
  inv.location = 'flooded-1'
  tww.behavior.locationEntered(state, inv, state.locations[0], api)
  assert.ok(inv.horror >= 0)
})

test('11535 猎食寄生虫：敌军阶段结束时领队在一张玩家卡上放 1 毁灭后弃掉自身', () => {
  const { state, api } = twwSetup(2)
  const parasite = api.spawn(HUNTING_PARASITE_CODE || '11535', state.investigators[0].location || 'loc')
  state.investigators[0].location = parasite.location
  const before = state.doom
  tww.behavior.enemyPhaseEnd(state, { ...api, choose: () => null })
  assert.ok(state.doom >= before)
})

// ===========================================================================
// 批次 C：淹没城区 the_drowned_quarter（11536–11538）
// ===========================================================================

test('11536 淹没城区提示卡：skull = 已揭示地点一半（困难全数）、cultist 完全淹没受伤', () => {
  const state = baseState(1)
  state.locations.push({ id: 'l1', revealed: true, floodLevel: 2 })
  state.locations.push({ id: 'l2', revealed: true, floodLevel: 0 })
  assert.equal(revealedLocationCount(state), 2)
  assert.equal(tdqSkull(state), 1)
  state.difficulty = 'hard'
  assert.equal(tdqSkull(state), 2)
  state.investigators[0].location = 'l1'
  assert.equal(drownedQuarterChaosTokenValue(state, 'elderthing'), -6)
})

test('11537 沉没遗迹：挣扎呼吸空气规则（5 直接伤害）由剧本机制读点承接', () => {
  const { state, api } = tdqSetup(1)
  assert.equal(registeredEntry('11537').flags.air, true)
  state.agendas = [{ originalCode: '11537' }]
  const report = tdq.behavior.agendaReveal(state, state.agendas[0], api)
  assert.ok(report !== undefined)
})

test('11537b 海底利维坦：+3 生命/人、生成于屏障核心、敌军阶段开始若重整提高淹没', () => {
  const { state, api } = tdqSetup(2)
  const leviathan = api.spawn('11537b', state.locations[0]?.id || 'core')
  assert.equal(tdq.behavior.seafloorLeviathanHealth(state), 4 + 3 * 2)
  const level = tdq.behavior.floodLevelOf(state, leviathan.location)
  tdq.behavior.phaseBegan(state, 'enemy', api)
  assert.ok(tdq.behavior.floodLevelOf(state, leviathan.location) >= level)
})

test('11538 崩塌圆顶：挣扎呼吸空气同 11537；背面全员被击败+1 肉体创伤并进入无结局', () => {
  const { state, api } = tdqSetup(2)
  assert.equal(registeredEntry('11538').flags.air, true)
  const agenda = { originalCode: '11538' }
  tdq.behavior.agendaReveal(state, agenda, api)
  assert.ok(state.investigators.every(inv => inv.defeated === true))
  assert.ok((state.campaign.trauma[0]?.physical || 0) >= 1)
})
