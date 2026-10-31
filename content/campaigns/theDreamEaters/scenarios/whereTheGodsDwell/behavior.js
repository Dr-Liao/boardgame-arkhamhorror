// 神居之所（Where the Gods Dwell · 06286）· 章节行为。
//
// 参考实现：Scenario/Scenarios/TheDreamEaters/WhereTheGodsDwell.hs + 同目录 Helpers.hs，
// 以及 Act/Agenda/Enemy/Location/Treachery Cards/TheDreamEaters/WhereTheGodsDwell/*.hs。
//
// 结构约定（与 TCU theWitchingHour 同构）：
//   `behavior = { ...encounterRules, id: 'whereTheGodsDwell', ... }`。
// 覆盖共享钩子时都显式转发 `encounterRules.<hook>(...)`，否则共享遭遇层会静默失效。
// 单卡规则仍写在单卡条目（enemyScript / actRule / agendaRule / locationRule / flags）；
// 本文件只做「流程 + 读条目数据」，不按卡号写分支（卡号常量集中在 definition.js）。
import {
  actRuleFor, agendaRuleFor, enemySpawnRuleFor, entryFlags, locationRuleFor,
} from '../../../../../src/cards/card-rules.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterRules, original } from '../../encounter-rules.js'
import {
  whereTheGodsDwellChaosToken, whereTheGodsDwellChaosAfterTest,
} from './chaos.js'
import { AGENDA_CODES, ACT_CODES, ABANDONED_BY_THE_GODS, COLD_WASTES, DHOLE_OF_THE_WASTES, FORSAKEN_TOWER_IDS, FORSAKEN_TOWERS, HIGH_PRIEST, LIAR_WITH_NO_FACE, MONASTERY_OF_LENG, MYRIAD_FORMS, NYARLATHOTEP_COPIES, ONYX_CASTLE, ONYX_GATES, PLATEAU_OF_LENG, RECORDS, RESTLESS_JOURNEY, SET_ASIDE_CODES, THE_CRAWLING_MIST, WHISPERING_CHAOS, RAW_CODES as RAW } from './definition.js'

const ID = 'whereTheGodsDwell'
const TRUE_SHAPE_ROLE = 'nyarlathotepTrueShape'
const TRUE_SHAPE_CARD_CODE = RAW.c06293 // 真形不是印刷敌人卡：借用「真实与谎言」幕的卡号做运行期身份
const RANDOLPH_CARTER_EXPERT_DREAMER = RAW.c06059
const SKILL_LABELS = Object.freeze({ willpower: '意志', intellect: '智识', combat: '战斗', agility: '敏捷' })
const TEST_KIND_LABELS = Object.freeze({ investigate: '调查', fight: '攻击', evade: '躲避', willpower: '意志检定' })

const originalOf = original
const activeInvestigators = state => (state?.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const here = (state, inv) => (state?.locations || []).find(location => location.id === inv?.location) || null
const findLocationByCode = (state, code) => (state?.locations || [])
  .find(location => String(originalOf(location)) === String(code)) || null
const findLocationById = (state, id) => (state?.locations || []).find(location => location.id === id) || null
const scenarioFlags = state => (state.scenarioFlags ||= {})
const campaignRecords = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const scenarioZones = state => (state.scenarioZones ||= {})
const perPlayer = state => Math.max(1,
  Number(state?.numInvestigators) || activeInvestigators(state).length || 1)
const actStep = state => Math.max(1, Number(state?.actIndex ?? 0) + 1)
const agendaStep = state => Math.max(1, Number(state?.agendaIndex ?? 0) + 1)
const groupClues = state => activeInvestigators(state).reduce((sum, inv) => sum + (inv.clues || 0), 0)
const isNyarlathotepCopy = code => entryFlags(code)?.nyarlathotepCopy === true
const isNyarlathotepCard = card => ALL_CARDS[String(originalOf(card))]?.name === 'Nyarlathotep'
const copyCardsInVictory = state => (state?.victoryDisplay || []).filter(isNyarlathotepCard)
const isTrueShape = enemy => enemy?.scenarioEnemyRole === TRUE_SHAPE_ROLE
const isTowerLocation = location => locationRuleFor(originalOf(location))?.towerAction != null
const towerCompass = (state, locationId) => scenarioFlags(state).towerCompass?.[locationId] || null
const isHiddenEncounterCard = (state, code) => state?.scenario?.treacheries?.[code]?.hidden === true
  || isNyarlathotepCopy(code)

// ---------------------------------------------------------------------------
// 开局：收齐/放一边/缟玛瑙城堡的未揭示面
// ---------------------------------------------------------------------------

function preScenarioSetup(state, events, api) {
  const flags = scenarioFlags(state)
  if (flags.introSpoken) return
  flags.introSpoken = true
  const records = campaignRecords(state)
  api.info?.(state.scenario.intro || '')
  const carried = records[RECORDS.carriedToTheColdWastes] === true
  flags.introVariant = carried ? 'carried' : 'traveled'
  const variant = state.scenario.introVariants?.[flags.introVariant]
  if (variant) api.info?.(variant)
}

function setupLocations(state) {
  const zones = scenarioZones(state)
  // 放在一边的遭遇卡（13 张）：大祭司、5 个奈亚拉托提普、4 张混沌低语、2 张万千化身、蠕动之雾。
  zones.setAside = [...SET_ASIDE_CODES]
  // 6 座被遗忘的高塔通过 definition.setAsideLocations 声明；这里只放入场的 5 个地点。
  return ['plateauOfLeng', 'coldWastes', 'monasteryOfLeng', 'onyxGates', 'theOnyxCastle']
}

function afterDeckSetup(state, events, helper = {}) {
  // 缟玛瑙城堡入场时未揭示面朝上：显示「缟玛瑙城堡」，揭示后（act 3 背面）恢复「大礼堂」。
  const castle = findLocationByCode(state, ONYX_CASTLE)
  if (castle) {
    castle.name = ALL_CARDS[ONYX_CASTLE]?.backNameZh || 'The Onyx Castle'
    castle.unrevealedActualName = ALL_CARDS[ONYX_CASTLE]?.nameZh || 'The Great Hall'
    castle.hiddenIdentity = false
  }
  helper.info?.(`📍 神居之所：5 个地点入场，6 座被遗忘的高塔与 13 张遭遇卡放在一边。`)
}

// ---------------------------------------------------------------------------
// 混乱标记：数值 + 失败后果 + 冷原的地点强制
// ---------------------------------------------------------------------------

function resolveChaosToken(state, inv, token) {
  return whereTheGodsDwellChaosToken(state, inv, token)
}

function coldWastesTokenPenalty(state, inv, result, api) {
  if (!result || !inv || result.wgdColdWastesHandled) return
  const sourceCode = originalOf(result.source || {})
  const location = (state.locations || [])
    .find(entry => String(originalOf(entry)) === String(sourceCode))
  if (!location) return
  const rule = locationRuleFor(originalOf(location))?.tokenPenalty
  if (!rule) return
  const cancelled = new Set(result.cancelledTokens || [])
  const tokens = (result.drawn || []).filter(token => !cancelled.has(token))
  if (!tokens.some(token => (rule.tokens || []).includes(token))) return
  result.wgdColdWastesHandled = true
  const canLoseAction = (inv.actionsLeft || 0) > 0
  const options = [{ id: 'damage', label: `受到 ${rule.damage ?? 1} 点伤害` }]
  if (canLoseAction) options.push({ id: 'loseAction', label: `失去 ${rule.loseAction ?? 1} 个行动` })
  const answer = api.choose?.({
    kind: 'location', source: originalOf(location), seat: inv.seat,
    prompt: `「${location.name || '冰封荒土'}」：你必须受到 1 点伤害或失去 1 个行动。`,
    options,
  })
  if (answer === 'loseAction' && canLoseAction) {
    api.loseActions?.(inv.seat, rule.loseAction ?? 1)
    api.info?.(`❄️ 「${location.name || '冰封荒土'}」：${inv.name} 失去 1 个行动。`)
  } else {
    api.damage?.(inv.seat, rule.damage ?? 1)
    api.info?.(`❄️ 「${location.name || '冰封荒土'}」：${inv.name} 受到 1 点伤害。`)
  }
}

function afterTest(state, inv, result, api) {
  encounterRules.afterTest?.(state, inv, result, api)
  whereTheGodsDwellChaosAfterTest(state, inv, result, api)
  coldWastesTokenPenalty(state, inv, result, api)
}

// ---------------------------------------------------------------------------
// 幕 / 议程
// ---------------------------------------------------------------------------

function actReveal(state, act, api) {
  const rule = actRuleFor(String(originalOf(act))) || {}
  const flow = rule.chapterFlow || act.chapterFlow
  if (flow === 'grandDesign') return resolveGrandDesign(state, act, api)
  if (flow === 'trueShape') return resolveTrueShape(state, act, api)
  if (typeof rule.onReveal === 'function') return rule.onReveal(state, act, api)
  return undefined
}

function agendaReveal(state, agenda, api) {
  const rule = agendaRuleFor(String(originalOf(agenda)), state.scenario?.id) || {}
  if (typeof rule.onReveal === 'function') return rule.onReveal(state, agenda, api)
  // 06287 / 06288 的背面：仅当当前幕为 act 4 时结算（两段同一实现）。
  if (rule.advance?.revealNyarlathotepHands) return resolveAgendaRevealNyarlathotepHands(state, agenda, api)
  return undefined
}

// 「如果当前幕是场景 4：在每个被遗忘的高塔上放置线索直到其线索值；
//   揭示每位调查员手中每张奈亚拉托提普……；未揭示者受到 1 伤害或 1 恐惧；
//   每张被揭示的复制品：选择攻击 1 次并洗回遭遇牌库 / 攻击 3 次并回到手牌。」
function resolveAgendaRevealNyarlathotepHands(state, agenda, api) {
  if (actStep(state) !== 4) return true
  // 1) 每座塔：线索补到「线索值」（maxClues = 揭示时的线索数）。
  for (const location of (state.locations || []).filter(isTowerLocation)) {
    const target = Number(location.maxClues ?? 0)
    const current = Number(location.clues || 0)
    if (target > current) api.addCluesToLocation?.(location.id, target - current)
  }
  // 2) 揭示每位调查员手中的全部复制品并记录持有者。
  const holders = new Map()
  for (const inv of activeInvestigators(state)) {
    const copies = (api.hiddenCards?.list?.(inv.seat) || []).filter(isNyarlathotepCopy)
    if (!copies.length) continue
    holders.set(inv.seat, copies)
    for (const code of copies) api.cardReveal?.(code, '揭示手牌中的奈亚拉托提普')
  }
  // 3) 没有揭示复制品的调查员：受到 1 伤害或 1 恐惧。
  for (const inv of activeInvestigators(state)) {
    if (holders.has(inv.seat)) continue
    const answer = api.choose?.({
      kind: 'choice', source: originalOf(agenda), seat: inv.seat,
      prompt: '你没有揭示奈亚拉托提普：受到 1 点伤害或 1 点恐惧。',
      options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
    })
    if (answer === 'horror') api.horror?.(inv.seat, 1)
    else api.damage?.(inv.seat, 1)
  }
  // 4) 每张被揭示的复制品：攻击抽牌者；选择「1 次 + 洗回」或「3 次 + 回到手牌」。
  for (const [seat, copies] of holders) {
    const inv = state.investigators[seat]
    for (const code of copies) {
      const definition = ALL_CARDS[code] || {}
      const answer = api.choose?.({
        kind: 'story', source: originalOf(agenda), seat,
        prompt: `奈亚拉托提普（${definition.subnameZh || definition.subname || code}）：选择结算方式。`,
        options: [
          { id: 'shuffled', label: '立即攻击你 1 次，并被洗回遭遇牌库' },
          { id: 'returned', label: '立即攻击你 3 次，并回到你的手牌' },
        ],
      })
      const times = answer === 'returned' ? 3 : 1
      for (let index = 0; index < times; index += 1) {
        if (Number(definition.damage) > 0) api.damage?.(seat, Number(definition.damage))
        if (Number(definition.horror) > 0) api.horror?.(seat, Number(definition.horror))
      }
      if (answer === 'returned') {
        api.info?.(`👁️ 奈亚拉托提普攻击 ${inv?.name || '调查员'} 3 次后回到其手牌。`)
      } else if (api.hiddenCards?.take?.(seat, code)) {
        api.shuffleIntoEncounterDeck?.([code])
        api.info?.(`👁️ 奈亚拉托提普攻击 ${inv?.name || '调查员'} 后洗回遭遇牌库。`)
      }
    }
  }
  return true
}

function checkObjectives(state, api) {
  const act = state.acts?.[state.actIndex]
  if (!act) return
  const objective = act.objectiveRule
  if (!objective) return
  const flags = scenarioFlags(state)
  if (objective === 'defeatHighPriest') {
    if (flags.defeatHighPriestTriggered) return
    const priestInPlay = (state.enemies || []).some(enemy => String(originalOf(enemy)) === HIGH_PRIEST)
    const inVictory = (state.victoryDisplay || []).some(card => String(originalOf(card)) === HIGH_PRIEST)
    if (!priestInPlay && inVictory) {
      flags.defeatHighPriestTriggered = true
      api.advanceAct?.()
    }
    return
  }
  if (objective === 'allAtOnyxGates') {
    if (flags.beyondDreamsTriggered) return
    const gates = findLocationByCode(state, ONYX_GATES)
    const investigators = activeInvestigators(state)
    if (gates && investigators.length
      && investigators.every(inv => inv.location === gates.id) && (gates.clues || 0) === 0) {
      flags.beyondDreamsTriggered = true
      api.advanceAct?.()
    }
    return
  }
  if (objective === 'nyarlathotepCopiesInVictory') {
    if (flags.truthAndLiesTriggered) return
    if (copyCardsInVictory(state).length >= 1 + perPlayer(state)) {
      flags.truthAndLiesTriggered = true
      api.advanceAct?.()
    }
    return
  }
  if (objective === 'trueShapeDefeated') {
    if (flags.trueShapeTriggered) return
    const spawned = flags.trueShapeSpawned === true
    const inPlay = (state.enemies || []).some(isTrueShape)
    if (spawned && !inPlay) {
      flags.trueShapeTriggered = true
      api.advanceAct?.()
    }
  }
}

// ---------------------------------------------------------------------------
// 幕 3 背面：Grand Design（大设计）
// ---------------------------------------------------------------------------

function removeCodeFromDeck(inv, code) {
  const index = (inv?.deck || []).indexOf(code)
  if (index >= 0) inv.deck.splice(index, 1)
}

function resolveGrandDesign(state, act, api) {
  const scenario = state.scenario
  const records = campaignRecords(state)
  const flags = scenarioFlags(state)
  // 1) 每位调查员失去所有线索（近似为花掉：没有「失去线索」原语，见 scenarioApproximations）。
  for (const inv of activeInvestigators(state)) {
    if ((inv.clues || 0) > 0) api.spendClues?.(inv.seat, inv.clues)
  }
  // 2) Grand Design 1
  api.info?.(scenario.grandDesign?.[0] || '')
  // 3) 揭示缟玛瑙城堡（大礼堂），所有调查员移入，移除其余地点。
  const castle = findLocationByCode(state, ONYX_CASTLE)
  if (!castle) {
    api.info?.('「梦境之外」：缟玛瑙城堡不在场上，跳过幕间。')
    return true
  }
  if (!castle.revealed) api.reveal?.(castle.id)
  for (const inv of activeInvestigators(state)) api.moveInvestigator?.(inv.seat, castle.id)
  for (const location of [...(state.locations || [])]) {
    if (location.id === castle.id) continue
    api.removeLocationFromGame?.(location.id)
  }
  api.info?.(`🏛️ 调查员们进入大礼堂；场上其他地点被移出游戏。`)
  // 4) Grand Design 2 / 3 / 4
  if (records[RECORDS.randolphSurvivedTheVoyage] === true) {
    api.info?.(scenario.grandDesign?.[1] || '')
    // 伦道夫·卡特（专家入梦者）从每位调查员的牌组移除（战役内持续）。
    for (const inv of state.investigators) removeCodeFromDeck(inv, RANDOLPH_CARTER_EXPERT_DREAMER)
    for (const record of state.campaign?.investigators || []) {
      if (!record) continue
      const index = (record.deck || []).indexOf(RANDOLPH_CARTER_EXPERT_DREAMER)
      if (index >= 0) record.deck.splice(index, 1)
    }
  } else {
    api.info?.(scenario.grandDesign?.[2] || '')
  }
  if (records[RECORDS.blackCatAtYourSide] === true) api.info?.(scenario.grandDesign?.[3] || '')
  api.info?.(scenario.grandDesign?.[4] || '')
  // 5) 随机 1+人数 张 set-aside 奈亚拉托提普复制品洗入遭遇牌库，其余移出游戏。
  const aside = Array.isArray(scenarioZones(state).setAside) ? scenarioZones(state).setAside : []
  const copyPool = aside.filter(isNyarlathotepCopy)
  const shuffledCopies = api.shuffle?.([...copyPool]) || [...copyPool]
  const copyCount = 1 + perPlayer(state)
  const chosenCopies = shuffledCopies.slice(0, copyCount)
  const removedCopies = shuffledCopies.slice(copyCount)
  for (const code of chosenCopies) api.takeFromSetAside?.(code)
  if (chosenCopies.length) api.shuffleIntoEncounterDeck?.(chosenCopies)
  for (const code of removedCopies) {
    if (!api.takeFromSetAside?.(code)) continue
    state.removedFromGame ||= []
    state.removedFromGame.push(code)
  }
  api.info?.(`🎴 洗入遭遇牌库 ${chosenCopies.length} 张奈亚拉托提普复制品，其余 ${removedCopies.length} 张移出游戏。`)
  // 6) 其余 set-aside 遭遇卡 + 遭遇弃牌堆洗入遭遇牌库。
  const otherCards = [THE_CRAWLING_MIST, MYRIAD_FORMS, MYRIAD_FORMS, ...WHISPERING_CHAOS]
  for (const code of otherCards) api.takeFromSetAside?.(code)
  api.shuffleIntoEncounterDeck?.(otherCards)
  api.shuffleDiscard?.()
  api.info?.('🌀 蠕动之雾、万千化身、混沌低语与遭遇弃牌堆一起洗回遭遇牌库。')
  // 7) 随机 4 座被遗忘的高塔入场，按北/东/南/西记方向；其余 2 座移出游戏。
  const towerOrder = api.shuffle?.([...FORSAKEN_TOWER_IDS]) || [...FORSAKEN_TOWER_IDS]
  const directions = ['north', 'east', 'south', 'west']
  const compass = {}
  const removedTowers = []
  for (const [index, towerId] of towerOrder.entries()) {
    if (index < directions.length) {
      api.place?.(towerId)
      if (findLocationById(state, towerId)) compass[towerId] = directions[index]
    } else {
      removedTowers.push(towerId)
    }
  }
  api.setScenarioFlag?.('towerCompass', compass)
  if (removedTowers.length) flags.removedTowers = removedTowers
  const names = Object.entries(compass).map(([id, direction]) => {
    const location = findLocationById(state, id)
    return `${location?.name || id}（${{ north: '北', east: '东', south: '南', west: '西' }[direction]}）`
  })
  api.info?.(`🗼 4 座被遗忘的高塔随机放逐到大礼堂四周：${names.join('、')}。`)
  return true
}

// ---------------------------------------------------------------------------
// 幕 4 背面：合成「奈亚拉托提普的真形」
// ---------------------------------------------------------------------------

function resolveTrueShape(state, act, api) {
  const rule = actRuleFor(String(originalOf(act))) || {}
  const truth = rule.truthShape || {}
  const records = campaignRecords(state)
  const flags = scenarioFlags(state)
  for (const inv of activeInvestigators(state)) {
    if ((inv.clues || 0) > 0) api.spendClues?.(inv.seat, inv.clues)
  }
  const knowsTruth = records[truth.blackCatKnowsTruthRecord || RECORDS.blackCatKnowsTheTruth] === true
  const hasKey = records[truth.silverKeyRecord || RECORDS.silverKey] === true
  const copies = copyCardsInVictory(state)
  if (!knowsTruth || !hasKey || !copies.length) {
    api.info?.('🌫️ 黑猫未能揭露真形（缺记录或胜利区没有奈亚拉托提普）：进入结局 1。')
    api.finish?.('resolution1')
    return true
  }
  // 合成敌人：攻/躲取最高，生命/伤害/恐惧/胜利取总和，获得全部关键词与特性。
  const stats = {
    name: '奈亚拉托提普的真形', fight: 0, evade: 0, health: 0, damage: 0, horror: 0, victory: 0,
    hunter: false, alert: false, massive: false, retaliate: false, elite: true, traits: [],
  }
  const traits = new Set()
  for (const copy of copies) {
    const code = String(originalOf(copy))
    const definition = state.scenario.enemies?.[code] || ALL_CARDS[code] || {}
    stats.fight = Math.max(stats.fight, Number(definition.fight || 0))
    stats.evade = Math.max(stats.evade, Number(definition.evade || 0))
    stats.health += Number(definition.health || 0)
    stats.damage += Number(definition.damage || 0)
    stats.horror += Number(definition.horror || 0)
    stats.victory += Number(definition.victory || 0)
    for (const keyword of ['hunter', 'alert', 'massive', 'retaliate', 'aloof']) {
      if (definition[keyword]) stats[keyword] = true
    }
    for (const trait of definition.traits || []) traits.add(trait)
  }
  stats.traits = [...traits]
  const spawn = findLocationByCode(state, truth.spawnLocationCode || ONYX_CASTLE)
  if (!spawn) {
    api.finish?.('resolution1')
    return true
  }
  api.spawnStoryEnemy?.(TRUE_SHAPE_CARD_CODE, spawn.id, stats, { scenarioEnemyRole: truth.role || TRUE_SHAPE_ROLE })
  flags.trueShapeSpawned = true
  api.info?.(`👁️ 胜利区的 ${copies.length} 张奈亚拉托提普合成了「奈亚拉托提普的真形」，生成在「${spawn.name}」。`)
  // 每座被遗忘的高塔：线索补到线索值。
  for (const location of (state.locations || []).filter(isTowerLocation)) {
    const target = Number(location.maxClues ?? 0)
    const current = Number(location.clues || 0)
    if (target > current) api.addCluesToLocation?.(location.id, target - current)
  }
  return true
}

// ---------------------------------------------------------------------------
// 行动：幕的 [action]、地点条目 actions、塔行动、隐藏手牌 [fast] 行动
// ---------------------------------------------------------------------------

function actActionMoves(state, inv, moves) {
  const act = state.acts?.[state.actIndex]
  if (!act) return
  const rule = actRuleFor(String(originalOf(act))) || {}
  if (rule.defeatPriestAction) {
    const flags = scenarioFlags(state)
    const ready = (rule.defeatPriestAction.requiresRemembered || [])
      .every(key => flags[key] === true)
    const priest = (state.enemies || [])
      .find(enemy => String(originalOf(enemy)) === String(rule.defeatPriestAction.targetCode))
    if (ready && priest) {
      moves.push({
        action: 'scenarioAction', rule: rule.defeatPriestAction.rule, actions: 1, scriptCard: 'act',
        label: '🕯️ 击败不可描述的高阶祭司（已靠近并打晕）',
      })
    }
  }
  if (rule.clueAction && (inv.clues || 0) >= Number(rule.clueAction.clues || 1)) {
    moves.push({
      action: 'scenarioAction', rule: rule.clueAction.rule, actions: 1, scriptCard: 'act',
      label: `🔮 花费 ${rule.clueAction.clues} 个线索：查看遭遇牌库顶 ${rule.clueAction.lookCount} 张，抽取其中的隐私卡`,
    })
  }
}

function performActAction(state, inv, move, api) {
  const act = state.acts?.[state.actIndex]
  if (!act) return false
  const rule = actRuleFor(String(originalOf(act))) || {}
  if (rule.defeatPriestAction && move.rule === rule.defeatPriestAction.rule) {
    const priest = (state.enemies || [])
      .find(enemy => String(originalOf(enemy)) === String(rule.defeatPriestAction.targetCode))
    if (!priest) return false
    const health = Math.max(1, Number(priest.health ?? priest.maxHealth ?? 1))
    api.damageEnemy?.(priest.id, health, inv.seat)
    api.info?.(`🕯️ ${inv.name} 击败了不可描述的高阶祭司。`)
    return true
  }
  if (rule.clueAction && move.rule === rule.clueAction.rule) {
    if ((inv.clues || 0) < Number(rule.clueAction.clues || 1)) return false
    api.spendClues?.(inv.seat, Number(rule.clueAction.clues || 1))
    const codes = api.discardEncounterTop?.(Number(rule.clueAction.lookCount || 3), { reshuffle: false, log: false }) || []
    let drawn = 0
    for (const code of codes) {
      if (!isHiddenEncounterCard(state, code)) continue
      if (api.takeEncounterDiscard?.(code) && api.hiddenCards?.place?.(inv.seat, code)) drawn += 1
    }
    api.info?.(`🔮 ${inv.name} 查看遭遇牌库顶 ${codes.length} 张：其中 ${drawn} 张隐私卡秘密加入手牌，其余弃掉。`)
    return true
  }
  return false
}

function towerActionMove(state, inv, location) {
  if (!location || !location.revealed) return null
  const data = locationRuleFor(originalOf(location))?.towerAction
  if (!data) return null
  const compass = towerCompass(state, location.id)
  if (!compass) return null
  const whisper = (inv.hand || []).find(code => entryFlags(code)?.whisperingChaos === compass)
  const copies = (inv.hand || []).filter(code => isNyarlathotepCopy(code))
  if (!whisper || !copies.length) return null
  return {
    action: 'scenarioAction', rule: `${data.rule}:${location.id}`, actions: 1, noOpportunityAttack: true,
    label: `🗼 「${location.name}」：揭示混沌低语与奈亚拉托提普，进行${TEST_KIND_LABELS[data.testKind] || '检定'}`,
  }
}

function performTowerAction(state, inv, move, api, location, data) {
  const compass = towerCompass(state, location.id)
  const whisper = (inv.hand || []).find(code => entryFlags(code)?.whisperingChaos === compass)
  const copies = (inv.hand || []).filter(code => isNyarlathotepCopy(code))
  if (!whisper || !copies.length) return false
  api.cardReveal?.(whisper, '揭示混沌低语')
  let chosen = copies[0]
  if (copies.length > 1) {
    const answer = api.choose?.({
      kind: 'card', source: originalOf(location), seat: inv.seat,
      prompt: '选择并揭示你手中的一张奈亚拉托提普。',
      options: copies.map((code, index) => ({ id: String(index), label: ALL_CARDS[code]?.nameZh || code })),
    })
    const parsed = Number(answer)
    if (Number.isInteger(parsed) && copies[parsed]) chosen = copies[parsed]
  }
  api.cardReveal?.(chosen, '揭示手牌中的奈亚拉托提普')
  const definition = ALL_CARDS[chosen] || {}
  const difficulty = Number(definition[data.difficultyKind] ?? definition.health ?? 0)
  const source = {
    type: 'scenario',
    label: data.testKind === 'investigate' ? '调查' : (TEST_KIND_LABELS[data.testKind] || data.testKind),
    name: location.name, code: originalOf(location),
  }
  api.test?.(inv.seat, data.skill, difficulty, result => {
    if (result?.success) {
      api.moveCard?.({ code: chosen, from: 'hand', to: 'victoryDisplay', ownerSeat: inv.seat })
      api.hiddenCards?.removeMarker?.(inv.seat, chosen)
      api.hiddenCards?.discard?.(inv.seat, whisper)
      api.info?.(`✅ 「${location.name}」：奈亚拉托提普的复制品被放入胜利区，混沌低语被弃掉。`)
      return
    }
    if (Number(definition.damage) > 0) api.damage?.(inv.seat, Number(definition.damage))
    if (Number(definition.horror) > 0) api.horror?.(inv.seat, Number(definition.horror))
    if (api.hiddenCards?.take?.(inv.seat, chosen)) api.shuffleIntoEncounterDeck?.([chosen])
    if (api.hiddenCards?.take?.(inv.seat, whisper)) api.shuffleIntoEncounterDeck?.([whisper])
    api.info?.(`❌ 「${location.name}」：奈亚拉托提普攻击了 ${inv.name}，随后与混沌低语一起被洗回遭遇牌库。`)
  }, 0, source)
  return true
}

function restlessJourneyMoves(state, inv, moves) {
  const hidden = new Set(inv.hiddenCards || [])
  for (const code of inv.hand || []) {
    if (!hidden.has(code)) continue
    const data = entryFlags(code)?.restlessJourney
    if (!data) continue
    moves.push({
      action: 'scenarioAction', rule: `restlessJourney:${code}`, actions: 0, fast: true,
      label: `😴 弃掉无眠之旅并检定${SKILL_LABELS[data.skill] || data.skill}(${data.difficulty})；失败在当前密谋放 1 毁灭`,
    })
  }
}

function performRestlessJourney(state, inv, move, api) {
  const code = String(move.rule).slice('restlessJourney:'.length)
  const data = entryFlags(code)?.restlessJourney
  if (!data) return false
  if (!api.hiddenCards?.has?.(inv.seat, code)) return false
  api.hiddenCards.discard(inv.seat, code)
  api.test?.(inv.seat, data.skill, Number(data.difficulty || 3), result => {
    if (result?.success) return
    api.addDoom?.(1)
    api.info?.(`😴 「无眠之旅」检定失败：在当前密谋上放置 1 个毁灭（可能导致推进）。`)
  })
  return true
}

function collectActions(state, inv) {
  const moves = [...(encounterRules.actions?.(state, inv) || [])]
  const location = here(state, inv)
  if (location) locationRuleFor(originalOf(location))?.actions?.({ moves, state, inv, location })
  const tower = towerActionMove(state, inv, location)
  if (tower) moves.push(tower)
  actActionMoves(state, inv, moves)
  restlessJourneyMoves(state, inv, moves)
  return moves
}

function fastActions(state, inv) {
  return collectActions(state, inv).filter(move => (move.actions ?? 1) === 0 && move.fast === true)
}

function performAction(state, inv, move, api) {
  if (encounterRules.performAction?.(state, inv, move, api)) return true
  const location = here(state, inv)
  if (location) {
    const rule = locationRuleFor(originalOf(location))
    if (rule?.performAction?.(state, inv, move, api)) return true
    const towerData = rule?.towerAction
    if (towerData && String(move.rule).startsWith(`${towerData.rule}:`)) {
      const locationId = String(move.rule).slice(towerData.rule.length + 1)
      const towerLocation = findLocationById(state, locationId)
      if (towerLocation) return performTowerAction(state, inv, move, api, towerLocation, towerData)
    }
  }
  if (String(move.rule).startsWith('restlessJourney:')) return performRestlessJourney(state, inv, move, api)
  if (performActAction(state, inv, move, api)) return true
  throw new Error(`未知神居之所行动：${move.rule}`)
}

// ---------------------------------------------------------------------------
// 地点 / 敌人读点
// ---------------------------------------------------------------------------

function blockedLocationError(destination) {
  if (!destination) return null
  const rule = locationRuleFor(originalOf(destination))
  if (rule?.blockedWhileUnrevealed !== true || destination.revealed) return null
  return `「${destination.name || destination.id}」的入口尚未揭示：从这一面不能进入。`
}

function locationShroudModifier(state, location) {
  const perInvestigator = Number(locationRuleFor(originalOf(location))?.shroudPerInvestigator || 0)
  return perInvestigator * perPlayer(state)
}

function spawnLocation(state, code, fallbackLoc, engagedSeat, api) {
  // 5 种奈亚拉托提普复制品只能秘密进入手牌：返回不存在的哨兵 → 引擎按生成失败处理。
  if (isNyarlathotepCopy(code)) return '__hidden_in_hand__'
  const rule = enemySpawnRuleFor(code)
  if (rule?.spawnAtAnyOfCodes) {
    const candidates = (state.locations || [])
      .filter(location => rule.spawnAtAnyOfCodes.includes(String(originalOf(location))))
    if (candidates.length) {
      if (candidates.length === 1) return candidates[0].id
      const answer = api.choose?.({
        kind: 'location', source: code, seat: state.campaign?.leadSeat ?? 0,
        prompt: '选择荒土蠕虫的生成地点（冰封荒土或大礼堂）。',
        options: candidates.map(location => ({ id: location.id, label: location.name })),
      })
      return candidates.find(location => location.id === answer)?.id || candidates[0].id
    }
  }
  // 冷原：敌人试图生成在无人地点、且场上没有无人地点时改为生成在冷原。
  const plateau = (state.locations || [])
    .find(location => locationRuleFor(originalOf(location))?.emptySpawnFallback === true)
  if (plateau && fallbackLoc == null) {
    const emptyLocations = (state.locations || []).filter(location =>
      !activeInvestigators(state).some(inv => inv.location === location.id)
      && !(state.enemies || []).some(enemy => enemy.location === location.id))
    if (!emptyLocations.length) return plateau.id
  }
  return fallbackLoc
}

function spawnFailed(state, code, engagedSeat, api) {
  if (!isNyarlathotepCopy(code) || !Number.isInteger(engagedSeat)) return
  if (api.takeEncounterDiscard?.(code) && api.hiddenCards?.place?.(engagedSeat, code)) {
    api.info?.(`🤫 「${ALL_CARDS[code]?.nameZh || code}」被秘密加入 ${state.investigators[engagedSeat]?.name || '调查员'} 的手牌。`)
  }
}

function canFightHidden(state, inv, code) {
  if (isNyarlathotepCopy(code)) return false
  return encounterRules.canFightHidden?.(state, inv, code)
}

function canEvadeHidden(state, inv, code) {
  if (isNyarlathotepCopy(code)) return false
  return encounterRules.canEvadeHidden?.(state, inv, code)
}

function canOpportunityAttack(state, enemy) {
  return entryFlags(String(originalOf(enemy)))?.cannotMakeOpportunityAttacks !== true
}

function enemyStatModifier(state, enemy, stat) {
  let value = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
  const flags = entryFlags(String(originalOf(enemy))) || {}
  // 大祭司：打晕后直到本场冒险结束攻击值 -3（剧本内「记住」= scenarioFlags）。
  if (stat === 'fight' && Number.isFinite(flags.stunnedFightPenalty)
    && scenarioFlags(state).stunnedThePriest === true) {
    value += Number(flags.stunnedFightPenalty)
  }
  // 食梦者：真形每有 1 点团队线索，生命值 -1。
  if (stat === 'health' && isTrueShape(enemy)) {
    const act = state.acts?.[state.actIndex]
    const rule = act ? actRuleFor(String(originalOf(act))) : null
    if (rule?.trueShapeHealthPerClue) value -= groupClues(state) * Number(rule.trueShapeHealthPerClue)
  }
  return value
}

function enemyAttackModifier(state, enemy, inv) {
  const bonus = Number(entryFlags(String(originalOf(enemy)))?.whisperBonusDamage || 0)
  if (!bonus) return {}
  const whisper = (inv?.hand || []).find(code => entryFlags(code)?.whisperingChaos)
  return whisper ? { damage: bonus } : {}
}

function enemyAttackStarted(state, enemy, inv, api) {
  if (!Number(entryFlags(String(originalOf(enemy)))?.whisperBonusDamage || 0)) return
  const whisper = (inv?.hand || []).find(code => entryFlags(code)?.whisperingChaos)
  if (whisper) api.cardReveal?.(whisper, '揭示混沌低语')
}

// ---------------------------------------------------------------------------
// 结局 / 记录
// ---------------------------------------------------------------------------

function scenarioResolution(state, key, events, deps = {}) {
  const records = campaignRecords(state)
  const flags = scenarioFlags(state)
  const leadSeat = state.campaign?.leadSeat ?? 0
  const choose = deps.choose || (() => null)
  const copyVictoryBonus = () => copyCardsInVictory(state)
    .reduce((sum, card) => sum + Number(ALL_CARDS[String(originalOf(card))]?.victory || 0), 0)
  const pickContinuation = () => {
    const options = [
      { id: 'wakeUp', label: '醒来' },
      { id: 'remainOnSurface', label: '留在幻梦境的地表' },
    ]
    if (records[RECORDS.knowOfAnotherPath] === true) {
      options.push({ id: 'ventureIntoUnderworld', label: '进入地下世界寻找同伴' })
    }
    return choose({
      kind: 'story', source: 'resolution', seat: leadSeat,
      prompt: '选择调查员们接下来的去向。', options,
    }) || options[0].id
  }
  const applyContinuation = answer => {
    flags.resolutionContinuation = answer
    if (answer === 'wakeUp') records[RECORDS.awoke] = true
    else if (answer === 'remainOnSurface') records[RECORDS.stayedInDreamlands] = true
    else if (answer === 'ventureIntoUnderworld') records[RECORDS.traveledBeneathMonastery] = true
  }
  switch (key) {
    case 'noResolution':
      records[RECORDS.invasionHasBegun] = true
      return { award: false }
    case 'resolution1':
    case 'resolution2': {
      if (key === 'resolution2') records[RECORDS.banishedNyarlathotep] = true
      else records[RECORDS.escapedGrasp] = true
      for (const inv of state.investigators) deps.addTrauma?.(state, inv.seat, 'mental', 2, events)
      applyContinuation(pickContinuation())
      const bonus = copyVictoryBonus() + (key === 'resolution2' ? 5 : 0)
      return { award: true, bonus }
    }
    case 'resolution3':
      records[RECORDS.awoke] = true
      return { award: false }
    case 'resolution4':
      records[RECORDS.stayedInDreamlands] = true
      return { award: false }
    case 'resolution5':
      records[RECORDS.traveledBeneathMonastery] = true
      return { award: false }
    default:
      throw new Error(`未知神居之所结局：${key}`)
  }
}

// ---------------------------------------------------------------------------
// 导出
// ---------------------------------------------------------------------------

export const implementedEncounterCodes = [
  ...AGENDA_CODES, ...ACT_CODES, ...FORSAKEN_TOWERS.map(tower => tower.code),
  PLATEAU_OF_LENG, COLD_WASTES, MONASTERY_OF_LENG, ONYX_GATES, ONYX_CASTLE,
  ...NYARLATHOTEP_COPIES, HIGH_PRIEST, DHOLE_OF_THE_WASTES, LIAR_WITH_NO_FACE,
  ...WHISPERING_CHAOS, MYRIAD_FORMS, ...RESTLESS_JOURNEY, ABANDONED_BY_THE_GODS,
]

export const scenarioApproximations = Object.freeze([
  '「失去所有线索」用 api.spendClues 近似（引擎没有「失去线索」原语），可能触发「花费线索」类反应；'
    + '涉及 06292 背面、06293 背面两处。',
  '手牌中的奈亚拉托提普复制品「攻击你」按印刷伤害/恐惧直接结算（没有敌人实例，攻击修正/敌人攻击反应窗口缺失）；'
    + '涉及议程背面、万千化身、塔行动失败三处。',
  '6 座被遗忘的高塔的方向（北/东/南/西）记在 scenarioFlags.towerCompass，用于「混沌低语 × 塔」匹配；'
    + '静态 UI 布局给 6 个固定槽位，运行时不做真正的地图重排（引擎 layout 为静态数据）。',
  '「击败不可描述的高阶祭司」的幕 2 [action] 用 api.damageEnemy 打满生命表达「直接击败」（会触发受伤类窗口）。',
  '结局 1/2 之后的去向选择（醒来/留在幻梦境/进入地下世界）在本次冒险内直接写战役记录与 scenarioFlags，'
    + '战役流程节点由战役层（P8-7）承接；冒险结果键仍记为 resolution1/resolution2。',
  '「伦道夫·卡特（专家入梦者）从牌组移除」直接改 inv.deck 与 campaign.investigators[].deck（战役内持续）。',
  '「查看遭遇牌库顶 3 张并抽取其中的隐私卡」用 api.discardEncounterTop + 取回弃牌堆隐私卡近似，'
    + '「查看」不显示给玩家单独的排序窗口。',
  '冷原（06295）的「无人地点生成替换」只在 engine 未指定生成地点（fallbackLoc 为空）且场上没有无人地点时生效；'
    + '引擎没有「本次生成目标是无人地点」的显式参数。',
])

export const scenarioGaps = Object.freeze([
  '06306–06310「这张卡牌在你手牌中且未揭示时，如果你提到它，则你发疯」是桌面口头约定，没有可机械化读点。',
  'Hidden 敌人（奈亚拉托提普 5 形态）的通用「手牌中攻击/躲避」入口被 canFightHidden/canEvadeHidden 关闭：'
    + '参考实现只允许通过塔/幕/行动揭示并结算，不存在通用攻击。',
  '真形合成后的关键词由 definition 的 Enemy 数据读取（Hunter/Alert/Massive/Retaliate）；'
    + '「获得全部关键词」不含非关键词能力（如反击/警戒之外的关键词未被印刷在 5 形态上）。',
])

export const behavior = {
  ...encounterRules,
  id: ID,
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,

  // ---- setup ----
  preScenarioSetup,
  setupLocations,
  afterDeckSetup,

  // ---- 混乱标记 ----
  resolveChaosToken,
  afterTest,

  // ---- 幕 / 议程 ----
  actReveal,
  agendaReveal,
  checkObjectives,

  // ---- 行动 ----
  actions: collectActions,
  fastActions,
  performAction,

  // ---- 地点读点 ----
  moveError(state, inv, destination) {
    return blockedLocationError(destination)
  },
  movementError(state, inv, destination) {
    return blockedLocationError(destination)
  },
  locationShroudModifier,
  locationRuleOf(location) {
    return locationRuleFor(originalOf(location))
  },

  // ---- 敌人读点 ----
  spawnLocation,
  spawnFailed,
  canFightHidden,
  canEvadeHidden,
  canOpportunityAttack,
  enemyStatModifier,
  enemyAttackModifier,
  enemyAttackStarted,

  // ---- 结局 ----
  resolution: scenarioResolution,
}
