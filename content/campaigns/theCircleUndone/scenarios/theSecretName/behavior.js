// 隐秘之名（05120）· 引擎钩子（章节流程；逐卡规则在单卡条目的 actRule/agendaRule/
// locationRule/enemyRule/treacheryRule 里，behavior 只做分派与跨卡流程）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, locationRuleFor, threatActionFor, threatActionByRule,
} from '../../../../../src/cards/card-rules.js'
import { recordMemento } from '../../../../../src/campaign/mementos.js'
import { symbolConnections } from '../../card-data.js'
import { encounterRules, activeInvestigators, original, here, recordsFor, discardThreatCard, discardEncounterTop, watchEncounterDeckEmpty } from '../../encounter-rules.js'
import { addChaosToken } from '../../tcu-chaos.js'
import {
  BROWN_JENKIN, KEZIAHS_ROOM, MOLDY_HALLS, NAHAB, SITE_OF_THE_SACRIFICE, STRANGE_GEOMETRY,
  SWARM_OF_RATS, THE_BLACK_BOOK, UNKNOWN_PLACES, WALTER_GILMANS_ROOM,
} from './definition.js'
import {
  SECRET_NAME_TOKEN_MEANINGS, secretNameChaosAfterTest, secretNameChaosToken,
} from './chaos.js'

const WITCH_HOUSE = 'Witch House'
const codeOf = card => original(card) || (typeof card === 'string' ? card : null)
const MOLDY_HALLS_ID = 'moldyHalls'
const WALTER_GILMANS_ROOM_ID = 'walterGilmansRoom'
const isWeakness = code => ['weakness', 'basicweakness'].includes(ALL_CARDS[code]?.subtype)

function takeFromSetAside(state, code) {
  const list = state.scenarioZones?.setAside || []
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
  return index >= 0
}

// 参考实现的 findEncounterCard 只搜「遭遇牌库 + 遭遇弃牌堆」（默认 FromEncounterDeck/Discard），
// 找不到时整段无效果——绝不凭空生成新副本。
// 从遭遇牌库中段取牌也可能把牌库取空：用共享 watchEncounterDeckEmpty 在改动后补通知（05091/05098）。
function findInEncounter(state, predicate, api = null) {
  const discardIndex = (state.encounterDiscard || []).findIndex(predicate)
  if (discardIndex >= 0) return state.encounterDiscard.splice(discardIndex, 1)[0]
  const deckIndex = [...(state.encounterDeck || [])].reverse().findIndex(predicate)
  if (deckIndex >= 0) {
    const watch = watchEncounterDeckEmpty(state)
    const realIndex = state.encounterDeck.length - 1 - deckIndex
    const found = state.encounterDeck.splice(realIndex, 1)[0]
    if (api) watch(api)
    return found
  }
  return null
}

// 「找出某张卡（即使不在场）」：场外区域（set aside/弃牌堆/牌库）。参考 findUniqueCard。
function findAnywhere(state, code, api = null) {
  const wanted = String(code)
  if (takeFromSetAside(state, wanted)) return wanted
  return findInEncounter(state, candidate => String(candidate) === wanted, api)
}

const inPlay = (state, code) => state.enemies.find(enemy => String(codeOf(enemy)) === code) || null
const locationByCode = (state, code) => state.locations.find(location => String(codeOf(location)) === code) || null
const locationIdByCode = (state, code) => locationByCode(state, code)?.id || null

function hasTrait(card, trait) {
  const wanted = String(trait).toLowerCase()
  const traits = [...(ALL_CARDS[codeOf(card)]?.traits || []), ...(card?.traits || [])]
  return traits.some(value => String(value).toLowerCase() === wanted)
}

function spawnAt(state, code, locationId, api) {
  if (!locationId) return null
  takeFromSetAside(state, code)
  return api.spawn?.(code, locationId) || null
}

function revealUnknownFromDeck(state, api) {
  const id = api.cosmos?.({ id: 'unknownPlaces', draw: 1 })?.[0] || null
  if (!id) return null
  api.place?.(id)
  api.info?.(`🌫️ 未知地点牌库顶的「${api.locName?.(id) || id}」以未揭示面放置入场。`)
  return id
}

// 结局里「任意一位调查员可以选择把黑书加入牌库」。
function chooseBlackBook(state, api) {
  const candidates = state.investigators.filter(inv => !inv.defeated && !inv.resigned)
  if (!candidates.length) return null
  const lead = state.campaign?.leadSeat ?? 0
  const options = [
    { id: 'doNotAddTheBlackBook', label: '不加入黑书剧情支援' },
    ...candidates.map(inv => ({ id: `seat:${inv.seat}`, label: `${inv.name} 把黑书加入牌组（混乱袋 +1 骷髅）` })),
  ]
  const answer = api.choose?.({
    kind: 'story', source: '05120-resolution', seat: lead,
    prompt: '是否让一位调查员把「黑书」剧情支援加入牌库？', options,
  })
  const match = /^seat:(\d+)$/.exec(String(answer || ''))
  if (!match) return null
  const seat = Number(match[1])
  const inv = state.investigators[seat]
  if (!inv) return null
  api.campaignCard?.(THE_BLACK_BOOK, seat, '隐秘之名结局')
  addChaosToken(state, 'skull', 1)
  state.scenarioFlags ||= {}
  state.scenarioFlags.blackBookSeat = seat
  api.info?.(`📖 ${inv.name} 把「黑书」加入战役牌组，混乱袋加入 1 个骷髅标记。`)
  return seat
}

export const scenarioApproximations = Object.freeze([
  '「未知地点」的未揭示面：引擎只认识 unrevealedActualName/hiddenIdentity；本章 locationRevealed 里应用 definition 的 unrevealed 数据（名称/副标题/traits/符号）并按符号重算连线，等价于翻面。',
  '未知地点牌库：buildScenarioLocationDeck 只负责洗牌；本章按参考实现 splitAt 3 自行拼 state.extraLocationDecks.unknownPlaces 的上下 3/4 张（仍是原语的纯 JSON 堆结构，可存档）。',
  '黑书加入战役牌组：用 api.campaignCard（P2.10 原语）；「混乱袋 +1 骷髅」按卡面永久化，P8 只验证本局袋（P9 再接战役袋持久化）。',
  '05123 背面「密谋 4a 入场时放 4 毁灭」：用 state.scenarioFlags.pendingAgendaDoom + behavior.agendaChain 在 05124 成为当前议程的同一结算里放（对照参考实现 advanceAgendaDeck 后 placeDoomOnAgenda 4），没有「4a 入场」独立窗口。',
  '05121/05122/05126 的「找出」按参考实现的 findEncounterCard（遭遇牌库+弃牌堆）或 findUniqueCard（场外任意区域）实现；找不到时整段无效果（不凭空生成）。',
  'Rats（01159，核心包 rats 组）由本章写单卡条目（只声明 implemented，猎手关键词由 definition 印刷数据解析）。',
  '05129/05133 的闹鬼 script 子句由 behavior.hauntedScript 实现；05133 的「成功调查」反应已可由 0 线索地点触发（behavior.investigateWithoutClues + 引擎 investigate-empty-location 读点）；05140 的「下一行动必须是调查」已由引擎 action-legality-hook 强制（behavior.actionBlocked，非调查行动被拒、调查后清标记）。',
  'Nahab 在 act3 的「被击败时不弃掉，改为治愈/横置/解除交战/本轮不重整」走正常击败流程后在 behavior.enemyDefeated 里回填（damageTaken=0、exhausted、preventReady={rounds:1}），「不能离开献祭场所」用引擎既有 enemy.immobile。',
  '布朗·詹金/那赫卜的「击败奖励线索」反应：在 behavior.enemyDefeated 里用 canSkip 选择窗询问击败者（defeatedBy），取代旧实现的「队长询问 + act3 自动发放」。',
  '05120 [elder_thing] 的「结算场上每个敌人的猎手关键词」用 api.hunterStep（引擎单步解算：Prey/等距选择/barricade）逐个敌人移动一步；与引擎敌人阶段的完整猎手流程同一解算入口。',
  '古怪图形（05142）从遭遇牌库翻出时用 drawLocation 放置两条预定义地点 id（strangeGeometry1/2，一卡两副本）；静态邻接给 moldyHalls，场景推进后该连接失效属展示层近似。',
])

// 本章单卡条目已实现的原卡号（审计 literalCardBehavior 兜底；逐卡条目是主证据）。
export const implementedEncounterCodes = [NAHAB, BROWN_JENKIN]

export const behavior = {
  ...encounterRules,
  id: 'theSecretName',
  implementedEncounterCodes,
  scenarioGaps: [],
  scenarioApproximations,
  tokenMeanings: SECRET_NAME_TOKEN_MEANINGS,

  // ---- 介绍：按战役日志分支（参考 PreScenarioSetup）----
  preScenarioSetup(state, events, api) {
    const records = recordsFor(state)
    state.scenarioFlags ||= {}
    if (records.theInvestigatorsAreMembersOfTheLodge) {
      const answer = api.choose({
        kind: 'story', source: '05120-intro', seat: state.campaign?.leadSeat ?? 0,
        prompt: '桑福德问起森林里的女巫：你要告诉他真相，还是撒谎？',
        options: [
          { id: 'tellTheLodgeOfTheWitches', label: '把森林里的女巫告诉秘社' },
          { id: 'lie', label: '回答他「没有」。（你在撒谎。）' },
        ],
      })
      if (answer === 'tellTheLodgeOfTheWitches') {
        records.theInvestigatorsToldTheLodgeAboutTheCoven = true
        addChaosToken(state, 'cultist', 1)
        api.info?.('记录「调查员将女巫集会的事情告诉秘社」，混乱袋加入 1 个邪教徒标记。')
      } else {
        records.theInvestigatorsHidTheirKnowledgeOfTheCoven = true
        api.info?.('记录「调查员隐瞒了自己知道女巫集会一事」。')
      }
      return
    }
    if (records.theInvestigatorsAreEnemiesOfTheLodge) api.info?.('你们与银暮秘社为敌：转至介绍 4。')
    else if (records.theInvestigatorsLearnedNothingOfTheLodgesSchemes) api.info?.('你们没有发现秘社的阴谋：转至介绍 5。')
    else if (records.theInvestigatorsAreNeverSeenOrHeardFromAgain) api.info?.('调查人员就此音讯全无：转至介绍 6。')
  },

  // ---- setup：6 处巫宅地点 + 未知地点牌库 + 放一边 ----
  setupLocations(state, events, helper = {}) {
    const zones = (state.scenarioZones ||= {})
    const flags = (state.scenarioFlags ||= {})
    const random = typeof helper.randomValue === 'function' ? () => helper.randomValue(state) : () => 0.5
    const shuffle = typeof helper.shuffle === 'function' ? list => helper.shuffle([...list], random) : list => [...list]
    const placed = [
      'moldyHalls', 'walterGilmansRoom',
      'landlordsQuarters', 'joeMazurewiczsRoom', 'frankElwoodsRoom',
    ]
    for (const inv of state.investigators) inv.location = 'moldyHalls'
    zones.setAside = [
      NAHAB, THE_BLACK_BOOK,
      '05144', '05144',
      '05141', '05133', STRANGE_GEOMETRY, STRANGE_GEOMETRY,
    ]
    zones.removed = []
    // 参考实现：巫宅遗址 + 3 张随机 = 洗混放牌库底；其余 3 张洗混放牌库顶。
    const pool = shuffle([...UNKNOWN_PLACES])
    const bottom = shuffle(['witchHouseRuins', ...pool.slice(0, 3)])
    const top = shuffle(pool.slice(3))
    state.extraLocationDecks ||= {}
    state.extraLocationDecks.unknownPlaces = { deck: [...bottom, ...top], discard: [] }
    Object.assign(flags, {
      unknownPlacesDeckBuilt: true,
      brownJenkinDefeated: false,
      nahabDefeated: false,
      blackBookSeat: null,
      mustInvestigateSeat: null,
      walterLockPaid: false,
    })
    return placed
  },

  setupEnemies() {
    // 那赫卜放在场外（set aside）；布朗·詹金由效果「找出」。
  },

  // ---- 幕 / 议程 ----
  actReveal(state, act, api) {
    const rule = actRuleFor(String(codeOf(act)))
    const result = rule?.onReveal ? rule.onReveal(state, act, api) : undefined
    syncNahabImmobile(state)
    return result
  },

  agendaReveal(state, agenda, api) {
    const rule = agendaRuleFor(String(codeOf(agenda)))
    const result = rule?.onReveal ? rule.onReveal(state, agenda, api) : undefined
    syncNahabImmobile(state)
    return result
  },

  // 议程推进到下一张后的钩子（引擎 act-agenda.js 在 agendaIndex++ 之后调用）。
  // 05123 背面「密谋 4a 入场时放 4 毁灭」：5 1 2 3 揭示时只留 pending 标记，等 05124 成为
  // 当前议程的同一结算里再放，对照参考实现 advanceAgendaDeck 后的 placeDoomOnAgenda 4。
  agendaChain(state, agenda, api) {
    const pending = state.scenarioFlags?.pendingAgendaDoom
    if (!pending || String(codeOf(agenda)) !== String(pending.code)) return undefined
    delete state.scenarioFlags.pendingAgendaDoom
    const amount = Math.max(0, Number(pending.amount) || 0)
    if (amount) {
      api.doomOn?.(agenda, amount)
      api.info?.(`🌑 密谋 4a 入场：在其上放置 ${amount} 个毁灭标记。`)
    }
    return undefined
  },

  // act3 目标：那赫卜上没有毁灭标记（她在场外/不在场也满足「找出她并推进」的写法差异，
  // 参考实现要求 Nahab 存在且无毁灭；这里按卡面：不在场说明尚未被放置，不推进）。
  checkObjectives(state, api) {
    syncNahabImmobile(state)
    if ((state.actIndex ?? 0) !== 2) return
    const nahab = inPlay(state, NAHAB)
    if (!nahab) return
    if ((nahab.doom || 0) > 0) return
    api.advanceAct?.()
  },

  // ---- 玩家行动：幕数据声明的团队线索推进（advanceRule）+ 地点/威胁行动 ----
  actions(state, inv) {
    syncNahabImmobile(state)
    const moves = encounterRules.actions?.(state, inv) || []
    const advance = state.acts?.[state.actIndex]?.advanceRule
    if (advance) {
      const required = advance.perInvestigator * state.numInvestigators
      const active = activeInvestigators(state)
      const payers = advance.payAtLocationId
        ? active.filter(entry => here(state, entry)?.id === advance.payAtLocationId)
        : active
      const eligible = advance.allAtLocationId
        ? active.every(entry => here(state, entry)?.id === advance.allAtLocationId)
        : payers.length > 0
      const clues = payers.reduce((sum, entry) => sum + (entry.clues || 0), 0)
      if (eligible && clues >= required) {
        moves.push({
          action: 'scenarioAction', rule: advance.rule,
          // 幕目标的团队线索推进不花行动（参考实现为 FastAbility；引擎标准 advanceAct 亦为 0 费）。
          actions: 0,
          label: advance.label.replace('{required}', String(required)),
        })
      }
    }
    const location = here(state, inv)
    if (location) locationRuleFor(String(codeOf(location)))?.actions?.({ moves, state, inv, location })
    // 威胁区「[action]：检定 X 弃掉本卡」。
    for (const threat of inv.threat || []) {
      const spec = threatActionFor(codeOf(threat))
      if (!spec) continue
      moves.push({
        action: 'encounterAction', rule: spec.rule, threatId: threat.id,
        actions: spec.actions ?? 1, label: spec.label || '处理威胁',
        ...(spec.skills ? { skill: spec.skills[0] } : {}),
      })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    const advance = state.acts?.[state.actIndex]?.advanceRule
    if (advance && advance.rule === move.rule) {
      const required = advance.perInvestigator * state.numInvestigators
      api.payClues?.(required, advance.payAtLocationId || advance.allAtLocationId)
      api.info?.(`${inv.name} 触发团队线索推进（${required} 个线索）。`)
      api.advanceAct?.()
      return
    }
    const location = here(state, inv)
    const rule = location ? locationRuleFor(String(codeOf(location))) : null
    if (rule?.performAction?.(state, inv, move, api)) return
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知隐秘之名行动：${move.rule}`)
  },

  performEncounterAction(state, inv, move, api) {
    const spec = threatActionByRule(move.rule)
    if (!spec) return false
    const threat = (inv.threat || []).find(card => String(card.id) === String(move.threatId))
    if (!threat) return false
    // 05146：所在地点有横置的女巫敌人时，本次检定自动成功。弃牌走共享的「遭遇弃牌堆」出口。
    if (move.rule === 'discardPulledByTheStars') {
      const witch = state.enemies.some(enemy => enemy.exhausted && hasTrait(enemy, 'Witch')
        && enemy.location === inv.location)
      if (witch) {
        discardThreatCard(state, inv, threat)
        api.info?.('🌟 所在地点有横置的女巫敌人：本次检定自动成功。')
        return true
      }
    }
    // 其余威胁行动（05093 崩毁离析 / 05094 苦痛折磨 / 05146 后续检定等）统一交回共享实现：
    // 横置女巫自动成功（autoSuccessWhen）与成功弃牌去向（遭遇弃牌堆）都由 encounter-rules 维护。
    return encounterRules.performEncounterAction?.(state, inv, move, api) === true
  },

  // ---- 地点：揭示面 / 调查反应 / 闹鬼 script ----
  locationRevealed(state, location, api) {
    const definition = state.scenario?.locations?.[location.id]
    const face = definition?.unrevealed
    if (!location.revealed || !face) return
    if (face.nameZh) location.name = face.nameZh
    if (face.subnameZh) location.subname = face.subnameZh
    // 特性保持印刷英文特性（chaos.js 的 [[异次元]] 判定与共享组 trait 读点都依赖英文特性名）；
    // unrevealed.traitsZh 只作兜底显示数据，不写进实例 traits。
    const printedTraits = ALL_CARDS[location.originalCode || location.code]?.traits
    if (printedTraits?.length) location.traits = [...printedTraits]
    else if (face.traitsZh) location.traits = [...face.traitsZh]
    if (face.symbol) {
      location.symbols = { front: { symbol: face.symbol, links: [...(face.links || [])],
        label: location.symbols?.front?.label } }
    }
    // 揭示后按当前所有地点（含未揭示正面的符号）重算符号连线；再并上卡面效果建立的
    // 「本场冒险持续连接」（05136 City of Elder Things 等，存 scenarioFlags.extraConnections）。
    const wanted = symbolConnections(state.locations)
    const extra = state.scenarioFlags?.extraConnections || {}
    for (const entry of state.locations) {
      if (!wanted[entry.id]) continue
      const merged = [...wanted[entry.id]]
      for (const id of extra[entry.id] || []) {
        if (!merged.includes(id) && state.locations.some(candidate => candidate.id === id)) merged.push(id)
      }
      entry.connections = merged
    }
    api.info?.(`🌫️ 「${location.name}${location.subname ? `·${location.subname}` : ''}」揭示。`)
  },

  investigateResult(state, inv, location, result, api) {
    if (!location) return undefined
    // 05140 旧日支配者皇廷闹鬼：「你本轮执行的下一个行动必须是调查行动」——
    // 调查行动一旦结算（无论成败），该限制即完成，清掉标记（引擎 actionBlocked 读点）。
    const flags = state.scenarioFlags || {}
    if (flags.mustInvestigateSeat === inv?.seat) {
      delete flags.mustInvestigateSeat
      delete flags.mustInvestigateRound
    }
    const rule = locationRuleFor(String(codeOf(location)))
    return rule?.onInvestigateSuccess?.({ state, location, inv, result, api })
  },

  // 05133 凯夏的房间：印刷线索为 0，但「成功调查的 [reaction]」要求它在线索被取空后仍可被标准调查。
  // 引擎读点：moves.js legalMoves / validateMove 的 investigate-empty-location。
  investigateWithoutClues(state, inv, location) {
    return Boolean(location) && String(codeOf(location)) === KEZIAHS_ROOM
  },

  // 05140 旧日支配者皇廷闹鬼：「你本轮执行的下一个行动必须是调查行动」。
  // 引擎读点：moves.js validateMove 的 action-legality-hook（返回字符串=拒绝理由）。
  // 快速打出（不占行动）与「确实没有可调查地点时的结束回合」放行，避免不可行动软锁。
  actionBlocked(state, inv, move) {
    const flags = state.scenarioFlags || {}
    if (flags.mustInvestigateSeat == null || flags.mustInvestigateSeat !== inv?.seat) return undefined
    if (flags.mustInvestigateRound != null && flags.mustInvestigateRound !== state.round) return undefined
    if (!move || typeof move.action !== 'string') return undefined
    if (move.action === 'investigate') return undefined
    if (move.action === 'endTurn') {
      const here = (state.locations || []).find(location => location.id === inv.location)
      const canInvestigate = here && !here.locked && (Number(here.clues) > 0
        || String(codeOf(here)) === KEZIAHS_ROOM)
      return canInvestigate ? '👑 皇廷闹鬼：你本轮的下一个行动必须是调查行动' : undefined
    }
    return '👑 皇廷闹鬼：你本轮的下一个行动必须是调查行动'
  },

  hauntedScript(state, payload, api) {
    const { scriptId, seat } = payload || {}
    if (scriptId === 'landlordsQuartersRats') {
      let code = null
      const isRats = candidate => String(candidate) === SWARM_OF_RATS
        || ALL_CARDS[candidate]?.nameEn === 'Swarm of Rats'
      const discardIndex = (state.encounterDiscard || []).findIndex(isRats)
      if (discardIndex >= 0) code = state.encounterDiscard.splice(discardIndex, 1)[0]
      else {
        const deckIndex = [...state.encounterDeck].reverse().findIndex(isRats)
        if (deckIndex >= 0) {
          // 从牌库中段找出「鼠群」可能把牌库取空：用共享钩子补「遭遇牌库耗尽」通知。
          const watch = watchEncounterDeckEmpty(state)
          const realIndex = state.encounterDeck.length - 1 - deckIndex
          code = state.encounterDeck.splice(realIndex, 1)[0]
          watch(api)
        }
      }
      const target = locationIdByCode(state, MOLDY_HALLS) || state.investigators[seat]?.location
      if (code && target) {
        api.spawn?.(code, target)
        api.shuffleEncounterDeck?.()
        api.info?.(`🐀 闹鬼：从遭遇牌库/弃牌堆找出「鼠群」，生成在「发霉的走道」。`)
      } else {
        api.info?.('🐀 闹鬼：没有找到「鼠群」。')
      }
      return true
    }
    if (scriptId === 'keziahsRoomHex') {
      // 弃牌过程中遭遇牌库可能由有到无：共享钩子在该情况下立即结算「遭遇牌库耗尽」强制。
      const watch = watchEncounterDeckEmpty(state)
      const hex = []
      while (state.encounterDeck.length) {
        const top = state.encounterDeck.pop()
        if (hasTrait(top, 'Hex')) {
          state.encounterDeck.push(top)
          api.drawEncounter?.(seat)
          watch(api)
          api.info?.(`🔮 闹鬼：弃到「${ALL_CARDS[top]?.nameZh || top}」并抽取它。`)
          return true
        }
        state.encounterDiscard.push(top)
        hex.push(top)
      }
      watch(api)
      api.info?.('🔮 闹鬼：遭遇牌库里没有巫术卡牌。')
      return true
    }
    if (scriptId === 'courtMustInvestigate') {
      state.scenarioFlags ||= {}
      state.scenarioFlags.mustInvestigateSeat = seat ?? null
      state.scenarioFlags.mustInvestigateRound = state.round
      api.info?.('👑 闹鬼：你本轮执行的下一个行动必须是调查行动。')
      return true
    }
    if (scriptId === 'walterGilmansRoomDiscard') {
      // 弃顶 2 张：牌库中途耗尽不洗回（不是「弃到某张」类效果）；耗尽时由共享钩子通知。
      discardEncounterTop?.(state, api, 2, { reshuffle: false, notifyEmpty: true })
      api.info?.('📜 闹鬼：弃掉遭遇牌库顶的 2 张卡牌。')
      return true
    }
    return false
  },

  // 古怪图形（05142）作为遭遇卡翻出：放置并移动到其上。
  drawLocation(state, seat, code, api) {
    if (String(code) !== STRANGE_GEOMETRY) return
    const id = ['strangeGeometry1', 'strangeGeometry2']
      .find(candidate => !state.locations.some(location => location.id === candidate))
    if (!id) {
      api.info?.('🧩 古怪图形没有可用的副本地点。')
      return
    }
    api.place?.(id)
    api.moveInvestigator?.(seat, id)
    api.info?.('🧩 「古怪图形」放置入场，你被拉入其中。')
  },

  // ---- 敌人 ----
  // 章节级：所有非弱点敌人的生命 + 当前密谋编号。
  // 单卡的战斗修正（05149 那赫卜 + 密谋编号、05148 布朗·詹金的生物光环）已迁到条目的 enemyStatRule。
  enemyStatModifier(state, enemy, stat) {
    const base = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    if (stat === 'health' && !ALL_CARDS[codeOf(enemy)]?.subtype) {
      return base + (state.agendaIndex ?? 0) + 1
    }
    return base
  },

  // 敌军阶段开始/结束的逐卡强制在条目的 enemyScript.onEnemyPhaseStart / onEnemyPhaseEnd，
  // 共享 encounterRules 已统一派发；章节只保留转发。
  enemyPhaseStart(state, api) {
    encounterRules.enemyPhaseStart?.(state, api)
  },

  enemyPhaseEnd(state, api) {
    encounterRules.enemyPhaseEnd?.(state, api)
  },

  // 敌人入场：act3 起把「那赫卜不能离开献祭场所」同步成引擎既有 immobile（所有移动来源统一拦截）。
  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    syncNahabImmobile(state)
  },

  // act3：那赫卜被击败时不弃掉（参考 insteadOfDiscarding：治愈全部伤害/解除交战/横置/本轮不重整）。
  // 允许正常击败流程（这样 enemyDefeated/议程反应都会触发），在 enemyDefeated 里回填敌人。
  enemyCanBeDefeated(state, enemy, source, seat) {
    if (encounterRules.enemyCanBeDefeated?.(state, enemy, source, seat) === false) return false
    return true
  },

  enemyDefeated(state, enemy, api) {
    encounterRules.enemyDefeated?.(state, enemy, api)
    const code = String(codeOf(enemy))
    syncNahabImmobile(state)
    // act3 那赫卜：不弃掉，改为治愈/横置/解除交战/本轮补给阶段不重整（preventReady 引擎读点）。
    if (code === NAHAB && (state.actIndex ?? 0) === 2) {
      enemy.damageTaken = 0
      enemy.exhausted = true
      enemy.preventReady = { from: state.round, rounds: 1 }
      enemy.immobile = true
      for (const inv of state.investigators || []) {
        if (Array.isArray(inv.engaged)) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
      }
      enemy.engagedSeat = null
      if (!state.enemies.includes(enemy)) state.enemies.push(enemy)
      offerAgendaDefeatClue(state, enemy, api)
      api?.info?.(`⛓️ 「${enemy.name}」被击败：不弃掉，改为治愈全部伤害、解除交战并横置（本轮不重整）。`)
      return true
    }
    offerAgendaDefeatClue(state, enemy, api)
    return false
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    // 05140 皇廷闹鬼的「下一个行动必须是调查」只在本轮内有效；回合结束即失效。
    const flags = state.scenarioFlags || {}
    if (flags.mustInvestigateSeat === inv?.seat) {
      delete flags.mustInvestigateSeat
      delete flags.mustInvestigateRound
    }
    syncNahabImmobile(state)
    // 威胁区卡的回合结束强制在条目的 treacheryRule.turnEnd（05146/05147），
    // 由共享 encounterRules.turnEnded 统一解释；本章只负责重置「本回合移动」标记。
    inv.tcuMovedThisTurn = false
  },

  // 「本回合」移动计数：只统计该调查员自己回合内的移动（神话阶段/别人回合的效果位移不算，
  // 对照参考实现 InvestigatorThatMovedDuringTurn）。
  locationEntered(state, inv) {
    if (!inv || state.phase !== 'investigation' || state.currentSeat !== inv.seat) return
    inv.tcuMovedThisTurn = true
  },

  // ---- 移动：沃尔特·吉尔曼房间的团队线索入场费（锁定） ----
  beforeMove(state, inv, destLocation, api) {
    if (destLocation?.id !== WALTER_GILMANS_ROOM_ID) return
    if (inv.location !== MOLDY_HALLS_ID) return
    const cost = state.numInvestigators
    const payers = activeInvestigators(state).filter(entry => entry.location === MOLDY_HALLS_ID)
    const available = payers.reduce((sum, entry) => sum + (entry.clues || 0), 0)
    if (available < cost) return
    api.payClues?.(cost, MOLDY_HALLS_ID)
    state.scenarioFlags ||= {}
    state.scenarioFlags.walterLockPaid = true
    api.info?.(`🔒 调查员们共同花费 ${cost} 个线索打开沃尔特·吉尔曼房间的锁。`)
  },

  investigatorEntryError(state, location, inv) {
    if (location?.id !== WALTER_GILMANS_ROOM_ID) return undefined
    if (inv.location !== MOLDY_HALLS_ID) return undefined
    const cost = state.numInvestigators
    const available = activeInvestigators(state).filter(entry => entry.location === MOLDY_HALLS_ID)
      .reduce((sum, entry) => sum + (entry.clues || 0), 0)
    if (available < cost) return `「沃尔特·吉尔曼的房间」锁着：发霉的走道上的调查员需共同花费 ${cost} 个线索。`
    return undefined
  },

  // ---- 调查阶段结束：古怪图形的强制（参考 PhaseEnds #after #investigation，即敌人阶段开始）----
  phaseBegan(state, phase, api) {
    encounterRules.phaseBegan?.(state, phase, api)
    syncNahabImmobile(state)
    if (phase !== 'enemy') return
    const geometries = state.locations.filter(location => String(codeOf(location)) === STRANGE_GEOMETRY)
    for (const geometry of geometries) {
      const occupants = activeInvestigators(state).filter(inv => inv.location === geometry.id)
      // 参考只移动「未交战」的敌人（UnengagedEnemy）。
      const enemies = state.enemies.filter(enemy => enemy.location === geometry.id && enemy.engagedSeat == null)
      const candidates = state.locations
        .filter(location => location.id !== geometry.id && (location.clues || 0) > 0)
        .sort((left, right) => (right.clues || 0) - (left.clues || 0)
          || String(codeOf(left)).localeCompare(String(codeOf(right))))
      let target = null
      if (candidates.length) {
        const most = candidates[0].clues
        const tied = candidates.filter(location => location.clues === most)
        if (tied.length === 1) target = tied[0]
        else {
          const picked = api?.choose?.({
            kind: 'location', source: STRANGE_GEOMETRY, seat: state.campaign?.leadSeat ?? 0,
            prompt: '古怪图形崩塌：选择线索最多的地点（并列，由主持选择）。',
            options: tied.map(location => ({ id: location.id, label: location.name })),
          })
          target = tied.find(location => location.id === picked) || tied[0]
        }
      }
      api.remove?.(geometry.id)
      state.encounterDiscard = [...(state.encounterDiscard || []), STRANGE_GEOMETRY]
      if (!target) {
        api.info?.('🧩 古怪图形崩塌：场上没有带线索的其他地点，无人被抛走。')
        continue
      }
      for (const inv of occupants) {
        api.moveInvestigator?.(inv.seat, target.id)
        api.damage?.(inv.seat, 1)
        api.horror?.(inv.seat, 1)
      }
      for (const enemy of enemies) api.moveEnemy?.(enemy, target.id)
      api.info?.(`🧩 古怪图形崩塌：所有人被抛向「${target.name}」，各受 1 点伤害和 1 点恐惧。`)
    }
  },

  // ---- 混乱标记 ----
  resolveChaosToken(state, inv, token, api) {
    return secretNameChaosToken(state, inv, token, api)
  },

  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    secretNameChaosAfterTest(state, inv, result, api)
  },

  // ---- 结局 / 记录 ----
  resolution(state, key, events, api) {
    return applyResolution(state, key, events, api)
  },
}

function apiFor(state) { return { info: () => {} } }

const AGENDA_DEFEAT_REACTION_CODES = new Set(['05121', '05122', '05123', '05124'])

// 议程正面反应（05121-05124 同一条）：击败布朗·詹金/那赫卜后，由「击败者」选择是否获得
// 1 个线索（≥3 人改为 2 个）。参考 TheHermitIX.hs 的 freeReaction「You」。
function offerAgendaDefeatClue(state, enemy, api) {
  const code = String(codeOf(enemy))
  if (code !== BROWN_JENKIN && code !== NAHAB) return
  const agendaCode = String(codeOf((state.agendas || [])[state.agendaIndex]))
  if (!AGENDA_DEFEAT_REACTION_CODES.has(agendaCode)) return
  const seat = enemy.defeatedBy ?? enemy.engagedSeat ?? null
  let answer = 'use'
  if (typeof api?.choose === 'function') {
    answer = api.choose({
      kind: 'reaction', source: agendaCode, seat: seat ?? state.campaign?.leadSeat ?? 0, canSkip: true,
      prompt: `「${enemy.name}」被你击败：是否发动反应，从供应堆获得线索？`,
      options: [{ id: 'use', label: '发动：获得线索' }, { id: 'skip', label: '不发动' }],
    })
  }
  if (answer !== 'skip') grantAgendaClue(state, seat, api)
}

// act3 起那赫卜不能离开献祭场所：参考实现给 Nahab 的 CannotMove 修饰语，引擎既有 enemy.immobile
// 在 relocateEnemy（所有移动来源）与猎手移动前统一拦截。
function syncNahabImmobile(state) {
  const nahab = inPlay(state, NAHAB)
  if (!nahab) return
  nahab.immobile = (state.actIndex ?? 0) === 2
}

// 议程正面反应：击败布朗·詹金/那赫卜后获得 1 线索（≥3 人改为 2）。
// 纯数据写入（enemyCanBeDefeated 没有 api 参数），线索总额同步到 state.clues。
function grantAgendaClue(state, seat, api) {
  if (seat == null) return
  const inv = state.investigators[seat]
  if (!inv || inv.defeated || inv.resigned) return
  const amount = state.numInvestigators >= 3 ? 2 : 1
  inv.clues = (inv.clues || 0) + amount
  state.clues = (state.investigators || []).reduce((sum, entry) => sum + (entry.clues || 0), 0)
  api?.info?.(`🔎 ${inv.name} 击败了女巫的魔宠/那赫卜：从供应堆获得 ${amount} 个线索。`)
}

const RESOLUTIONS = new Set(['noResolution', 'resolution1', 'resolution2'])

function applyResolution(state, key, events, api) {
  if (!RESOLUTIONS.has(key)) throw new Error(`未知隐秘之名结局：${key}`)
  const step = (state.actIndex ?? 0) + 1
  const flags = (state.scenarioFlags ||= {})
  if (key === 'noResolution') return applyResolution(state, 'resolution1', events, api)
  const brownBonus = flags.brownJenkinDefeated ? 1 : 0
  const nahabBonus = flags.nahabDefeated ? 1 : 0
  if (key === 'resolution1') {
    if (step >= 2) recordMemento(state, 'gilmensJournal')
    if (step === 3) recordMemento(state, 'keziahsFormulae')
    if (step >= 2) chooseBlackBook(state, api || apiFor(state))
    return { award: true, bonus: brownBonus + nahabBonus }
  }
  recordMemento(state, 'gilmensJournal')
  recordMemento(state, 'keziahsFormulae')
  recordMemento(state, 'wornCrucifix')
  chooseBlackBook(state, api || apiFor(state))
  return { award: true, bonus: 2 }
}
