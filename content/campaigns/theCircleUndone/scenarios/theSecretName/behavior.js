// 隐秘之名（05120）· 引擎钩子（章节流程；逐卡规则在单卡条目的 actRule/agendaRule/
// locationRule/enemyRule/treacheryRule 里，behavior 只做分派与跨卡流程）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, locationRuleFor, threatActionFor, threatActionByRule,
} from '../../../../../src/cards/card-rules.js'
import { recordMemento } from '../../../../../src/campaign/mementos.js'
import { symbolConnections } from '../../card-data.js'
import { encounterRules, activeInvestigators, original, here, recordsFor, discardThreatCard } from '../../encounter-rules.js'
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
  '黑书（05150）的 [reaction] 打牌减费：被动 +1 意志/+1 智识已接线，减费需要费用支付窗口的反应修饰，P8 未接线（P9 交互窗口）；卡面其余语义（入牌组、+1 骷髅）已实现。',
  '05123 背面「密谋 4a 入场时放 4 毁灭」：引擎的密谋揭示只触发一次背面，没有「4a 入场」窗口；本章在 05123 揭示时直接把 4 毁灭放到下一张密谋（05124）实例上，数字与卡面一致。',
  '05121/05122 背面「查找遭遇牌库/弃牌堆/收藏找敌人」：直接操作 state.encounterDeck/encounterDiscard/场外定义（纯数据），再用 api.spawn 生成；找不到时按卡面「找出」= 从 set aside 生成。',
  'Rats（01159，核心包 rats 组）由本章写单卡条目（只声明 implemented，猎手关键词由 definition 印刷数据解析）。',
  '05129/05133 的闹鬼 script 子句由 behavior.hauntedScript 实现；05140 的「下一行动必须是调查」引擎无行动限制读点，近似为 scenarioFlags.mustInvestigateSeat 提示（不阻止其他行动）。',
  'Nahab 在 act3 的「被击败时不弃掉，改为治愈/横置/本轮不重整」用 enemyCanBeDefeated=false 表达（保留在场上、伤害清零），并手动给击败者议程奖励线索。',
  '布朗·詹金/那赫卜的「击败奖励线索」反应由 behavior.enemyDefeated 手动结算（引擎的 enemyDefeated 已经在击退流程末端，无法作为反应窗口）。',
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
      NAHAB, BROWN_JENKIN, THE_BLACK_BOOK,
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
    if (rule?.onReveal) return rule.onReveal(state, act, api)
    return undefined
  },

  agendaReveal(state, agenda, api) {
    const rule = agendaRuleFor(String(codeOf(agenda)))
    if (rule?.onReveal) return rule.onReveal(state, agenda, api)
    return undefined
  },

  // act3 目标：那赫卜上没有毁灭标记（她在场外/不在场也满足「找出她并推进」的写法差异，
  // 参考实现要求 Nahab 存在且无毁灭；这里按卡面：不在场说明尚未被放置，不推进）。
  checkObjectives(state, api) {
    if ((state.actIndex ?? 0) !== 2) return
    const nahab = inPlay(state, NAHAB)
    if (!nahab) return
    if ((nahab.doom || 0) > 0) return
    api.advanceAct?.()
  },

  // act3 背面：「那赫卜不能离开献祭场所」——覆写猎手移动，使其原地不动。
  hunterMove(state, enemy, api) {
    if (encounterRules.hunterMove?.(state, enemy, api)) return true
    if ((state.actIndex ?? 0) === 2 && String(codeOf(enemy)) === NAHAB) {
      api?.info?.(`⛓️ 「${enemy.name}」不能离开献祭场所。`)
      return true
    }
    return false
  },

  // ---- 玩家行动：幕数据声明的团队线索推进（advanceRule）+ 地点/威胁行动 ----
  actions(state, inv) {
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
    if (face.traitsZh) location.traits = [...face.traitsZh]
    if (face.symbol) {
      location.symbols = { front: { symbol: face.symbol, links: [...(face.links || [])],
        label: location.symbols?.front?.label } }
    }
    // 揭示后按当前所有地点（含未揭示正面的符号）重算符号连线。
    const wanted = symbolConnections(state.locations)
    for (const entry of state.locations) {
      if (wanted[entry.id]) entry.connections = [...wanted[entry.id]]
    }
    api.info?.(`🌫️ 「${location.name}${location.subname ? `·${location.subname}` : ''}」揭示。`)
  },

  investigateResult(state, inv, location, result, api) {
    if (!location) return undefined
    const rule = locationRuleFor(String(codeOf(location)))
    return rule?.onInvestigateSuccess?.({ state, location, inv, result, api })
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
          const realIndex = state.encounterDeck.length - 1 - deckIndex
          code = state.encounterDeck.splice(realIndex, 1)[0]
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
      const hex = []
      while (state.encounterDeck.length) {
        const top = state.encounterDeck.pop()
        if (hasTrait(top, 'Hex')) {
          state.encounterDeck.push(top)
          api.drawEncounter?.(seat)
          api.info?.(`🔮 闹鬼：弃到「${ALL_CARDS[top]?.nameZh || top}」并抽取它。`)
          return true
        }
        state.encounterDiscard.push(top)
        hex.push(top)
      }
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
      for (let index = 0; index < 2 && state.encounterDeck.length; index++) {
        state.encounterDiscard.push(state.encounterDeck.pop())
      }
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
  enemyStatModifier(state, enemy, stat) {
    const base = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    const agendaNumber = (state.agendaIndex ?? 0) + 1
    if (stat === 'health') {
      if (ALL_CARDS[codeOf(enemy)]?.subtype) return base
      return base + agendaNumber
    }
    if (stat === 'fight') {
      if (String(codeOf(enemy)) === NAHAB) return base + agendaNumber
      if (inPlay(state, BROWN_JENKIN) && hasTrait(enemy, 'Creature') && !enemy.exhausted) return base + 2
    }
    return base
  },

  enemyPhaseStart(state, api) {
    encounterRules.enemyPhaseStart?.(state, api)
    const nahab = inPlay(state, NAHAB)
    if (nahab && !nahab.exhausted) {
      api.doomOn?.(nahab, 1)
      api.info?.('🌑 那赫卜处于重整状态：在其上放置 1 个毁灭标记。')
    }
  },

  enemyPhaseEnd(state, api) {
    encounterRules.enemyPhaseEnd?.(state, api)
    const jenkin = inPlay(state, BROWN_JENKIN)
    if (!jenkin || jenkin.exhausted) return
    for (const inv of activeInvestigators(state).filter(entry => entry.location === jenkin.location)) {
      const count = (inv.hand || []).length
      if (!count) continue
      api.discardRandom?.(inv.seat, count)
      api.drawCards?.(inv.seat, count)
      api.info?.(`🐀 布朗·詹金：${inv.name} 弃掉全部 ${count} 张手牌后抽取等量卡牌。`)
    }
  },

  // act3：那赫卜被击败时不弃掉，改为治愈全部伤害/解除交战/横置/本轮不重整。
  enemyCanBeDefeated(state, enemy, source, seat) {
    if (encounterRules.enemyCanBeDefeated?.(state, enemy, source, seat) === false) return false
    if (String(codeOf(enemy)) !== NAHAB || (state.actIndex ?? 0) !== 2) return true
    enemy.damageTaken = 0
    enemy.exhausted = true
    if (enemy.engagedSeat != null) {
      const inv = state.investigators[enemy.engagedSeat]
      if (inv) inv.engaged = (inv.engaged || []).filter(id => id !== enemy.id)
    }
    enemy.engagedSeat = null
    enemy.doesNotReadyRound = state.round
    state.scenarioFlags ||= {}
    state.scenarioFlags.nahabDefeated = true
    grantAgendaClue(state, seat ?? enemy.defeatedBy, null)
    return false
  },

  enemyDefeated(state, enemy, api) {
    encounterRules.enemyDefeated?.(state, enemy, api)
    const code = String(codeOf(enemy))
    state.scenarioFlags ||= {}
    if (code === BROWN_JENKIN) state.scenarioFlags.brownJenkinDefeated = true
    if (code === NAHAB) state.scenarioFlags.nahabDefeated = true
    if (code === BROWN_JENKIN || code === NAHAB) {
      // 05121/05122/05124 的 [reaction]：击败后获得线索，可以发动或放弃。
      const answer = api?.choose?.({
        kind: 'reaction', source: code, seat: state.campaign?.leadSeat ?? 0, canSkip: true,
        prompt: `「${enemy.name}」被击败：是否发动反应，发现 1 个线索？`,
        options: [{ id: 'use', label: '发动：发现 1 个线索' }, { id: 'skip', label: '不发动' }],
      })
      if (answer !== 'skip') grantAgendaClue(state, enemy.defeatedBy, api)
    }
    return false
  },

  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 布朗·詹金/那赫卜的「本轮补给阶段不重整」用实例标记表达。
    for (const enemy of state.enemies) {
      if (enemy.doesNotReadyRound === state.round) enemy.exhausted = true
    }
  },

  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    const threats = inv.threat || []
    for (const threat of [...threats]) {
      const code = String(codeOf(threat))
      // 回合结束强制的规则 id 由 definition.threatTurnEnd 声明（不按卡号写分支）。
      const kind = state.scenario?.threatTurnEnd?.[code]
      if (!kind) continue
      // 群星牵引：本回合未移动过 → 受到 2 点恐惧。
      if (kind === 'pulledByTheStars' && !inv.tcuMovedThisTurn) {
        api.horror?.(inv.seat, 2)
        api.info?.(`🌌 群星牵引：${inv.name} 本回合未移动过，受到 2 点恐惧。`)
      }
      // 不安的梦：回合结束弃遭遇牌库顶 1 张。
      if (kind === 'disquietingDreams') {
        if (state.encounterDeck.length) {
          state.encounterDiscard.push(state.encounterDeck.pop())
          api.info?.('😴 不安的梦：弃掉遭遇牌库顶 1 张卡牌。')
        }
        // 遭遇牌库耗尽：弃掉本卡并揭示牌库顶 10 张，抽取其中的弱点。
        if (state.encounterDeck.length === 0) {
          const index = inv.threat.indexOf(threat)
          if (index >= 0) {
            inv.threat.splice(index, 1)
            inv.discard.push(code)
          }
          const revealed = []
          for (let count = 0; count < 10 && inv.deck.length; count++) revealed.push(inv.deck.pop())
          const weaknesses = []
          for (const card of revealed) {
            if (isWeakness(card)) weaknesses.push(card)
            else inv.discard.push(card)
          }
          for (const card of weaknesses) inv.hand.push(card)
          api.info?.(`😴 不安的梦：遭遇牌库耗尽，${inv.name} 揭示牌库顶 ${revealed.length} 张，抽到 ${weaknesses.length} 张弱点。`)
        }
      }
    }
    inv.tcuMovedThisTurn = false
  },

  locationEntered(state, inv) {
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

  // ---- 调查阶段结束：古怪图形的强制 ----
  phaseBegan(state, phase, api) {
    encounterRules.phaseBegan?.(state, phase, api)
    if (phase !== 'mythos') return
    const geometries = state.locations.filter(location => String(codeOf(location)) === STRANGE_GEOMETRY)
    for (const geometry of geometries) {
      const occupants = activeInvestigators(state).filter(inv => inv.location === geometry.id)
      const enemies = state.enemies.filter(enemy => enemy.location === geometry.id)
      const candidates = state.locations
        .filter(location => location.id !== geometry.id && (location.clues || 0) > 0)
        .sort((left, right) => (right.clues || 0) - (left.clues || 0)
          || String(codeOf(left)).localeCompare(String(codeOf(right))))
      const target = candidates[0]
      api.remove?.(geometry.id)
      if (!target) continue
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
