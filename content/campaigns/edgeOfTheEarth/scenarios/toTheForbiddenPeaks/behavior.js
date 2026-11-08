// 失落之峰（To the Forbidden Peaks · 08596）· 引擎钩子（章节流程 + 攀登/高度机械）。
//
// 约定（与 TDE 章节 behavior 相同）：
//   · 逐卡规则在单卡条目的 actRule / agendaRule / locationRule / enemyRule / encounterResolve / flags；
//     behavior 只做分派与本章专属机械（攀登、高度、探险支援丢失、结局记录），不按卡号写分支。
//   · 内容层（behavior）允许直接读写 state；卡条目禁止，只拿 ctx.api。
//   · 攀登/高度统一走 P2 原语：`src/engine/vertical-chain.js`（location.level ↔ row）与
//     `src/engine/eote-climb.js`（ascend/descend/enterFromBelow/cluesLostOnMove/dropExpeditionAssets）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, encounterResolveFor, enemyRuleFor, entryFlags, locationRuleFor,
  resolveDeclarativeTreacheryTest, treacheryRuleFor, treacheryTestFor,
} from '../../../../../src/cards/card-rules.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { initializeTekeliDeck } from '../../../../../src/engine/eote-tekeli.js'
import {
  ascend as climbAscend, climbState, descend as climbDescend, cluesLostOnMove, dropExpeditionAssets,
} from '../../../../../src/engine/eote-climb.js'
import { locationLevel, setLocationLevel } from '../../../../../src/engine/vertical-chain.js'
import { tekeliShuffleIn } from '../../../../../src/engine/eote-tekeli.js'
import {
  TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS, toTheForbiddenPeaksAfterTest, toTheForbiddenPeaksChaosToken, cardNameOf,
} from './chaos.js'
import {
  EXPEDITION_ASSETS, MOUNTAINSIDE_IN_PLAY, RAW_CODES, SET_ASIDE_CODES, SET_ASIDE_LOCATIONS,
  START_LOCATION, SUMMIT, TEKELI_COPIES, TEKELI_FACES, enemyCodesFor, entryCodes,
} from './definition.js'

const CHAPTER_ID = 'toTheForbiddenPeaks'
const codeOf = card => card?.originalCode || card?.code || card
const locationOf = (state, inv) => (state.locations || []).find(item => item.id === inv?.location) || null
const codeOfLocationId = (state, id) => codeOf((state.scenario?.locations || {})[id])
const locationIdOfCode = (state, code) => Object.entries(state.scenario?.locations || {})
  .find(([, definition]) => codeOf(definition) === code)?.[0] || null
const recordsFor = state => {
  state.campaign ||= {}
  state.campaign.records ||= {}
  return state.campaign.records
}
const levelOf = (state, id) => {
  const location = (state.locations || []).find(item => item.id === id)
  const level = location ? locationLevel(location) : null
  return Number.isSafeInteger(level) ? level : 0
}
const belowIdOf = (state, id) => (state.locations || [])
  .find(item => locationLevel(item) === levelOf(state, id) - 1)?.id || null
const aliveInvestigators = state => (state.investigators || []).filter(inv => !inv.defeated && !inv.resigned)
const engagedEnemies = (state, seat) => (state.enemies || []).filter(enemy => enemy.engagedSeat === seat)
const isExpeditionAsset = asset => {
  const code = typeof asset === 'string' ? asset : (asset?.originalCode || asset?.code)
  if (!code) return false
  // 条目级 flags.expedition（08614–08620 单卡条目）是首选读点；traits 只作兜底。
  if (entryFlags(code)?.expedition === true) return true
  if (EXPEDITION_ASSETS.some(id => RAW_CODES[id] === code)) return true
  const traits = asset?.traits || ALL_CARDS[code]?.traits || []
  return traits.some(trait => String(trait).toLowerCase().includes('expedition'))
}

// —— 开场/布置 ——
export const scenarioApproximations = Object.freeze([
  '七个山腰地点印刷为「洗牌后随机取 5 个排成斜线」；本实现固定 08600/08602/08603/08604/08605 入场，08601/08606 放一边（确定性开局）。',
  '08614 绿皂石：印刷是「成功攻击后使本次攻击 +1 伤害」；引擎在检定发起时算定伤害，改为成功后对交战敌人追加 1 点伤害（与 08086 同一近似口径）。',
  '08615 木制雪撬：缺少「正面朝下附属到支援并可当作手牌打出」的通用通道；检索结果改为加入调查员手牌。',
  '08618 矿物标本：缺少「取消本次检定期间已揭示的混乱标记」的通用原语；其余（基础值 5 的调查、成功额外 1 线索）按印刷实现。',
  '08619 小型收音机：缺少「在不在场支援上触发能力」的通用原语；以「把放一边的 Expedition 支援放置入场」承担远程联络的可见效果。',
])
export const scenarioGaps = Object.freeze([
  '08615/08619 的支援附属打出通道与离场支援能力触发原语尚未登记；补原语后可去掉上述近似。',
  '08618 的「取消已揭示 [frost] 标记」缺少标记取消原语。',
])

export const implementedEncounterCodes = Object.freeze([...entryCodes()])

export const behavior = {
  id: CHAPTER_ID,
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps,
  tokenMeanings: TO_THE_FORBIDDEN_PEAKS_TOKEN_MEANINGS,

  // ---- 开局介绍：是否勘察过山口（Campaign Log） ----
  preScenarioSetup(state, events, api) {
    const flags = (state.scenarioFlags ||= {})
    if (flags.introResolved) return
    flags.introResolved = true
    const scouted = recordsFor(state).theInvestigatorsScoutedTheMountainPass === true
    flags.scoutedTheMountainPass = scouted
    api?.info?.(scouted
      ? '🏔️ 队伍已勘察过山口：跳过开场，直接布置。'
      : '🏔️ 队伍尚未勘察山口：按序幕进入失落之峰。')
  },

  // ---- 布置：5 个山腰地点斜线 + 山顶；其余地点/星之恐怖/7 件探险支援放一边 ----
  setupLocations(state, events, helper = {}) {
    const zones = (state.scenarioZones ||= {})
    const flags = (state.scenarioFlags ||= {})
    const placed = [...MOUNTAINSIDE_IN_PLAY.map(id => locationIdOfCode(state, RAW_CODES[id]) || id), SUMMIT]
    // level 与连接由数据声明；这里把 level 写回运行时 location（vertical-chain 读点）。
    for (const id of placed) {
      const location = (state.locations || []).find(item => item.id === id)
      if (!location) continue
      const level = state.scenario?.locations?.[id]?.level
      if (Number.isSafeInteger(level)) setLocationLevel(location, level)
      location.revealed = id === locationIdOfCode(state, RAW_CODES.deepDrifts)
      if (location.revealed) flags.revealedLevel = 0
    }
    zones.setAside = [...SET_ASIDE_CODES]
    zones.removed = []
    zones.victory = zones.victory || []
    flags.encounterDeckReady = true
    helper.info?.(state, events, '🏔️ 失落之峰：五个山腰地点排成斜线，山顶位于顶端；其余地点、星之恐怖与探险支援放在一边。')
    return placed
  },

  setupEnemies() {},

  // ---- 布置后：探险支援按战役日志「Supplies Recovered」入场（参考实现 Setup.suppliesRecovered）----
  // 已回收的 7 件 Expedition 剧情支援在 Level 0 地点入场（尚无人控制，可由幕 08599 的行动取得）；
  // 未回收的从游戏中移出。修复前 7 张只放在一边、从不进场（账本却记 verified）。
  afterDeckSetup(state, events, helper = {}) {
    const api = helper.api
    const zones = (state.scenarioZones ||= {})
    zones.setAside ||= []
    const recovered = new Set(recordsFor(state).suppliesRecovered || [])
    const level0 = locationIdOfCode(state, RAW_CODES.deepDrifts) || START_LOCATION
    let placed = 0
    for (const key of EXPEDITION_ASSETS) {
      const code = RAW_CODES[key]
      if (recovered.has(code)) {
        const asset = api?.storyAsset?.(code, level0)
        if (asset) {
          // api.storyAsset 只发实例，不照抄条目 uses（引擎通用缺口）；此处按条目补「使用(N)」。
          const entry = registeredEntry(code)
          if (asset.uses == null && entry?.uses != null) {
            asset.uses = entry.uses
            asset.usesType = entry.usesType || 'charges'
          }
          placed += 1
        }
      } else if (!zones.setAside.includes(code)) {
        // 未回收的 Expedition 支援「移出游戏、不在场上」：放进放一边区（08619 的远程联络来源）。
        zones.setAside.push(code)
      }
    }
    api?.info?.(`🎒 失落之峰：${placed} 件已回收的探险支援进入 Level 0；其余 Expedition 支援放在一边（不在场上）。`)
    // 参考 Setup：gather Tekeli-li 后建立独立弱点牌库（16 张）。跨章节保留的牌库不重复初始化。
    try {
      const total = initializeTekeliDeck(state, { cards: [...TEKELI_FACES], copies: [...TEKELI_COPIES] })
      api?.info?.(`🟣 忒咳哩-哩牌库已建立（${total} 张）。`)
    } catch (error) {
      if (!/已经初始化|already initialized/.test(String(error?.message))) throw error
    }
  },

  // ---- 幕/议程钩子：逐卡 actRule/agendaRule.onReveal 分派 ----
  actReveal(state, act, api) {
    const rule = actRuleFor(codeOf(act))
    if (!rule) return false
    if (rule.onReveal === 'resolution1') {
      api?.finish?.('resolution1')
      return true
    }
    if (typeof rule.onReveal === 'function') return rule.onReveal(state, act, api) === true
    return false
  },

  agendaReveal(state, agenda, api) {
    const rule = agendaRuleFor(codeOf(agenda))
    if (!rule) return false
    const action = rule.onReveal
    if (action === 'spawnTerrorOfTheStars') return Boolean(behavior.spawnTerrorOfTheStars(state, api))
    if (action === 'finalResolution') {
      const key = behavior.finalResolution(state)
      behavior.resolution(state, key, [], api)
      api?.finish?.(key)
      return true
    }
    if (action === 'addFrostToken') return behavior.addFrostToken(state, api) != null
    if (typeof action === 'function') return action(state, agenda, api) === true
    return false
  },

  // 山顶揭示：混乱袋加入 1 个 frost 标记。
  addFrostToken(state, api) {
    state.chaosBag ||= []
    state.chaosBag.push('frost')
    api?.addChaosToken?.('frost')
    api?.info?.('❄️ 山顶被揭示：混乱袋加入 1 个 [frost] 标记。')
    return 'frost'
  },

  // 地点揭示钩子：山顶加 frost；迎风通路按人数放线索。
  locationRevealed(state, location, api) {
    const id = typeof location === 'string' ? location : location?.id
    const rule = locationRuleFor(codeOfLocationId(state, id))
    if (!rule?.onReveal) return null
    if (rule.onReveal === 'addFrostToken') return behavior.addFrostToken(state, api)
    if (rule.onReveal?.effect === 'placeCluesPerInvestigator') {
      const target = (state.locations || []).find(item => item.id === id)
      const amount = (Number(state.numInvestigators) || (state.investigators || []).length || 1) * (rule.onReveal.amount || 1)
      if (target) target.clues = (target.clues || 0) + amount
      api?.info?.(`❄️ 迎风通路揭示：放置 ${amount} 个线索。`)
      return amount
    }
    return null
  },

  // 议程 1 背面（08597）：在最高且有调查员的地点放置星之恐怖；该地点所有调查员失去探险支援。
  spawnTerrorOfTheStars(state, api) {
    const occupied = (state.investigators || []).filter(inv => inv.location)
    if (!occupied.length) return null
    const highest = occupied.map(inv => locationOf(state, inv)).filter(Boolean)
      .sort((a, b) => locationLevel(b) - locationLevel(a))[0]
    if (!highest) return null
    const enemy = {
      id: `enemy-${RAW_CODES.terrorOfTheStars}`, code: RAW_CODES.terrorOfTheStars,
      originalCode: RAW_CODES.terrorOfTheStars, location: highest.id, engagedSeat: null,
      exhausted: false, damageTaken: 0, spawned: true,
    }
    state.enemies ||= []
    state.enemies.push(enemy)
    for (const inv of occupied.filter(inv => inv.location === highest.id)) dropExpeditionAssetsOf(state, inv, api)
    api?.info?.(`🌠 「星之恐怖」在 ${highest.id}（最高处）入场；该地点的调查员失去所有探险支援。`)
    return enemy
  },

  // ---- 目标检查：所有未被击败的调查员都撤退 → 推进（幕 1 目标） ----
  checkObjectives(state, api) {
    const act = state.acts?.[state.actIndex ?? 0]
    const rule = actRuleFor(codeOf(act))
    if (rule?.objective?.type === 'allResigned') {
      const alive = (state.investigators || []).filter(inv => !inv.defeated)
      if (!alive.length) return true
      return alive.every(inv => inv.resigned === true)
    }
    return false
  },

  // ---- 移动前：记录「从哪一层来」（引擎读点 movement.js:283，在 enter 之前调用）----
  // 真实移动管线不会调用 eote-climb 的 ascend（那是给卡牌/剧本效果用的原语），因此
  // 「从下方进入」的强制效果不能只认 climbState；这里按 beforeMove 的 from/to Level 现算。
  beforeMove(state, inv, destination, api, options = {}) {
    const toId = typeof destination === 'string' ? destination : destination?.id
    if (!toId || !inv) return undefined
    const from = inv.location
    const flags = (state.scenarioFlags ||= {})
    flags.pendingMove = {
      seat: inv.seat, from, to: toId,
      fromLevel: levelOf(state, from), toLevel: levelOf(state, toId),
      reason: options?.reason === 'move' ? 'move' : 'effect',
    }
    return undefined
  },

  // ---- 地点进入（引擎读点 movement.js:249 / locations.js:304）----
  // 1) 08597/08598 议程正面的强制「在你移动到一个地点后：将你所有线索放回供应堆」；
  // 2) 08600–08606 背面「从下方的地点移动到本地点后」的强制效果。
  // 修复前 1) 写在死的 behavior.afterMove（引擎无调用点）、2) 只认 ascend 原语标记。
  locationEntered(state, inv, location, api) {
    const id = typeof location === 'string' ? location : location?.id
    if (!id || !inv) return null
    const agenda = state.agendas?.[state.agendaIndex ?? 0]
    const forced = agendaRuleFor(codeOf(agenda))?.onMove
    let returnedClues = 0
    if (forced === 'returnClues') {
      returnedClues = cluesLostOnMove(state, inv)
      if (returnedClues) {
        inv.clues = 0
        api?.info?.(`❄️ 移动后：将 ${returnedClues} 个线索放回供应堆（议程强制）。`)
      }
    }
    const fromBelow = consumeFromBelow(state, inv, id)
    if (!fromBelow) return returnedClues ? { returnedClues } : null
    const code = codeOfLocationId(state, id)
    const rule = locationRuleFor(code)
    if (!rule?.enterFromBelow) return returnedClues ? { returnedClues } : null
    const effect = applyEnterFromBelow(state, inv, id, rule.enterFromBelow, api)
    return { returnedClues, enterFromBelow: effect }
  },

  // ---- 移动校验：跨层只能走攀登原语；山腰背面「下方地点无线索」限制 ----
  moveError(state, inv, destination, id) {
    // 引擎/投影传地点对象（TCU/TDE 同口径），测试/旧调用可能传字符串；两种都接受。
    const toId = typeof destination === 'string' ? destination : (destination?.id ?? id)
    const from = locationOf(state, inv)
    if (!from) return '当前地点不存在'
    const target = (state.locations || []).find(item => item.id === toId)
    if (!target) return '目标地点不存在'
    const fromLevel = locationLevel(from)
    const toLevel = locationLevel(target)
    if (Number.isSafeInteger(fromLevel) && Number.isSafeInteger(toLevel)) {
      if (toLevel === fromLevel) return null
      if (Math.abs(toLevel - fromLevel) !== 1) return '只能沿山腰逐层移动（Level ±1）'
      if (toLevel > fromLevel) {
        // 08609「拘束型古老者与你交战时，你不能移动到你所在地点上方的地点」：
        // 条目 enemyRule.blocksAscendWhileEngaged，读点在这里（legalMoves/validateMove 共用）。
        const blockedByElderThing = (state.enemies || []).some(enemy => !enemy.defeated
          && enemy.location === from.id && enemy.engagedSeat === inv.seat
          && enemyRuleFor(codeOf(enemy))?.blocksAscendWhileEngaged === true)
        if (blockedByElderThing) return '与「拘束型古老者」交战时不能移动到上方的地点'
        const rule = locationRuleFor(codeOfLocationId(state, toId))
        if (rule?.blocksUntilBelowClear) {
          const below = belowIdOf(state, toId)
          const belowLocation = below && (state.locations || []).find(item => item.id === below)
          if (belowLocation && (belowLocation.clues || 0) > 0) return '下方地点的线索尚未全部发现，不能进入'
        }
      }
    }
    return null
  },

  // ---- 攀登包装（测试与章节流程共用；真正位移仍由调用方走权威移动管线） ----
  ascend(state, inv, toId) {
    const transition = climbAscend(state, inv, toId)
    if (transition) recordMove(state, inv, toId)
    return transition
  },

  descend(state, inv, toId) {
    const transition = climbDescend(state, inv, toId)
    if (transition) recordMove(state, inv, toId)
    return transition
  },

  climbLevel(state, inv) {
    const location = locationOf(state, inv)
    return location ? locationLevel(location) : 0
  },

  // ---- 遭遇卡结算（treacheryRule.resolveKind 数据驱动；behavior 只做分派） ----
  resolveEncounter(state, inv, card, api) {
    const code = codeOf(card)
    const entryResolve = encounterResolveFor(code)
    if (entryResolve) return entryResolve(state, inv, card, api, { location: locationOf(state, inv) })
    const kind = treacheryRuleFor(code)?.resolveKind
    const handler = kind && TREACHERY_HANDLERS[kind]
    if (handler) return handler(state, inv, card, api) !== false
    const declarative = treacheryTestFor(code)
    if (declarative) return resolveDeclarativeTreacheryTest(state, inv, card, api, declarative)
    return false
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token) {
    return toTheForbiddenPeaksChaosToken(state, inv, token)
  },

  afterTest(state, inv, result, api) {
    const riders = toTheForbiddenPeaksAfterTest(state, inv, result) || []
    for (const rider of riders) {
      if (rider === 'moveBelow') moveBelow(state, inv, api)
      else if (rider === 'dropExpedition') dropExpeditionAssetsOf(state, inv, api)
      else if (rider === 'elderThing') nearestElderThingMovesAndAttacks(state, inv, api)
    }
    return riders
  },

  // ---- 敌人修正：X = 所在地点 level（至少 1） ----
  // 印刷卡表把「X」记成 -2 占位（cards-data.js 08608/08609 约定；与其他循环的 X 值一致）。
  // 引擎读点是「印刷值 + 本钩子返回值」，所以 X 项必须返回 level+2 抵消 -2 占位，
  // 而不是直接返回 level（旧实现 -2 + level 在 Level 0/1 会得到 -2/-1）。
  // 08608「生命 +3[per_investigator]」是叠加在印刷 3 上的常驻修正，不涉及占位。
  enemyStatModifier(state, enemy, stat) {
    const rule = enemyRuleFor(codeOf(enemy))
    if (!rule) return 0
    const printed = Number(enemy?.[stat])
    const level = Math.max(1, levelOf(state, enemy?.location || ''))
    let modifier = 0
    if (rule.levelStats === 'level' && printed === -2) modifier += level + 2
    if (stat === 'health' && rule.perInvestigatorHealth === true) {
      modifier += 3 * (Number(state.numInvestigators) || (state.investigators || []).length || 1)
    }
    return modifier
  },

  // ---- 轮末：08608「将星之恐怖所在地点的所有调查员移动到下方紧挨着的地点」 ----
  // 读点是条目 enemyRule.roundEnd（不再按卡号分支）。
  roundEnded(state, api) {
    let acted = false
    for (const enemy of state.enemies || []) {
      if (enemy.defeated || !enemy.location) continue
      if (enemyRuleFor(codeOf(enemy))?.roundEnd !== 'moveDownToBelow') continue
      for (const inv of (state.investigators || [])) {
        if (inv.location !== enemy.location || inv.defeated || inv.resigned) continue
        moveBelow(state, inv, api)
      }
      acted = true
    }
    return acted
  },

  // ---- 行动：山顶撤退（08607 locationRule.flags.summitResign）；幕 08599「控制本地点一个探险支援」----
  actions(state, inv, api) {
    const moves = []
    const id = inv?.location
    const hereRule = locationRuleFor(codeOfLocationId(state, id))
    if (hereRule?.flags?.summitResign === true) {
      moves.push({ action: 'scenarioAction', rule: 'summitResign', actions: 1, label: '🏔️ 山顶：撤退（探险支援加入胜利区）' })
    }
    const locals = (state.storyAssets || []).filter(asset => asset.location === id && isExpeditionAsset(asset))
    for (const local of locals) {
      moves.push({ action: 'scenarioAction', rule: 'takeExpeditionAsset', assetId: local.id, actions: 1,
        label: `🎒 控制本地点的一件探险支援（${cardNameOf(local.code || local.originalCode)}）` })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    if (!move) return false
    if (move.rule === 'summitResign') {
      const victory = (state.victoryDisplay ||= [])
      for (const asset of inv.assets || []) {
        if (!isExpeditionAsset(asset)) continue
        victory.push({ code: asset.code, originalCode: asset.code, victory: 0 })
      }
      inv.assets = (inv.assets || []).filter(asset => !isExpeditionAsset(asset))
      inv.clues = 0
      inv.resigned = true
      api?.resign?.(inv.seat)
      api?.info?.('🏔️ 从山顶撤退：探险支援加入胜利区，线索放回供应堆。')
      return true
    }
    if (move.rule === 'takeExpeditionAsset') {
      const asset = (state.storyAssets || []).find(item => item.location === inv.location
        && isExpeditionAsset(item) && (move.assetId == null || String(item.id) === String(move.assetId)))
      if (!asset) return false
      state.storyAssets = state.storyAssets.filter(item => item !== asset)
      inv.assets ||= []
      inv.assets.push(asset)
      api?.info?.(`🎒 ${inv.name} 控制「${cardNameOf(asset.code)}」。`)
      return true
    }
    return false
  },

  // 引擎签名：resolution(state, resolutionKey, events, api)（同 TIC/TDE/Heart of Madness）。
  resolution(state, key, events, api = {}) {
    const records = recordsFor(state)
    records.theInvestigatorsScoutedTheMountainPass = state.scenarioFlags?.scoutedTheMountainPass === true
    // 参考实现 ScenarioResolution：结局 1 记录「队伍爬上了山顶」；结局 2 记录「队伍找到另一条翻山的路」。
    if (key === 'resolution1' || key === 'r1') records.theTeamClimbedToTheSummit = true
    else if (key === 'resolution2' || key === 'r2') records.theTeamFoundAnotherWayThroughTheMountains = true
    api.info?.(key === 'resolution1' || key === 'r1'
      ? '🏔️ 结局 1：队伍爬上了山顶（战役日志：队伍爬上了山顶）。'
      : key === 'resolution2' || key === 'r2'
        ? '🏔️ 结局 2：队伍找到了另一条翻山的路（战役日志：队伍找到另一条翻山的路）。'
        : '🏔️ 失落之峰结算。')
    return key
  },

  // 结局分派（由 agenda2 背面调用）：有调查员撤退 → 结局 1，否则结局 2。
  finalResolution(state) {
    const resigned = (state.investigators || []).some(inv => inv.resigned)
    return resigned ? 'resolution1' : 'resolution2'
  },

  // 完整结局列表（manifest 用）。
  resolutionIds: ['noResolution', 'resolution1', 'resolution2'],
}

// —— 章节内部工具（不按卡号分支；entry 数据驱动）——

function recordMove(state, inv, toId) {
  const fromId = inv.location
  const fromLevel = levelOf(state, fromId)
  const toLevel = levelOf(state, toId)
  inv.location = toId
  const flags = (state.scenarioFlags ||= {})
  flags.lastClimb = { from: fromId, to: toId, fromLevel, toLevel, direction: toLevel >= fromLevel ? 'up' : 'down' }
  const target = (state.locations || []).find(item => item.id === toId)
  if (target && !target.revealed) target.revealed = true
  return flags.lastClimb
}

// 「从下方的地点移动到本地点」判定：优先读 beforeMove 记下的 from/to Level（真实移动管线），
// 兼容测试/卡牌效果直接调用 behavior.ascend 记下的 climbState 标记。每次进入都会消费一次记录。
function consumeFromBelow(state, inv, toId) {
  const flags = (state.scenarioFlags ||= {})
  const pending = flags.pendingMove
  let fromBelow = false
  if (pending && pending.seat === inv?.seat && String(pending.to) === String(toId)) {
    fromBelow = Number.isSafeInteger(pending.toLevel) && Number.isSafeInteger(pending.fromLevel)
      && pending.toLevel === pending.fromLevel + 1
    delete flags.pendingMove
  }
  if (!fromBelow) {
    const climb = climbState(state)?.seats?.[String(inv?.seat)]
    fromBelow = climb?.enterFromBelow === true && String(climb.to) === String(toId)
  }
  return fromBelow
}

function applyEnterFromBelow(state, inv, id, spec, api) {
  const kind = spec.effect || spec
  if (kind === 'discardTop3ThenDrawWeaknesses') {
    const deck = inv.deck || []
    const discarded = deck.splice(Math.max(0, deck.length - 3), 3)
    const weaknesses = discarded.filter(code => ALL_CARDS[code]?.type === 'treachery' && ALL_CARDS[code]?.subtype === 'weakness')
    inv.discard = [...(inv.discard || []), ...discarded.filter(code => !weaknesses.includes(code))]
    for (const code of weaknesses) {
      inv.deck.push(code)
      api?.drawCards?.(inv.seat, 1)
    }
    api?.info?.(`❄️ 从下方进入「${cardNameOf(codeOfLocationId(state, id))}」：弃掉牌库顶 3 张。`)
    return { effect: kind, discarded, weaknesses }
  }
  if (kind === 'agilityTestLevelPlus1OnFailDropExpedition') {
    const difficulty = levelOf(state, id) + 1
    api?.test?.(inv.seat, 'agility', difficulty, result => {
      if (!result?.success) dropExpeditionAssetsOf(state, inv, api)
    })
    return { effect: kind, difficulty }
  }
  if (kind === 'damage1') {
    inv.damage = (inv.damage || 0) + 1
    api?.info?.('❄️ 从下方进入：受到 1 点伤害。')
    return { effect: kind, damage: 1 }
  }
  if (kind === 'horror1') {
    inv.horror = (inv.horror || 0) + 1
    api?.info?.('❄️ 从下方进入：受到 1 点恐惧。')
    return { effect: kind, horror: 1 }
  }
  if (kind === 'tekeliShuffleIntoDeck') {
    const result = tekeliShuffleIn(state, inv.seat, 1)
    api?.info?.('❄️ 从下方进入：忒咳哩-哩牌库顶 1 张混洗入你的牌库。')
    return { effect: kind, shuffled: result !== false }
  }
  if (kind === 'exhaustAllAssets') {
    for (const asset of inv.assets || []) asset.exhausted = true
    api?.info?.('❄️ 从下方进入：横置你控制的所有支援。')
    return { effect: kind }
  }
  if (kind === 'placeClues') {
    const location = (state.locations || []).find(item => item.id === id)
    if (location) location.clues = (location.clues || 0) + (spec.amount ?? 1)
    api?.info?.('❄️ 从下方进入：在该地点放置 1 个线索。')
    return { effect: kind, amount: spec.amount ?? 1 }
  }
  return null
}

function moveBelow(state, inv, api) {
  const from = locationOf(state, inv)
  if (!from) return false
  const target = belowIdOf(state, from.id)
  if (!target) {
    api?.info?.('❄️ 下方没有可移动的地点。')
    return false
  }
  inv.location = target
  api?.info?.(`❄️ ${inv.name} 移动到了下方紧挨着的地点（${target}）。`)
  return true
}

function dropExpeditionAssetsOf(state, inv, api) {
  const ids = (inv.assets || []).filter(asset => isExpeditionAsset(asset)).map(asset => String(asset.id))
  const records = dropExpeditionAssets(state, inv, { assetIds: ids })
  if (!Array.isArray(records) || !records.length) return []
  inv.assets = (inv.assets || []).filter(asset => !ids.includes(String(asset.id)))
  state.storyAssets ||= []
  for (const record of records) state.storyAssets.push({ code: record.code, originalCode: record.code, location: record.location })
  api?.info?.(`🎒 ${inv.name} 失去对探险支援的控制，支援留在原地。`)
  return records
}

function nearestElderThingMovesAndAttacks(state, inv, api) {
  const elderThings = (state.enemies || []).filter(enemy => !enemy.defeated
    && String(ALL_CARDS[codeOf(enemy)]?.traits || '').toLowerCase().includes('elder'))
  if (!elderThings.length) return false
  const target = elderThings[0]
  const dist = neighborDistance(state, target.location, inv.location)
  if (dist != null) {
    const next = (state.locations || []).find(item => item.id === inv.location)
    if (next && dist > 0) target.location = inv.location
  }
  if (target.location === inv.location) {
    inv.damage = (inv.damage || 0) + (ALL_CARDS[codeOf(target)]?.damage || 1)
    inv.horror = (inv.horror || 0) + (ALL_CARDS[codeOf(target)]?.horror || 0)
    target.engagedSeat = inv.seat
    api?.info?.(`🌠 最近的古老者向 ${inv.name} 移动并攻击。`)
  }
  return true
}

function neighborDistance(state, fromId, toId) {
  if (!fromId || !toId) return null
  const from = (state.locations || []).find(item => item.id === fromId)
  if (!from) return null
  if (fromId === toId) return 0
  return (from.connections || []).includes(toId) ? 1 : 2
}

export { RAW_CODES, START_LOCATION, SUMMIT, SET_ASIDE_LOCATIONS, EXPEDITION_ASSETS, SET_ASIDE_CODES }
export const enemyCodes = enemyCodesFor


// ---------------------------------------------------------------------------
// 逐卡 treacheryRule.resolveKind 的结算实现（behavior 只按 kind 分派，不再按卡号分支）。
// 检定失败分支统一走 api.test 的 resolve 回调；测试/引擎都提供同一形参的 api。
// ---------------------------------------------------------------------------

export const TREACHERY_HANDLERS = Object.freeze({
  // 08610 降雪：在你所在地点放置 2 个线索（从供应堆拿取）。
  snowfall(state, inv, card, api) {
    const location = locationOf(state, inv)
    if (!location) return false
    location.clues = (location.clues || 0) + 2
    api?.info?.('❄️ 降雪：在你所在地点放置 2 个线索。')
    return true
  },

  // 08611 雪崩：高度 1–4 时先移到下方，再检定意志（X=新高度）；失败重复；没移动则涌动。
  avalanche(state, inv, card, api) {
    let moved = false
    const step = () => {
      const level = levelOf(state, inv.location)
      if (!(level >= 1 && level <= 4)) return
      if (moveBelow(state, inv, api)) moved = true
      const difficulty = levelOf(state, inv.location)
      // 场景 runtime 的 api.test 签名：(seat, skill, difficulty, resolve, skillBonus?, source?, options?)
      // 第 4 参必须是函数（src/engine/scenario-runtime.js:657）；写成 {source, resolve} 对象会抛
      // 「options.resolve is not a function」（verifier 真实 drawEncounter 复现）。
      api?.test?.(inv.seat, 'willpower', difficulty, result => { if (!result?.success) step() }, 0,
        { code: '08611', name: '雪崩', action: 'revelation' })
    }
    step()
    if (!moved) {
      if (api?.surge) api.surge(card)
      else (state.scenarioFlags ||= {}).avalancheSurge = true
    }
    return true
  },

  // 08612 悬于边缘：敏捷(3)；失败 2 伤害 + 失去所有探险支援 + 移到下方。
  hangingOnTheEdge(state, inv, card, api) {
    api?.test?.(inv.seat, 'agility', 3, result => {
      if (result?.success) return
      inv.damage = (inv.damage || 0) + 2
      dropExpeditionAssetsOf(state, inv, api)
      moveBelow(state, inv, api)
      api?.info?.('❄️ 悬于边缘：受到 2 点伤害，失去探险支援并移动到下方。')
    }, 0, { code: '08612', name: '悬于边缘', action: 'revelation' })
    return true
  },

  // 08613 低温症：意志(3)；高度 4–5 额外揭示 1 枚（近似：难度 +2）；失败加 frost 或按差值受恐惧。
  hypothermia(state, inv, card, api) {
    const level = levelOf(state, inv.location)
    const difficulty = 3 + (level >= 4 ? 2 : 0)
    api?.test?.(inv.seat, 'willpower', difficulty, result => {
      if (result?.success) return
      const failedBy = Math.max(0, Number(result?.difficulty ?? difficulty) - Number(result?.value ?? 0))
      const answer = api?.choice?.({
        kind: 'effect', source: '08613', seat: inv.seat,
        prompt: '低温症：在混乱袋加入 1 个 [frost] 标记，或受到等同于失败差值的恐惧？',
        options: [{ id: 'frost', label: '加入 1 个 [frost] 标记' }, { id: 'horror', label: `受到 ${failedBy} 点恐惧` }],
      })
      if (answer === 'horror') {
        inv.horror = (inv.horror || 0) + failedBy
        api?.info?.(`❄️ 低温症：${inv.name} 受到 ${failedBy} 点恐惧。`)
      } else {
        state.chaosBag ||= []
        state.chaosBag.push('frost')
        api?.addChaosToken?.('frost')
        api?.info?.('❄️ 低温症：混乱袋加入 1 个 [frost] 标记。')
      }
    }, 0, { code: '08613', name: '低温症', action: 'revelation' })
    return true
  },
})
