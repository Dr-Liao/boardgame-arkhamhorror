// 疯狂之心 第 I 部分 · 引擎钩子（章节流程 + 大封印机械）。
// 约定：逐卡规则在各单卡条目（locationRule/actRule/agendaRule/enemyScript/flags）；
// behavior 只做分派与本章专属机械（随机布置、休眠封印、大封印目标、爆炸即败、结局记录）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { actRuleFor, agendaRuleFor, entryFlags, enemyScriptFor, locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { initializeSeals, placeDormantSeal, recoverSeal, sealsOf, sealsAt } from '../../../../../src/campaign/eote-seals.js'
import { HEART_OF_MADNESS_TOKEN_MEANINGS, heartOfMadnessChaosAfterTest, heartOfMadnessChaosToken, isMistPylon, locationSeals } from './chaos.js'
import { RAW_CODES, SEAL_LOCATION_CODES } from './definition.js'

export const scenarioApproximations = Object.freeze([
  '原质团「敌人阶段结束时再次重整并结算敌人阶段」按重整+提示近似。',
  '石板标记抽忒咳哩-哩牌直接取牌库顶放入弃牌堆（P5 弱点管线近似）。',
  'cultist 视为寒霜只声明 asFrost 字段。',
])
export const scenarioGaps = Object.freeze([])

const CHAPTER_ID = 'theHeartOfMadnessPart1'
const codeOf = card => card?.originalCode || card?.code || card
const locationOf = (state, id) => (state.locations || []).find(location => location.id === id) || null
const activeInvestigators = state => (state.investigators || []).filter(inv => inv && !inv.defeated && !inv.resigned)
const leadSeat = state => Number(state.campaign?.leadSeat ?? 0)
const recordsFor = state => { state.campaign ||= {}; state.campaign.records ||= {}; return state.campaign.records }
const flagsOf = state => (state.scenarioFlags ||= {})

function shuffled(state, list) {
  const out = [...list]
  for (let index = out.length - 1; index > 0; index -= 1) {
    const target = Math.floor(randomValue(state) * (index + 1))
    ;[out[index], out[target]] = [out[target], out[index]]
  }
  return out
}

function randomizeFacilityFaces(state) {
  const scenario = state.scenario
  const slots = scenario.facilitySlots || []
  const pool = shuffled(state, slots.map(slot => ({ ...scenario.locations[slot] })))
  slots.forEach((slot, index) => {
    const definition = scenario.locations[slot]
    const face = pool[index]
    Object.assign(definition, {
      code: face.originalCode, originalCode: face.originalCode,
      name: face.name, nameEn: face.nameEn, text: face.text, textEn: face.textEn,
      backText: face.backText, backTextEn: face.backTextEn,
      backName: face.backName, backNameEn: face.backNameEn,
      unrevealedName: face.unrevealedName, unrevealedNameEn: face.unrevealedNameEn,
      shroud: face.shroud, cluesPerInvestigator: face.cluesPerInvestigator,
      victory: face.victory, traits: [...(face.traits || [])], slot: definition.slot,
    })
    if (face.cluesFixed == null) delete definition.cluesFixed
    else definition.cluesFixed = face.cluesFixed
  })
}

function sealKindAtLocation(state, locationId) {
  const code = codeOf(locationOf(state, locationId))
  return Object.keys(SEAL_LOCATION_CODES).find(kind => SEAL_LOCATION_CODES[kind] === code) || null
}
function sealsHeld(state, seat) {
  return sealsOf(state).filter(entry => entry.locationId == null && entry.placedBySeat === seat)
}
function activatedSealsAtLocation(state, locationId) {
  return sealsAt(state, locationId).filter(entry => entry.active)
}
function gateSeals(state) {
  return activatedSealsAtLocation(state, state.scenario.startLocation)
}

function checkDetonation(state, api) {
  if (state.status !== 'playing') return false
  const counts = new Map()
  for (const inv of activeInvestigators(state)) {
    const active = sealsHeld(state, inv.seat).filter(entry => entry.active).length
    if (active) counts.set(inv.location, (counts.get(inv.location) || 0) + active)
  }
  if (![...counts.values()].some(count => count >= 2)) return false
  api.info?.('💥 同一地点两名调查员控制 2 枚激活封印：静电爆炸毁灭一切（→R3）。')
  api.finish?.('resolution3', state)
  return true
}

export const behavior = {
  id: CHAPTER_ID,
  name: '疯狂之心 第 I 部分',

  preScenarioSetup(state, events, api) {
    const flags = flagsOf(state)
    if (!flags.sealsInitialized) {
      try { initializeSeals(state) } catch (error) { if (!/已初始化/.test(String(error))) throw error }
      flags.sealsInitialized = true
    }
    api.info?.('🫀 疯狂之心 I：十五座古代设施按三环五辐随机布置；五枚封印放在一边。')
    if (state.difficulty === 'hard') api.addDoom?.(1)
    if (state.difficulty === 'expert') api.addDoom?.(2)
  },

  setupLocations(state, events, helper = {}) {
    randomizeFacilityFaces(state)
    flagsOf(state).locationsRandomized = true
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = state.scenarioZones.setAside || []
    state.encounterDeck = state.encounterDeck?.length ? state.encounterDeck : [...(state.scenario.encounterDeck || [])]
    helper.info?.(state, events, '🫀 古代设施已随机布置；伊夸之门已揭示，调查员从门开始。')
    return ['theGateOfYquaa', ...(state.scenario.facilitySlots || [])]
  },

  afterDeckSetup(state, events, helper = {}) {
    helper.info?.(state, events, `🫀 遭遇牌库 ${state.encounterDeck?.length || 0} 张。`)
  },

  locationRevealed(state, location, api) {
    const kind = sealKindAtLocation(state, location?.id)
    if (!kind) return
    if (placeDormantSeal(state, kind, location.id)) api.info?.(`🫀 「${location.name}」揭示：休眠封印 ${kind} 放到此地。`)
  },

  actions(state, inv) {
    const location = locationOf(state, inv?.location)
    if (!location) return []
    const moves = []
    locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
    return moves
  },

  fastActions(state, inv) {
    const location = locationOf(state, inv?.location)
    if (!location) return []
    const moves = []
    locationRuleFor(codeOf(location))?.fastActions?.({ moves, state, inv, location })
    return moves
  },

  performAction(state, inv, move, api) {
    if (!move) return false
    const location = locationOf(state, inv?.location)
    if (!location) return false
    if (typeof move.rule === 'string' && move.rule.startsWith('heartOfMadnessSeal:')) {
      const kind = move.rule.slice('heartOfMadnessSeal:'.length)
      const flags = entryFlags(codeOf(location)) || {}
      const perInvestigator = Number(state.numInvestigators) || (state.investigators || []).length || 1
      const atLocation = activeInvestigators(state).filter(other => other.location === location.id)
      const resourcesNeeded = (flags.recoverResourcesPerInvestigator || 0) * perInvestigator
      if (resourcesNeeded > 0 && atLocation.reduce((sum, other) => sum + (Number(other.resources) || 0), 0) < resourcesNeeded) {
        api.info?.(`🫀 封印 ${kind}：团队资源不足（需要 ${resourcesNeeded}）。`)
        return true
      }
      const recover = () => {
        if (api.payGroupClues?.(perInvestigator, { atLocation: location.id }) === false) {
          api.info?.(`🫀 封印 ${kind}：团队线索不足（需要 ${perInvestigator}）。`)
          return
        }
        if (resourcesNeeded > 0) {
          let remaining = resourcesNeeded
          for (const other of atLocation) {
            const taken = Math.min(remaining, Number(other.resources) || 0)
            other.resources = (Number(other.resources) || 0) - taken
            remaining -= taken
          }
        }
        if (recoverSeal(state, kind, { seat: inv.seat })) api.info?.(`🫀 ${inv.name || '调查员'} 取得封印 ${kind} 的控制权（休眠）。`)
      }
      if (flags.recoverSkill) api.test?.(inv.seat, flags.recoverSkill, flags.recoverDifficulty || 2, recover)
      else recover()
      return true
    }
    const handled = locationRuleFor(codeOf(location))?.performAction?.(state, inv, move, api)
    if (handled) return true
    return checkDetonation(state, api)
  },

  resolveEncounter(state, inv, treachery, api) {
    const flags = entryFlags(codeOf(treachery)) || {}
    if (flags.revelation === 'electrostaticDischarge') {
      const here = locationOf(state, inv?.location)
      const seal = here ? locationSeals(state, here.id).find(entry => entry.active) : null
      api.horror?.(inv.seat, 1)
      if (seal) api.damage?.(inv.seat, 1)
      api.info?.(`⚡ 静电放电：与封印同地点的调查员受 ${seal ? '1 伤害与 1' : '1'} 恐惧。`)
      return true
    }
    return false
  },

  checkObjectives(state, api) {
    if (state.status !== 'playing') return
    if (checkDetonation(state, api)) return
    const act = state.acts?.[state.actIndex]
    if (!act) return
    const objective = actRuleFor(codeOf(act))?.objective
    if (!objective) return
    const placed = gateSeals(state).length
    if (objective.type === 'activatedSealOnGate' && placed >= 1) {
      api.info?.('🫀 幕 1 目标达成：有激活封印放在伊夸之门上，推进幕。')
      api.advanceAct?.()
      return
    }
    if (objective.type === 'allSealsOnGate' && placed >= 5) {
      api.info?.('🫀 五枚激活封印全部放上伊夸之门：大封印完成（→R1）。')
      api.finish?.('resolution1', state)
    }
  },

  agendaForced(state, when, api, forcedType) {
    const agenda = state.agendas?.[state.agendaIndex]
    if (!agenda) return undefined
    return agendaRuleFor(codeOf(agenda), CHAPTER_ID)?.forced?.[when]?.(state, agenda, api, forcedType)
  },

  actReveal(state, act, api) {
    actRuleFor(codeOf(act))?.onReveal?.(state, act, api)
    return true
  },

  agendaReveal(state, agenda, api) {
    agendaRuleFor(codeOf(agenda), CHAPTER_ID)?.onReveal?.(state, agenda, api)
    return true
  },

  agendaLeftPlay(state, agenda, api) {
    agendaRuleFor(codeOf(agenda), CHAPTER_ID)?.onLeave?.(state, agenda, api)
    checkDetonation(state, api)
  },

  actLeftPlay(state, act, api) {
    actRuleFor(codeOf(act))?.onLeave?.(state, act, api)
  },

  afterTest(state, inv, result, api) {
    for (const effect of heartOfMadnessChaosAfterTest(state, inv, result)) {
      if (effect.type === 'drawTekeli') {
        const deck = state.scenarioDecks?.tekeli?.deck
        if (Array.isArray(deck) && deck.length) {
          const code = deck.pop()
          inv.discard.push(code)
          api.info?.(`🟣 石板标记：抽取忒咳哩-哩牌库顶（「${ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code}」进入弃牌堆）。`)
        } else api.info?.('🟣 石板标记：忒咳哩-哩牌库为空。')
      } else if (effect.type === 'addDoom') {
        api.addDoom?.(effect.amount)
        api.info?.('🌑 旧日支配者标记：失败 3 点或更多，在当先议程放置 1 毁灭。')
      }
    }
    checkDetonation(state, api)
  },

  resolveChaosToken(state, inv, token) {
    return heartOfMadnessChaosToken(state, inv, token)
  },

  applyTokenEffect(state, context) {
    if (context?.token !== 'frost') return undefined
    const seat = context?.seat
    const location = locationOf(state, seat != null ? state.investigators?.[seat]?.location : context?.location)
    if (!location || codeOf(location) !== '08655') return undefined
    const flags = flagsOf(state)
    const key = `${state.round}:${location.id}`
    if (flags.frostTreatRound === key) return undefined
    flags.frostTreatRound = key
    return { modifier: -3, once: true }
  },

  enemyPhaseEnd(state, api) {
    const mass = (state.enemies || []).find(enemy => codeOf(enemy) === RAW_CODES.protoplasmicMass)
    if (!mass || mass.readiedAgainRound === state.round) return
    const anyActivated = activeInvestigators(state).some(inv => sealsHeld(state, inv.seat).some(entry => entry.active))
    if (!anyActivated) return
    mass.readiedAgainRound = state.round
    mass.exhausted = false
    api.info?.('🫀 原质团在敌人阶段结束时重整（近似：不重复整段敌人阶段）。')
  },

  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    const gate = state.scenario?.startLocation
    const placed = activatedSealsAtLocation(state, gate).map(entry => entry.kind)
    const recovered = sealsOf(state).filter(entry => entry.placedBySeat != null).map(entry => entry.kind)
    if (placed.length) records.sealsPlaced = placed
    if (recovered.length) records.sealsRecovered = recovered
    const activeCount = sealsOf(state).filter(entry => entry.active).length
    if (key === 'resolution3' || key === 'r3') {
      records.theSealWasUsedImproperly = true
      for (const inv of state.investigators || []) {
        if (!inv.defeated && !inv.resigned) { inv.defeated = true; inv.defeatCause = 'killed' }
      }
      api.info?.('💀 静电爆炸：调查员全部被击败（R3）。')
      return { award: true, bonus: 0 }
    }
    if (key === 'noResolution') {
      records.theSealWasUsedImproperly = true
      api.info?.('🫀 无结局：转为 R2 结算。')
      return { award: true, bonus: activeCount }
    }
    if (['resolution1', 'r1', 'resolution2', 'r2'].includes(key)) {
      api.info?.(`🫀 大封印结算：激活封印 ${activeCount} 枚 → +${activeCount} 经验。`)
      return { award: true, bonus: activeCount }
    }
    return { award: true, bonus: 0 }
  },
}

export const implementedEncounterCodes = Object.freeze([
  '08659', '08660', '08661', '08662', '08663', '08664', '08665', '08666', '08667', '08668',
  '08669', '08670',
])

export const HEART_OF_MADNESS_RULES = Object.freeze({
  tokenMeanings: HEART_OF_MADNESS_TOKEN_MEANINGS,
  sealLocationCodes: SEAL_LOCATION_CODES,
})

void isMistPylon
void enemyScriptFor
void leadSeat