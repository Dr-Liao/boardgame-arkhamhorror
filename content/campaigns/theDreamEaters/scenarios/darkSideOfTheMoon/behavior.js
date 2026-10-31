// 月之暗面（06206）· 章节引擎钩子（逐卡规则在单卡条目的 locationRule/actRule/agendaRule/treacheryRule/enemyScript 里；
// behavior 只做流程分派与章节级顺序，不写卡号分支——需要区分时读条目数据/flow id）。
//
// 覆盖约定：`behavior = { ...encounterRules, id, ...章节钩子 }`；覆盖共享钩子时必须转发 encounterRules.<hook>(...)。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, assetRuleFor, entryFlags, enemyScriptFor, enemySpawnRuleFor,
  enemyStatRuleFor, locationRuleFor, treacheryRuleFor,
} from '../../../../../src/cards/card-rules.js'
import { encounterRules, original, activeInvestigators, here, recordsFor } from '../../encounter-rules.js'
import { dsmChaosAfterTest, dsmChaosToken } from './chaos.js'
import { CAVERNS_BENEATH_THE_MOON_DARK_SIDE, CAVERNS_BENEATH_THE_MOON_LIGHT_SIDE, CITY_OF_THE_MOON_BEASTS, FALSE_AWAKENING, LIGHT_SIDE_OF_THE_MOON, MOON_BEAST_GALLEY, MOON_FOREST, MOON_LIZARD, TEMPLE_OF_THE_MOON_LIZARD, THE_BLACK_CORE, THE_CAPTAIN, THE_WHITE_SHIP, VIRGIL_GRAY, RAW_CODES as RAW } from './definition.js'

const ALARM = 'alarmLevel'
const codeOf = card => original(card)
const COLD_WASTES_RECORD = 'theInvestigatorsWereCarriedToTheColdWastes'
const TRAVELED_RECORD = 'theInvestigatorsTraveledToTheColdWastes'
const RANDOLPH_LOST_RECORD = 'randolphCarterDidNotSurviveTheVoyage'
const RANDOLPH_SURVIVED_RECORD = 'randolphSurvivedTheVoyage'
const EVIDENCE_RECORD = 'evidenceOfKadath'

const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const locationByCode = (state, code) => Object.values(state.scenario?.locations || {})
  .find(location => String(location.originalCode || location.code) === String(code)) || null
const inPlayByCode = (state, code) => (state.locations || []).find(location => String(codeOf(location)) === String(code)) || null

// 警报等级读点：hooks 里有一半只拿 state（不是 api），统一从 state.investigatorCounters 只读。
const alarmSeats = state => state.investigatorCounters?.alarmLevel?.seats || []
const alarmOf = (state, seat) => Number(alarmSeats(state)[Number(seat)]) || 0
const highestAlarm = state => alarmSeats(state).reduce((max, value) => Math.max(max, Number(value) || 0), 0)

function takeFromSetAside(state, code) {
  const list = state.scenarioZones?.setAside || []
  const index = list.indexOf(String(code))
  if (index >= 0) list.splice(index, 1)
  return index >= 0
}

// 被俘的调查员：战役记录 wasCaptured 是「调查员 id 列表」（见 P8-CAMPAIGN-FACTS §记录键）。
function capturedSeats(state) {
  const recorded = state.campaign?.records?.wasCaptured
  const list = Array.isArray(recorded) ? recorded.map(String) : []
  if (!list.length) return []
  return (state.investigators || []).filter(inv => list.includes(String(inv.id))
    || list.includes(String(inv.code)) || list.includes(String(inv.seat))).map(inv => inv.seat)
}

const allAt = (state, locationId) => {
  const active = activeInvestigators(state)
  return active.length > 0 && active.every(inv => inv.location === locationId)
}

// --- BFS 距离（连接图很小） ---
function distancesFrom(state, from) {
  const distance = new Map([[from, 0]])
  const queue = [from]
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]
    const location = locationOf(state, current)
    for (const next of location?.connections || []) {
      if (distance.has(next) || !locationOf(state, next)) continue
      distance.set(next, distance.get(current) + 1)
      queue.push(next)
    }
  }
  return distance
}

// --- 地点进入限制（白船：警报 ≥5 不能进；亮面：对应洞穴有线索时不能进） ---
function entryBlockedByLocationRule(state, location, inv) {
  const rule = locationRuleFor(codeOf(location)) || {}
  if (rule.entryErrorAlarmAtLeast) {
    const spec = rule.entryErrorAlarmAtLeast
    if (alarmOf(state, inv.seat) >= Number(spec.value)) return spec.message
  }
  if (rule.entryErrorBlockedWhileOtherHasClues) {
    const other = inPlayByCode(state, rule.entryErrorBlockedWhileOtherHasClues.locationCode)
    if (other && (Number(other.clues) || 0) > 0) return `「${location.name}」：${other.name} 上还有线索，不能进入。`
  }
  return undefined
}

// --- 猎手移动：拜亚基忽略警报 ≤2 的调查员；月蜥只走[[洞穴]]地点 ---
function hunterMoveForRule(state, enemy, api) {
  const rule = enemyStatRuleFor(codeOf(enemy))
  if (!rule?.huntIgnoresAlarmBelow && !rule?.huntOnlyCaveLocations) return false
  let targets = activeInvestigators(state)
  if (rule.huntIgnoresAlarmBelow) {
    targets = targets.filter(inv => alarmOf(state, inv.seat) >= Number(rule.huntIgnoresAlarmBelow))
    if (!targets.length) {
      api.info?.(`「${enemy.name}」忽略了所有警报等级过低的调查员，不移动。`)
      return true
    }
  }
  const origin = locationOf(state, enemy.location)
  if (!origin) return true
  let candidates = [...(origin.connections || [])].filter(id => locationOf(state, id))
  if (rule.huntOnlyCaveLocations) {
    candidates = candidates.filter(id => {
      const location = locationOf(state, id)
      return (location.traits || ALL_CARDS[codeOf(location)]?.traits || [])
        .some(trait => String(trait).toLowerCase() === 'cave')
    })
  }
  if (!candidates.length) return true
  let best = null
  for (const id of candidates) {
    const distance = distancesFrom(state, id)
    const nearest = Math.min(...targets.map(inv => distance.get(inv.location) ?? Infinity))
    if (!best || nearest < best.distance) best = { id, distance: nearest }
  }
  if (best && best.id !== enemy.location) {
    api.moveEnemy?.(enemy, best.id)
    api.info?.(`「${enemy.name}」沿可通行地点移动到相邻地点。`)
  }
  return true
}

// --- 幕 I 背面「及时救援」 ---
function resolveVirgilRescue(state, act, api) {
  const city = inPlayByCode(state, CITY_OF_THE_MOON_BEASTS)
  const candidates = activeInvestigators(state).filter(inv => !city || inv.location === city.id)
  const lead = candidates[0] || activeInvestigators(state)[0] || null
  const virgilDefinition = Object.values(state.scenario?.storyAssets || {}).find(card => String(codeOf(card)) === VIRGIL_GRAY)
  if (virgilDefinition && lead) {
    takeFromSetAside(state, VIRGIL_GRAY)
    api.giveAsset?.(lead.seat, VIRGIL_GRAY)
    api.info?.(`📜 ${lead.name} 控制了维吉尔·格雷（文思泉涌）。`)
  }
  // 伦道夫被俘：把场外的伦道夫·卡特（梦境专家）放入其所有者手牌。
  if (state.campaign?.records?.randolphWasCaptured) {
    const randolph = Object.values(ALL_CARDS).find(card => /^Randolph Carter/i.test(String(card.name))
      && card.type === 'asset' && card.pack === 'tde')
    if (randolph) {
      const owner = (state.investigators || []).find(inv => (inv.deck || []).includes(randolph.code)) || lead
      if (owner) {
        const deckIndex = (owner.deck || []).indexOf(randolph.code)
        if (deckIndex >= 0) owner.deck.splice(deckIndex, 1)
        owner.hand.push(randolph.code)
        api.info?.(`📜 伦道夫·卡特（梦境专家）被放入 ${owner.name} 的手牌。`)
      }
    }
  }
  return true
}

// --- 议程 III 背面「杀戮时刻」 ---
function resolveTimeToKill(state, agenda, api) {
  for (const inv of state.investigators || []) api.counters.add(inv.seat, ALARM, 1)
  for (const inv of state.investigators || []) {
    const horror = Math.ceil(alarmOf(state, inv.seat) / 2)
    if (horror > 0) api.horror(inv.seat, horror)
  }
  // 重置密谋牌库到密谋 3a：保持 agendaIndex=2，并用新对象让引擎的「当前议程仍是 cur」检查提前返回，
  // 从而不再把 agendaIndex ++（否则会越过最后一张议程直接结算失败）。
  const current = state.agendas?.[state.agendaIndex]
  if (current) {
    state.agendaIndex = 2
    state.agendas[2] = { ...current }
    state.agendaFace = 'front'
  }
  api.addDoom?.(2)
  api.info?.('⏰ 「杀戮时刻」：警报等级 +1、恐惧结算；密谋牌库重置到密谋 3a，并放置 2 个毁灭标记。')
  return true
}

// --- 月兽帆船翻面「下船」（06214b） ---
function resolveOffTheGalley(state, location, api) {
  if (state.scenarioFlags?.moonBeastGalleyFlipped) return true
  state.scenarioFlags ||= {}
  state.scenarioFlags.moonBeastGalleyFlipped = true
  const clues = Number(location.clues) || 0
  api.cardFlip?.(RAW.c06214)
  const moonForest = inPlayByCode(state, MOON_FOREST)
  const city = inPlayByCode(state, CITY_OF_THE_MOON_BEASTS)
  if (clues === 0) {
    for (const inv of [...(state.investigators || [])].filter(item => item.location === location.id)) {
      if (moonForest) api.moveInvestigator?.(inv.seat, moonForest.id)
    }
    for (const enemy of [...(state.enemies || [])].filter(item => item.location === location.id)) api.discardEnemy?.(enemy)
    api.info?.('⛵ 「下船」：没有线索——调查员乘小艇逃往月之森林，本地点的敌人被弃掉。')
  } else {
    for (const inv of [...(state.investigators || [])].filter(item => item.location === location.id)) {
      api.counters.add(inv.seat, ALARM, 1)
      if (city) api.moveInvestigator?.(inv.seat, city.id)
    }
    for (const enemy of [...(state.enemies || [])].filter(item => item.location === location.id)) {
      if (city) api.moveEnemy?.(enemy, city.id)
    }
    api.info?.('⛵ 「下船」：有线索——调查员警报等级 +1，并与敌人一起被带到月兽之城。')
  }
  state.removedFromGame ||= []
  state.removedFromGame.push(MOON_BEAST_GALLEY)
  api.removeLocationFromGame?.(location.id)
  return true
}

// --- 幕目标 ---
function resolveActObjectives(state, api) {
  const act = state.acts?.[state.actIndex]
  if (!act) return
  const objective = actRuleFor(codeOf(act))?.objective
  if (!objective) return
  const loc = inPlayByCode(state, objective.atLocationCode)
  if (!loc) return
  if (objective.kind === 'groupClues') {
    const required = Number(objective.perInvestigator || 0) * (Number(state.numInvestigators) || 1)
    const available = activeInvestigators(state).filter(inv => inv.location === loc.id)
      .reduce((sum, inv) => sum + (Number(inv.clues) || 0), 0)
    if (required > 0 && available >= required) {
      api.payClues?.(required, loc.id)
      api.info?.(`📜 团队在「${loc.name}」共同花费 ${required} 个线索推进幕。`)
      api.advanceAct?.()
    }
    return
  }
  if (objective.kind === 'allAtLocation') {
    if (!allAt(state, loc.id)) return
    if (objective.requireNoClues && (Number(loc.clues) || 0) > 0) return
    api.advanceAct?.()
  }
}

export const scenarioApproximations = Object.freeze([
  '被俘调查员的判定读战役记录 wasCaptured 的调查员 id 列表（campaign.records.wasCaptured），'
    + '按 id/code/座位号匹配；记录 schema 由战役层（w-p8-g）定义。',
  '月蜥的「只能进入[[洞穴]]地点」没有引擎读点：behavior.hunterMove 在洞穴子图上寻路，'
    + '效果移动（api.moveEnemy）不拦截（条目 note 已记 simplified）。',
  '月之拜亚基「忽略警报 ≤2 的调查员」用 behavior.hunterMove 过滤目标 + behavior.canEngageEnemy 拒绝交战实现。',
  '06224 维吉尔·格雷的「警报等级提高后」反应等待 window.afterAlarmRaised 原语（primitive-requests/w-p8-c-alarm-level-window.json）。',
])

export const scenarioGaps = Object.freeze([
  '06214b「下船」的翻面结算由 behavior 的 offTheGalley 流程完成（按翻面瞬间线索数二选一）。',
])

export const implementedEncounterCodes = Object.freeze([
  MOON_LIZARD, RAW.c06227, RAW.c06228, RAW.c06229, RAW.c06230, RAW.c06231, RAW.c06232, RAW.c06233,
])

export const behavior = {
  ...encounterRules,
  id: 'darkSideOfTheMoon',
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,

  // ---- 开局 ----
  preScenarioSetup(state, events, api) {
    state.scenarioFlags ||= {}
    state.scenarioFlags.capturedSeats = capturedSeats(state)
    state.scenarioFlags.agendaAside = [FALSE_AWAKENING]
    state.scenarioFlags.introResolved = true
    api.info?.(state.scenarioFlags.capturedSeats.length
      ? `⛓️ 有 ${state.scenarioFlags.capturedSeats.length} 位调查员被俘：从月兽帆船上开始游戏。`
      : '⛵ 没有调查员被俘：从月之森林开始游戏。')
    if (state.campaign?.records?.randolphWasCaptured) api.info?.('📜 伦道夫被俘：把他的剧情支援放在一边。')
  },

  setupLocations(state, events, helper = {}) {
    const zones = (state.scenarioZones ||= {})
    const flags = (state.scenarioFlags ||= {})
    flags.agendaAside = [FALSE_AWAKENING]
    const placed = ['cityOfTheMoonBeasts', 'templeOfTheMoonLizard', 'moonForest', 'theDarkCrater']
    zones.setAside = [
      MOON_LIZARD, VIRGIL_GRAY, THE_CAPTAIN, FALSE_AWAKENING,
      MOON_BEAST_GALLEY, CAVERNS_BENEATH_THE_MOON_DARK_SIDE, THE_BLACK_CORE,
      CAVERNS_BENEATH_THE_MOON_LIGHT_SIDE, LIGHT_SIDE_OF_THE_MOON, THE_WHITE_SHIP,
    ]
    flags.pendingSetupReveals = ['cityOfTheMoonBeasts', 'templeOfTheMoonLizard', 'moonForest', 'theDarkCrater']
    helper.info?.('🌑 月之暗面：月兽之城、月蜥神庙、月之森林、漆黑深坑入场；其余地点放在一边。')
    return placed
  },

  afterDeckSetup(state, events, helper = {}) {
    // 初始区域：被俘 → 月兽帆船（此钩子内放置），否则月之森林；并放置初始警报等级 1。
    const flags = (state.scenarioFlags ||= {})
    const captured = flags.capturedSeats || []
    if (captured.length) {
      const galleyDefinition = locationByCode(state, MOON_BEAST_GALLEY)
      if (galleyDefinition) {
        takeFromSetAside(state, MOON_BEAST_GALLEY)
        state.locations.push({
          ...structuredClone(galleyDefinition),
          id: galleyDefinition.id,
          revealed: true,
          clues: 2 * captured.length,
        })
        for (const seat of captured) {
          const inv = state.investigators[seat]
          if (inv) inv.location = galleyDefinition.id
        }
        helper.info?.(`⛵ 月兽帆船入场；每位被俘调查员使其上多 2 个线索（共 ${2 * captured.length} 个）。`)
      }
    }
    const moonForest = locationByCode(state, MOON_FOREST)
    for (const inv of state.investigators || []) {
      if (captured.includes(inv.seat)) continue
      if (moonForest) inv.location = moonForest.id
    }
    // 警报等级：每人 1；上限 5（0–5+，按 >= 判定）。
    state.investigatorCounters ||= {}
    const seats = state.investigatorCounters[ALARM]?.seats || []
    for (const inv of state.investigators || []) seats[inv.seat] = 1
    state.investigatorCounters[ALARM] = { seats, max: 5 }
    helper.info?.('🔔 每位调查员的初始警报等级为 1。')
  },

  startLocation(state) {
    // 被俘调查员在月兽帆船、其余在月之森林；这里只给一个统一落点，afterDeckSetup 再按记录移动被俘者。
    const captured = capturedSeats(state)
    const definition = captured.length ? locationByCode(state, MOON_BEAST_GALLEY) : locationByCode(state, MOON_FOREST)
    return definition?.id || 'moonForest'
  },

  // ---- 幕 / 议程 ----
  actReveal(state, act, api) {
    const rule = actRuleFor(codeOf(act)) || {}
    if (rule.chapterFlow === 'virgilRescue') return resolveVirgilRescue(state, act, api)
    if (rule.onReveal) return rule.onReveal(state, act, api)
    return undefined
  },

  agendaReveal(state, agenda, api) {
    const flow = entryFlags(codeOf(agenda))?.flow
    if (flow === 'timeToKill') return resolveTimeToKill(state, agenda, api)
    const rule = agendaRuleFor(codeOf(agenda), state.scenario?.id) || {}
    if (rule.onReveal) return rule.onReveal(state, agenda, api)
    return undefined
  },

  agendaForced(state, when, api, forcedType) {
    const agenda = state.agendas?.[state.agendaIndex]
    if (!agenda) return undefined
    return agendaRuleFor(codeOf(agenda), state.scenario?.id)?.forced?.[when]?.(state, agenda, api, forcedType)
  },

  checkObjectives(state, api) {
    resolveActObjectives(state, api)
  },

  // ---- 回合 / 轮末 ----
  turnBegins(state, inv, api) {
    encounterRules.turnBegins?.(state, inv, api)
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    const location = here(state, inv)
    locationRuleFor(codeOf(location))?.forced?.turnEnd?.(state, inv, location, api)
    // 月下洞穴的「调查失败 -2 帷幕直到你回合结束」：回合结束时还原。
    for (const candidate of state.locations || []) {
      const rule = locationRuleFor(codeOf(candidate)) || {}
      if (rule.shroudPenaltyOnFailedInvestigation && candidate.shroudPenaltyActive) {
        api.setShroudMod?.(candidate, Number(rule.shroudPenaltyOnFailedInvestigation))
        delete candidate.shroudPenaltyActive
        api.info?.(`🕳️ 「${candidate.name}」的临时帷幕修正结束。`)
      }
    }
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    for (const location of [...(state.locations || [])]) {
      const rule = locationRuleFor(codeOf(location)) || {}
      rule.forced?.roundEnd?.(state, location, api)
      if (rule.flipFlow?.roundEndDoomAtLeast && (Number(state.doom) || 0) >= Number(rule.flipFlow.roundEndDoomAtLeast)) {
        resolveOffTheGalley(state, location, api)
      }
    }
  },

  // ---- 玩家行动 ----
  actions(state, inv) {
    const moves = encounterRules.actions?.(state, inv) || []
    const location = here(state, inv)
    if (location) {
      locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
      // 地点附属上的行动（06232 月球巡逻）。
      for (const attachment of location.attachments || []) {
        const rule = treacheryRuleFor(codeOf(attachment))
        const action = rule?.locationAction
        if (!action) continue
        moves.push({
          action: 'scenarioAction', rule: action.rule, actions: action.actions ?? 1,
          label: action.label, attachmentId: attachment.id,
        })
      }
    }
    // 船长（06225）：每位未败退调查员都在白船时，任意白船调查员可发动谈判。
    const captainRule = assetRuleFor(THE_CAPTAIN)?.captainParley
    const whiteShip = inPlayByCode(state, THE_WHITE_SHIP)
    const captainInPlay = (state.storyAssets || []).some(asset => String(codeOf(asset)) === THE_CAPTAIN)
    if (captainRule && whiteShip && captainInPlay && inv.location === whiteShip.id && allAt(state, whiteShip.id)) {
      moves.push({
        action: 'scenarioAction', rule: captainRule.rule, actions: 1,
        label: captainRule.label.replace('X', String(highestAlarm(state))),
      })
    }
    // 卡达斯（06233）：在密谋牌库旁时，任意调查员可发动。
    const aside = state.scenarioFlags?.agendaAside || []
    if (aside.includes(FALSE_AWAKENING)) {
      const rule = treacheryRuleFor(FALSE_AWAKENING)?.agendaAsideAction
      if (rule) moves.push({ action: 'scenarioAction', rule: rule.rule, actions: 1, label: rule.label })
    }
    return moves
  },

  fastActions(state, inv) {
    const moves = []
    const location = here(state, inv)
    if (location) locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
    return moves.filter(move => move.actions === 0 && move.fast === true)
  },

  performAction(state, inv, move, api) {
    if (move.flow === 'offTheGalley') {
      const galley = inPlayByCode(state, MOON_BEAST_GALLEY)
      if (galley) resolveOffTheGalley(state, galley, api)
      return undefined
    }
    if (encounterRules.performAction?.(state, inv, move, api)) return undefined
    const location = here(state, inv)
    const locationRule = location ? locationRuleFor(codeOf(location)) : null
    if (locationRule?.performAction?.(state, inv, move, api)) return undefined
    // 06232 月球巡逻：[action] 检定敏捷（3），成功弃掉。
    if (move.attachmentId && location) {
      const attachment = (location.attachments || []).find(item => String(item.id) === String(move.attachmentId))
      const rule = treacheryRuleFor(codeOf(attachment))?.locationAction
      if (rule) {
        api.test?.(inv.seat, rule.skills?.[0] || 'agility', Number(rule.difficulty) || 3, result => {
          if (!result.success) return
          api.detachLocationAttachment?.(location.id, attachment.id)
          state.encounterDiscard.push(String(codeOf(attachment)))
          api.info?.(`🌙 ${inv.name} 摆脱了「月球巡逻」。`)
        })
        return undefined
      }
    }
    // 船长谈判：检定意志/智力（X = 最高警报等级），成功推进幕 IV。
    const captainRule = assetRuleFor(THE_CAPTAIN)?.captainParley
    if (captainRule && move.rule === captainRule.rule) {
      const difficulty = highestAlarm(state)
      const skill = api.choice?.({
        kind: 'skill', source: THE_CAPTAIN, seat: inv.seat,
        prompt: '说服船长启航：选择检定技能。',
        options: captainRule.skills.map(item => ({ id: item, label: item })),
      }) === 'intellect' ? 'intellect' : 'willpower'
      api.test?.(inv.seat, skill, difficulty, result => {
        if (!result.success) return
        api.info?.(`⛵ ${inv.name} 说服船长启航，推进场景。`)
        api.advanceAct?.()
      })
      return undefined
    }
    // 卡达斯：任意技能（2 + 1[per_investigator]），成功从游戏中移除。
    const awakeningRule = treacheryRuleFor(FALSE_AWAKENING)?.agendaAsideAction
    if (awakeningRule && move.rule === awakeningRule.rule) {
      const difficulty = Number(awakeningRule.baseDifficulty || 2)
        + Number(awakeningRule.perInvestigatorBonus || 0) * (Number(state.numInvestigators) || 1)
      const skills = ['willpower', 'intellect', 'combat', 'agility']
      const skill = api.choice?.({
        kind: 'skill', source: FALSE_AWAKENING, seat: inv.seat,
        prompt: `卡达斯：选择任意技能检定（难度 ${difficulty}）。`,
        options: skills.map(item => ({ id: item, label: item })),
      }) || 'willpower'
      api.test?.(inv.seat, skill, difficulty, result => {
        if (!result.success) return
        const aside = state.scenarioFlags?.agendaAside || []
        const index = aside.indexOf(FALSE_AWAKENING)
        if (index >= 0) aside.splice(index, 1)
        state.removedFromGame ||= []
        state.removedFromGame.push(FALSE_AWAKENING)
        api.info?.('⏰ 卡达斯被移出游戏。')
      })
      return undefined
    }
    throw new Error(`未知月之暗面行动：${move.rule}`)
  },

  // ---- 地点 ----
  investigatorEntryError(state, location, inv) {
    if (!location || !inv) return undefined
    return entryBlockedByLocationRule(state, location, inv)
  },

  locationShroudModifier(state, location, inv) {
    if (!location) return 0
    const rule = locationRuleFor(codeOf(location)) || {}
    if (rule.depthCounterKey) return Number(location[rule.depthCounterKey]) || 0
    return Number(rule.shroudModifier?.(state, location, inv) || 0)
  },

  movementError(state, inv, destination) {
    const dest = typeof destination === 'string' ? locationOf(state, destination) : destination
    const origin = here(state, inv)
    const originRule = origin ? locationRuleFor(codeOf(origin)) || {} : {}
    const destRule = dest ? locationRuleFor(codeOf(dest)) || {} : {}
    if (originRule.blockEffectLeave || destRule.blockEffectEntry) {
      return '「月兽帆船」：调查员不能通过玩家卡的效果进入或离开。'
    }
    return undefined
  },

  locationLeft(state, inv, prevLocation, api) {
    if (!prevLocation) return
    for (const attachment of prevLocation.attachments || []) {
      const leaves = treacheryRuleFor(codeOf(attachment))?.forcedWhenLeaves
      if (!leaves) continue
      api.counters.add(inv.seat, ALARM, Number(leaves.alarm) || 1)
      api.info?.(`🌙 「月球巡逻」：${inv.name} 离开附属地点，警报等级 +1。`)
    }
  },

  cluesGained(state, inv, amount, api) {
    if (!(amount > 0)) return
    const location = here(state, inv)
    locationRuleFor(codeOf(location))?.onCluesDiscovered?.(state, inv, amount, api)
  },

  // ---- 敌人 ----
  spawnLocation(state, code, fallbackLoc) {
    const rule = enemySpawnRuleFor(code)
    if (!rule?.spawnNearestTrait) return fallbackLoc
    const trait = String(rule.spawnNearestTrait).toLowerCase()
    const traitLocations = (state.locations || []).filter(location =>
      (location.traits || ALL_CARDS[codeOf(location)]?.traits || [])
        .some(item => String(item).toLowerCase() === trait))
    if (!traitLocations.length) return fallbackLoc
    const active = activeInvestigators(state)
    if (!active.length) return traitLocations[0].id
    let best = null
    for (const location of traitLocations) {
      const distance = distancesFrom(state, location.id)
      const nearest = Math.min(...active.map(inv => distance.get(inv.location) ?? Infinity))
      if (!best || nearest < best.distance) best = { id: location.id, distance: nearest }
    }
    return best?.id || fallbackLoc
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
  },

  enemyStatModifier(state, enemy, stat) {
    let value = Number(encounterRules.enemyStatModifier?.(state, enemy, stat) || 0)
    const rule = enemyStatRuleFor(codeOf(enemy))
    if ((stat === 'fight' || stat === 'evade') && rule?.fightEvadeFromAlarm) {
      const whenUnengaged = Number(rule.fightEvadeFromAlarm.whenUnengaged) || 5
      const alarm = enemy.engagedSeat == null ? whenUnengaged : alarmOf(state, enemy.engagedSeat)
      value += alarm - (Number(enemy[stat]) || 0)
    }
    return value
  },

  hunterMove(state, enemy, api) {
    return hunterMoveForRule(state, enemy, api)
  },

  canEngageEnemy(state, inv, enemy) {
    const rule = enemyStatRuleFor(codeOf(enemy))
    if (rule?.huntIgnoresAlarmBelow) {
      if (alarmOf(state, inv.seat) < Number(rule.huntIgnoresAlarmBelow)) return false
    }
    return true
  },

  afterEvade(state, inv, enemy, result, api) {
    enemyScriptFor(codeOf(enemy))?.onEvaded?.(state, enemy, api, inv, result)
  },

  // ---- 遭遇 / 混乱标记 ----
  resolveEncounter(state, inv, treachery, api) {
    return encounterRules.resolveEncounter?.(state, inv, treachery, api) ?? false
  },

  resolveChaosToken(state, inv, token, api) {
    return dsmChaosToken(state, inv, token, api)
  },

  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    dsmChaosAfterTest(state, inv, result, api)
    // 月下洞穴：调查失败 → 直到你回合结束 -2 帷幕（记录在 location.shroudPenaltyActive，回合结束还原）。
    if (result && !result.success && result.source?.label === '调查' && inv?.location) {
      const location = locationOf(state, inv.location)
      const rule = location ? locationRuleFor(codeOf(location)) || {} : {}
      if (rule.shroudPenaltyOnFailedInvestigation) {
        api.setShroudMod?.(location, -Number(rule.shroudPenaltyOnFailedInvestigation))
        location.shroudPenaltyActive = true
        api.info?.(`🕳️ 调查「${location.name}」失败：其帷幕 -${rule.shroudPenaltyOnFailedInvestigation}，直到你回合结束。`)
      }
    }
  },

  // ---- 结局 ----
  resolution(state, key, events, api) {
    const records = recordsFor(state)
    if (key === 'noResolution') {
      records[COLD_WASTES_RECORD] = true
      records[RANDOLPH_LOST_RECORD] = true
      return {
        award: true,
        effects: [
          { record: { [COLD_WASTES_RECORD]: true, [RANDOLPH_LOST_RECORD]: true } },
          { campaignWeakness: { code: FALSE_AWAKENING, reason: '月之暗面：无结局（被带往寒冷荒原）' } },
        ],
      }
    }
    if (key === 'resolution1') {
      records[TRAVELED_RECORD] = true
      records[RANDOLPH_SURVIVED_RECORD] = true
      records[EVIDENCE_RECORD] = (Number(records[EVIDENCE_RECORD]) || 0) + 3
      return {
        award: true,
        effects: [
          { record: { [TRAVELED_RECORD]: true, [RANDOLPH_SURVIVED_RECORD]: true } },
          { recordCount: { key: EVIDENCE_RECORD, delta: 3 } },
        ],
      }
    }
    throw new Error(`未知月之暗面结局：${key}`)
  },
}
