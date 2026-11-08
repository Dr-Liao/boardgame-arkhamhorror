// 疯狂之心 第 II 部分 · 引擎钩子（坍塌迷雾高塔 + 无名的疯狂 + 逃生结局）。
// 约定：逐卡规则在各单卡条目；behavior 负责随机布置、高塔可被攻击/坍塌、坡道场景与结局分流。
import { actRuleFor, agendaRuleFor, entryFlags, enemyScriptFor, locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { randomValue } from '../../../../../src/engine/rules-state.js'
import { initializeSeals, sealsOf, placeSeal } from '../../../../../src/campaign/eote-seals.js'
import { isPartnerAlive } from '../../../../../src/campaign/eote-partners.js'
import { collapsedTowers, damageTower, initializeFacilities, towerHealth, towerState } from '../../../../../src/engine/eote-facilities.js'
import { heartOfMadnessChaosAfterTest, heartOfMadnessChaosToken } from './chaos.js'
import { INNER_RING_SLOTS, PYLON_SLOT_CODES, RAW_CODES, RAMP_CODES } from './definition.js'

export const scenarioApproximations = Object.freeze([
  '15 份「无名的疯狂」在场计数按 enemy 实例数近似。',
  '「毁灭将被放置时改为生成无名的疯狂」按放置毁灭后提示近似（doomPlacementReplacement 留待 P8）。',
  '高塔攻击用 scenarioAction + 战斗检定 + damageTower 原语，不伪造敌人实体。',
])
export const scenarioGaps = Object.freeze([])

const CHAPTER_ID = 'theHeartOfMadnessPart2'
// 参考实现 PreScenarioSetup：肯斯勒博士仍存活且已明了瘴气的真相 → 记录「肯斯勒博士已有计划」；
// 否则记录「幻景的真相仍未明了」。两条记录决定结局 R1/R2（最终幻景 08681 背面）。
const KENSLER_PARTNER_CODE = '08720'
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
const isPylonCode = code => PYLON_SLOT_CODES.includes(String(code))
function slotIsPylon(state, slotId) { return isPylonCode(codeOf(locationOf(state, slotId))) }
function pylonSlots(state, { includeCollapsed = true } = {}) {
  return (state.scenario.facilitySlots || []).filter(slot => {
    if (!slotIsPylon(state, slot)) return false
    if (includeCollapsed) return true
    return towerState(state, slot)?.collapsed !== true
  })
}

function randomizeFacilityFaces(state) {
  const scenario = state.scenario
  const slots = scenario.facilitySlots || []
  const pool = slots.map(slot => ({ ...scenario.locations[slot] }))
  let arrangement = null
  for (let attempt = 0; attempt < 50 && !arrangement; attempt += 1) {
    const order = shuffled(state, pool)
    const bySlot = Object.fromEntries(slots.map((slot, index) => [slot, order[index]]))
    if (!INNER_RING_SLOTS.every(slot => isPylonCode(bySlot[slot]?.originalCode))) arrangement = bySlot
  }
  arrangement ||= Object.fromEntries(slots.map((slot, index) => [slot, pool[index]]))
  for (const slot of slots) {
    const definition = scenario.locations[slot]
    const face = arrangement[slot]
    Object.assign(definition, {
      code: face.originalCode, originalCode: face.originalCode,
      name: face.name, nameEn: face.nameEn, text: face.text, textEn: face.textEn,
      backText: face.backText, backTextEn: face.backTextEn,
      backName: face.backName, backNameEn: face.backNameEn,
      unrevealedName: face.unrevealedName, unrevealedNameEn: face.unrevealedNameEn,
      shroud: face.shroud, cluesPerInvestigator: face.cluesPerInvestigator,
      victory: face.victory, traits: [...(face.traits || [])],
      slot: definition.slot, mistPylon: isPylonCode(face.originalCode),
    })
    if (face.cluesFixed == null) delete definition.cluesFixed
    else definition.cluesFixed = face.cluesFixed
  }
}

function initializeChapterFacilities(state) {
  if (flagsOf(state).facilitiesInitialized) return
  const facilities = []
  const towers = []
  let towerIndex = 0
  for (const slot of state.scenario.facilitySlots || []) {
    if (slotIsPylon(state, slot)) {
      towerIndex += 1
      towers.push({ id: slot, towerIndex, mistPylon: true })
    } else facilities.push({ id: slot, kind: 'ancientFacility' })
  }
  initializeFacilities(state, { facilities, towers })
  flagsOf(state).facilitiesInitialized = true
}

// 参考实现 `PreScenarioSetup`（TheHeartOfMadnessPart2.hs:DoStep 2/3）：开场按战役状态把
// 「肯斯勒博士已有计划」或「幻景的真相仍未明了」写进战役日志；两条记录是最终幻景结局
// R1/R2 的唯一门槛（见 checkObjectives）。写出的是 campaign.recordSchema 里的布尔键，
// 引擎在结局处经 recordsBefore/recordsAfter 快照落账。
function recordCampaignLogBranch(state, api) {
  const records = recordsFor(state)
  const understands = records.drKenslerUnderstandsTheTrueNatureOfTheMiasma === true
  const kenslerAlive = isPartnerAlive(state, KENSLER_PARTNER_CODE)
  const hasPlan = kenslerAlive && understands
  records.drKenslerHasAPlan = hasPlan
  records.theTruthOfTheMirageEludesYou = !hasPlan
  if (hasPlan) {
    api.info?.('🧠 肯斯勒博士还活着，而且已经明了瘴气的真相：她有一个计划（战役日志：肯斯勒博士已有计划）。')
  } else {
    api.info?.('🌀 没有肯斯勒博士的计划作依靠：幻景的真相仍未明了（战役日志：幻景的真相仍未明了）。')
  }
  return hasPlan
}

function prepareSeals(state, api) {
  if (flagsOf(state).sealsPrepared) return
  if (!sealsOf(state).length) initializeSeals(state)
  const dormant = sealsOf(state).filter(entry => !entry.active && entry.placedBySeat == null && entry.locationId == null)
  const investigators = activeInvestigators(state)
  const entries = state.campaign?.eote?.seals?.entries || []
  dormant.forEach((entry, index) => {
    const seat = investigators[index % Math.max(1, investigators.length)]?.seat ?? 0
    const data = entries.find(item => item.kind === entry.kind)
    if (data) data.placedBySeat = seat
  })
  flagsOf(state).sealsPrepared = true
  api.info?.('🫀 疯狂之心 II：休眠封印由各调查员控制（战役状态近似）。')
}

function nearestPylonTo(state, inv) {
  const candidates = pylonSlots(state)
  if (!candidates.length) return null
  const here = locationOf(state, inv?.location)
  const distanceOf = slot => {
    const target = locationOf(state, slot)
    if (!here || !target) return 99
    const queue = [[here.id, 0]]
    const seen = new Set([here.id])
    while (queue.length) {
      const [id, depth] = queue.shift()
      if (id === target.id) return depth
      for (const connection of locationOf(state, id)?.connections || []) {
        if (seen.has(connection)) continue
        seen.add(connection)
        queue.push([connection, depth + 1])
      }
    }
    return 99
  }
  return candidates.sort((a, b) => distanceOf(a) - distanceOf(b))[0]
}

function spawnNameless(state, api, locationId) {
  if (!locationId) return null
  const spawned = api.spawn?.(RAW_CODES.namelessMadness, locationId)
  api.info?.(`👁️ 生成 1 份「无名的疯狂」（${locationId}）。`)
  return spawned
}

function applyRampSequence(state, api) {
  if (flagsOf(state).rampSequence) return
  flagsOf(state).rampSequence = true
  const gateId = 'theGateOfYquaa'
  const ramps = ['titanicRamp1', 'titanicRamp2', 'titanicRamp3', 'titanicRamp4']
  const chain = [gateId, ...ramps, 'hiddenTunnel']
  const keep = new Set(chain)
  state.locations = (state.locations || []).filter(location => keep.has(location.id))
  for (const definitionId of chain) {
    if (state.locations.some(location => location.id === definitionId)) continue
    const base = state.scenario.locations[definitionId]
    if (base) state.locations.push({ ...JSON.parse(JSON.stringify(base)), revealed: true, clues: 0, doom: 0 })
  }
  for (let index = 0; index < chain.length - 1; index += 1) {
    const from = locationOf(state, chain[index])
    const to = locationOf(state, chain[index + 1])
    if (!from || !to) continue
    if (!from.connections.includes(to.id)) from.connections.push(to.id)
    if (!to.connections.includes(from.id)) to.connections.push(from.id)
  }
  const target = locationOf(state, 'titanicRamp1')
  if (target) for (const inv of state.investigators || []) if (!inv.defeated && !inv.resigned) inv.location = target.id
  const collapsed = collapsedTowers(state).length
  const nameless = (state.enemies || []).filter(enemy => codeOf(enemy) === RAW_CODES.namelessMadness)
  const keepCount = Math.max(0, 3 - collapsed)
  const removed = nameless.slice(keepCount)
  state.enemies = (state.enemies || []).filter(enemy => !removed.includes(enemy))
  api.info?.(`🌊 坡道场景：只保留伊夸之门与泰坦坡道/隐藏隧道；${removed.length} 份无名的疯狂移出。`)
}

function currentActCode(state) { return codeOf(state.acts?.[state.actIndex]) }

export const behavior = {
  id: CHAPTER_ID,
  name: '疯狂之心 第 II 部分',

  preScenarioSetup(state, events, api) {
    prepareSeals(state, api)
    recordCampaignLogBranch(state, api)
    state.scenarioFlags.gateFlipped = true
    api.info?.('🫀 疯狂之心 II：伊夸之门翻面；十五格随机布置设施与迷雾高塔（内环不得全是高塔）。')
  },

  setupLocations(state, events, helper = {}) {
    randomizeFacilityFaces(state)
    flagsOf(state).locationsRandomized = true
    state.encounterDeck = state.encounterDeck?.length ? state.encounterDeck : [...(state.scenario.encounterDeck || [])]
    const innerFacilities = INNER_RING_SLOTS.filter(slot => !slotIsPylon(state, slot))
    const start = innerFacilities[0] || 'titanicRamp1'
    state.scenario.startLocation = start
    flagsOf(state).startLocation = start
    state.scenarioFlags.gateFlipped = true
    helper.info?.(state, events, `🫀 设施与迷雾高塔已随机布置；调查员从最近设施「${start}」开始。`)
    return ['theGateOfYquaa', ...(state.scenario.facilitySlots || [])]
  },

  locationPlaced(state, location, api) {
    if (!location) return
    if (location.id === 'theGateOfYquaa' && flagsOf(state).gateFlipped) {
      location.revealed = false
      api.info?.('🚪 伊夸之门以未揭示面进场（不可进入）。')
    }
    if (slotIsPylon(state, location.id)) location.mistPylon = true
    // 设施/高塔登记必须在十五个槽位都已入场后做（initializeFacilities 校验地点在场）。
    if (!flagsOf(state).facilitiesInitialized
      && (state.scenario.facilitySlots || []).every(slot => locationOf(state, slot))) {
      initializeChapterFacilities(state)
    }
  },

  actions(state, inv) {
    const location = locationOf(state, inv?.location)
    if (!location) return []
    const moves = []
    locationRuleFor(codeOf(location))?.actions?.({ moves, state, inv, location })
    if (currentActCode(state) === '08673' && location.mistPylon && towerState(state, location.id)?.collapsed !== true) {
      moves.push({ action: 'scenarioAction', rule: `heartOfMadnessAttackPylon:${location.id}`, actions: 1,
        label: `🗼 攻击迷雾高塔（fight=${location.shroud}，health=${towerHealth(state, location.id)}）` })
    }
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
    if (typeof move.rule === 'string' && move.rule.startsWith('heartOfMadnessAttackPylon:')) {
      const towerId = move.rule.slice('heartOfMadnessAttackPylon:'.length)
      const tower = towerState(state, towerId)
      if (!tower || tower.collapsed) return true
      const resolve = () => {
        const damage = 1 + (flagsOf(state).pylonDamageBonus || 0)
        const result = damageTower(state, { towerId, amount: damage })
        api.info?.(`🗼 迷雾高塔受到 ${damage} 伤害（剩余 ${result?.remaining ?? 0}）。`)
        if (result?.collapsed) api.info?.('🗼 迷雾高塔坍塌！')
      }
      api.test?.(inv.seat, 'combat', tower.health || location.shroud || 1, resolve)
      return true
    }
    if (typeof move.rule === 'string' && move.rule.startsWith('heartOfMadnessUnleash:')) {
      const kind = move.rule.slice('heartOfMadnessUnleash:'.length)
      if (placeSeal(state, kind, { seat: inv.seat, locationId: location.id })) {
        flagsOf(state).pylonPowers = { ...(flagsOf(state).pylonPowers || {}), [kind]: true }
        if (kind === 'A') flagsOf(state).pylonDamageBonus = 1
        api.info?.(`🔓 释放封印 ${kind} 的力量。`)
      }
      return true
    }
    return locationRuleFor(codeOf(location))?.performAction?.(state, inv, move, api) || false
  },

  locationLeaveTest(state, inv, from, to, api) {
    const rule = locationRuleFor(codeOf(from))
    if (!rule?.leaveTestDifficulty) return undefined
    return { skill: 'agility', difficulty: rule.leaveTestDifficulty, spendClueAutoSucceed: rule.spendClueAutoSucceed === true }
  },

  checkObjectives(state, api) {
    if (state.status !== 'playing') return
    const act = state.acts?.[state.actIndex]
    if (!act) return
    const code = codeOf(act)
    if (['08673'].includes(code)) {
      const pylons = pylonSlots(state)
      if (pylons.length && pylons.every(slot => towerState(state, slot)?.collapsed === true)) {
        api.info?.('🗼 全部迷雾高塔坍塌：推进幕 3。')
        api.advanceAct?.()
      }
      return
    }
    if (['08681'].includes(code)) {
      const active = activeInvestigators(state)
      const tunnel = locationOf(state, 'hiddenTunnel')
      if (tunnel && active.length && active.every(inv => inv.location === 'hiddenTunnel')) {
        const records = recordsFor(state)
        const allCollapsed = collapsedTowers(state).length >= 5
        if (allCollapsed && records.drKenslerHasAPlan) api.finish?.('resolution1', state)
        else if (allCollapsed && records.theTruthOfTheMirageEludesYou) api.finish?.('resolution2', state)
        else api.finish?.('resolution3', state)
      }
    }
  },

  agendaReveal(state, agenda, api) {
    agendaRuleFor(codeOf(agenda), CHAPTER_ID)?.onReveal?.(state, agenda, api)
    return true
  },

  agendaLeftPlay(state, agenda, api) {
    const rule = agendaRuleFor(codeOf(agenda), CHAPTER_ID)
    if (rule?.backEffect === 'spawnNamelessAtPylon') {
      const target = nearestPylonTo(state, state.investigators?.[leadSeat(state)] || activeInvestigators(state)[0])
      if (target) spawnNameless(state, api, target)
    }
    if (rule?.backEffect === 'rampSequence') applyRampSequence(state, api)
  },

  actReveal(state, act, api) {
    actRuleFor(codeOf(act))?.onReveal?.(state, act, api)
    return true
  },

  actLeftPlay(state, act, api) {
    if (actRuleFor(codeOf(act))?.backEffect === 'rampSequence') applyRampSequence(state, api)
  },

  enemyPhaseEnd(state, api) {
    const phantasm = (state.enemies || []).find(enemy => codeOf(enemy) === RAW_CODES.unsealedPhantasm)
    if (!phantasm || phantasm.location == null) return
    const order = ['theGateOfYquaa', ...(state.scenario.facilitySlots || [])]
    const index = order.indexOf(phantasm.location)
    const next = order.slice(Math.max(0, index + 1)).find(id => id !== phantasm.location)
    if (next) {
      phantasm.location = next
      api.info?.('👻 未封幻影在敌人阶段结束时朝最近的迷雾高塔移动 1 格。')
    }
  },

  afterTest(state, inv, result, api) {
    for (const effect of heartOfMadnessChaosAfterTest(state, inv, result)) {
      if (effect.type === 'drawTekeli') api.info?.('🟣 石板标记：忒咳哩-哩牌库抽牌（P5 弱点管线近似）。')
      if (effect.type === 'addDoom') api.addDoom?.(effect.amount)
    }
    const enemy = state.skillTest?.testTarget?.enemy || state.skillTest?.enemy
    if (enemy && codeOf(enemy) === RAW_CODES.namelessMadness && result?.success) {
      const nearest = (state.enemies || []).find(other => codeOf(other) === RAW_CODES.namelessMadness && other.exhausted)
      if (nearest) {
        nearest.exhausted = false
        api.info?.('👁️ 成功差值令最近一份「无名的疯狂」重整。')
      }
    }
  },

  resolveChaosToken(state, inv, token) {
    return heartOfMadnessChaosToken(state, inv, token)
  },

  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    records.theSurvivorsOfTheExpeditionWere = activeInvestigators(state).map(inv => inv.code || inv.name)
    const collapsed = collapsedTowers(state).length
    if (key === 'resolution1' || key === 'r1') {
      records.theNamelessMadnessIsContainedSafelyWithinItsHostForNow = true
      api.info?.(`🫀 结局 1：无名疯狂被安全封在其宿主内（坍塌高塔 ${collapsed}/5）；+10 经验。`)
      return { award: true, bonus: 10 }
    }
    if (key === 'resolution2' || key === 'r2') {
      records.theFacilityWasDestroyed = true
      // 结局钩子的 api.addTrauma 是引擎注入的 state-first 版本（campaign-flow.js#applyResolutionEffects）。
      for (const inv of activeInvestigators(state)) {
        api.addTrauma?.(state, inv.seat, 'physical', 1, events)
        api.addTrauma?.(state, inv.seat, 'mental', 1, events)
      }
      api.info?.(`🫀 结局 2：设施被摧毁；+10 经验，各 1 肉体/1 精神创伤。`)
      return { award: true, bonus: 10 }
    }
    if (key === 'resolution3' || key === 'r3') {
      records.theTeamEscapedTheFacility = true
      for (const inv of activeInvestigators(state)) {
        api.addTrauma?.(state, inv.seat, 'physical', 2, events)
        api.addTrauma?.(state, inv.seat, 'mental', 2, events)
      }
      api.info?.('🫀 结局 3：队伍逃离设施；+5 经验，各 2 肉体/2 精神创伤。')
      return { award: true, bonus: 5 }
    }
    if (key === 'noResolution') return { award: true, bonus: 0 }
    return { award: true, bonus: 0 }
  },
}

export const implementedEncounterCodes = Object.freeze([
  '08671', '08672', '08673', '08674', '08675', '08676', '08677', '08678',
  '08679', '08680', '08681', '08682', '08683', '08684', '08685', '08686',
])

export const HEART_OF_MADNESS_PART2_RULES = Object.freeze({ pylonSlotCodes: PYLON_SLOT_CODES, rampCodes: RAMP_CODES })

void entryFlags
void enemyScriptFor