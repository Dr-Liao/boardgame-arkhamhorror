// 巫异时刻（05050）· 引擎钩子（只放章节流程；逐卡规则在各单卡条目的 actRule/agendaRule/
// locationRule/enemyRule 里，behavior 只负责分派与章节级流程）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import {
  actRuleFor, agendaRuleFor, locationRuleFor, enemyRuleFor, treacheryRuleFor,
} from '../../../../../src/cards/card-rules.js'
import { recordMemento } from '../../../../../src/campaign/mementos.js'
import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { encounterRules, activeInvestigators, original, here, recordsFor } from '../../encounter-rules.js'
import { addChaosToken } from '../../tcu-chaos.js'
import { WITCHING_HOUR_DIVINATION } from '../../tarot.js'
import {
  ANETTE_MASON, ARKHAM_WOODS, DAEMONIC_PIPING, GOAT_SPAWN, PIPER_OF_AZATHOTH,
  RELENTLESS_DARK_YOUNG, WITCHES_CIRCLE, WOODS,
} from './definition.js'
import {
  WITCHING_HOUR_TOKEN_MEANINGS, witchingHourChaosAfterTest, witchingHourChaosToken,
} from './chaos.js'

// 队长介绍 2 的两张战役卡（不计入牌组张数）。
export const CAMPAIGN_CARDS = Object.freeze({ towerXVI: '05042', aceOfRods: '05040' })
const WOOD_CODES = new Set(WOODS.map(entry => entry.code))
const ARKHAM_CODE_BY_ID = Object.fromEntries(ARKHAM_WOODS.map(entry => [entry.id, entry.code]))
const ARKHAM_ID_BY_CODE = Object.fromEntries(ARKHAM_WOODS.map(entry => [entry.code, entry.id]))
const SET_ASIDE_ENEMY_CODES = [ANETTE_MASON, PIPER_OF_AZATHOTH, RELENTLESS_DARK_YOUNG, GOAT_SPAWN]

const codeOf = card => original(card)
const isWitch = card => (ALL_CARDS[codeOf(card)]?.traits || card?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'witch')

function takeFromSetAside(state, code) {
  const list = state.scenarioZones?.setAside || []
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
}

function isWoodsCode(code) {
  return WOOD_CODES.has(code)
}

function woodsInPlay(state) {
  return state.locations.filter(location => isWoodsCode(codeOf(location)))
}

// 「面前的地点」：setup 时把 5 张森林按玩家顺序轮流分配给座位。
export function dealFrontLocations(state, helper = {}) {
  const random = typeof helper.randomValue === 'function' ? () => helper.randomValue(state) : () => 0.5
  const shuffle = typeof helper.shuffle === 'function'
    ? list => helper.shuffle([...list], random)
    : list => [...list]
  const all = shuffle(WOODS.map(entry => entry.id))
  const placed = all.slice(0, 5)
  const removed = all.slice(5)
  const seats = state.investigators.map(inv => inv.seat)
  const flags = (state.scenarioFlags ||= {})
  flags.frontOf = {}
  const frontsBySeat = new Map(seats.map(seat => [seat, []]))
  placed.forEach((id, index) => {
    const seat = seats[index % seats.length]
    flags.frontOf[id] = seat
    frontsBySeat.get(seat).push(id)
  })
  // 每位调查员从自己面前的地点里随机选一处开始。
  for (const inv of state.investigators) {
    const fronts = frontsBySeat.get(inv.seat) || []
    if (!fronts.length) continue
    inv.location = fronts[Math.min(fronts.length - 1, Math.floor(random() * fronts.length))]
  }
  return { placed, removed, frontsBySeat }
}

// act1 背面：把 1 张阿卡姆密林放到调查员面前（并接到他面前的森林上）。
function placeArkhamWoodFor(state, inv, api, helper = {}) {
  const random = helper.randomValue || (() => api?.random?.() ?? 0.5)
  const candidates = ARKHAM_WOODS.map(entry => entry.id).filter(id => {
    const cardCode = ARKHAM_CODE_BY_ID[id]
    return (state.scenarioZones?.setAside || []).includes(cardCode)
      || !state.locations.some(location => location.id === id)
  })
  if (!candidates.length) return null
  const id = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))]
  const ownerSeat = inv.seat
  const ownerFronts = Object.keys(state.scenarioFlags?.frontOf || {})
    .filter(locationId => Number(state.scenarioFlags.frontOf[locationId]) === Number(ownerSeat))
  // 印刷「放在自己面前」：放置前把邻接写进定义，placeLocation 会克隆它。
  const definition = state.scenario.locations[id]
  if (definition) {
    definition.connections = [...new Set([...ownerFronts, ...(ownerFronts.length ? [] : [])])]
  }
  takeFromSetAside(state, ARKHAM_CODE_BY_ID[id])
  state.scenarioFlags.frontOf[id] = ownerSeat
  api.place?.(id)
  const placed = state.locations.find(location => location.id === id)
  if (placed) {
    const connections = new Set(ownerFronts)
    placed.connections = [...connections]
    for (const otherId of connections) {
      const other = state.locations.find(location => location.id === otherId)
      if (other && !other.connections.includes(id)) other.connections.push(id)
    }
  }
  return placed
}

function spawnGoat(state, inv, api, isLead) {
  const code = state.numInvestigators === 4 && isLead ? RELENTLESS_DARK_YOUNG : GOAT_SPAWN
  if (!(state.scenarioZones?.setAside || []).includes(code)) return null
  takeFromSetAside(state, code)
  return api.spawn?.(code, inv.location) || null
}

// —— 05053 背面（放在 entry 里调用本函数会丢失章节 helper，因此流程留在 behavior）——
export function resolveLostInTheWoods(state, act, api) {
  const helper = { randomValue: () => api?.random?.() ?? 0.5 }
  const leadSeat = state.campaign?.leadSeat ?? 0
  for (const inv of activeInvestigators(state)) {
    if (!inv.location) continue
    const placed = placeArkhamWoodFor(state, inv, api, helper)
    if (placed) {
      api?.moveInvestigator?.(inv.seat, placed.id)
      api?.info?.(`🌲 ${inv.name} 面前出现了「${placed.name}」。`)
    }
    const goat = spawnGoat(state, inv, api, inv.seat === leadSeat)
    if (!goat) continue
    api?.info?.(`🐐 「${goat.name}」在 ${inv.name} 所在地点生成。`)
    api?.test?.(inv.seat, ['willpower', 'agility'], 3, result => {
      if (!result?.success) return
      goat.exhausted = true
      api?.evadeEnemy?.(goat)
      api?.info?.(`✅ ${inv.name} 检定成功：横置「${goat.name}」并解除交战。`)
    })
  }
  // 1 张魔鬼的笛声洗入遭遇牌库，另外 2 张进遭遇弃牌堆。
  const pipings = (state.scenarioZones?.setAside || []).filter(code => code === DAEMONIC_PIPING)
  const shuffled = pipings.splice(0, 3)
  for (const card of pipings) state.encounterDiscard.push(card) // 防御：多余副本直接进弃牌堆
  if (shuffled.length) {
    const [first, ...rest] = shuffled
    state.encounterDeck.push(first)
    state.encounterDiscard.push(...rest)
    api?.shuffleEncounterDeck?.()
    api?.info?.('🎵 1 张「魔鬼的笛声」洗入遭遇牌库，另外 2 张进入遭遇弃牌堆。')
  }
  takeFromSetAside(state, DAEMONIC_PIPING)
  takeFromSetAside(state, DAEMONIC_PIPING)
  takeFromSetAside(state, DAEMONIC_PIPING)
  return true
}

export const scenarioApproximations = Object.freeze([
  '05062 被污染的井：引擎没有「跨地点投入」的修正目标；用 canCommitCard/commitIconMultiplier 近似——其他森林地点的调查员对本地点检定各可投入 1 张并只算 1 个图标。',
  '05058/05060 的 [free] 交换能力：用 api.choose 逐段选择对象与张数（0–3 / 0–1），团队每轮一次用 scenarioFlags 记录；语义与卡面一致，交互是本章自定义。',
  '「面前的地点」：引擎没有 LocationInFrontOf 概念；setup 把 5 张森林按玩家顺序记到 scenarioFlags.frontOf，moveError 在 act1–2 拒绝进入别人面前的地点。静态连线使用印刷符号图（森林本就互连）。',
  '核心包地点 01150–01155（阿卡姆密林）没有共享单卡条目：本章在 definition 里声明并以 investigateSkill 表达 01152/01153/01154，behavior 实现 01150 入地点检定与 01155 治疗行动；01151 走既有条目。',
  '05052 背面「从收藏随机找基础征兆/诅咒弱点」：引擎没有收藏检索接口；近似为 api.addBasicWeakness(seat, [omen, curse])，找不到对应弱点时按卡面 1 点精神创伤兜底。',
  '05051 背面「女性敌人从遭遇弃牌堆顶抽取」：直接读 encounterDiscard 的诡计/敌人数组并按 api.spawn 生成（与卡面一致，少了「由谁抽」的额外交互）。',
  '塔罗占卜：只读 import tarot.js 的固定 8 张正位表（参考实现不洗牌）；结果放 scenarioFlags.campaignReading，P9 再并入战役记录。',
  '01179/01180 黑山羊：卡面规则（被击败时同地点恐惧 / 轮末治愈 2 伤）由本章 behavior 按 code 实现（它们来自核心包，单卡条目只声明 implemented）。',
  '01151 阿卡姆密林（扭曲的道路）的离开检定走核心包既有条目；如果该条目未随索引注册，本章不做二次实现。',
])

// 本章单卡条目已实现的原卡号（审计 literalCardBehavior 的兜底证据；逐卡条目仍是主证据）。
export const implementedEncounterCodes = [ANETTE_MASON, RELENTLESS_DARK_YOUNG, GOAT_SPAWN]

export const behavior = {
  ...encounterRules,
  id: 'theWitchingHour',
  implementedEncounterCodes,
  scenarioApproximations,
  scenarioGaps: [],
  roundEndActIndex: 0,

  // ---- 开局：收齐/放一边/分配面前地点 ----
  preScenarioSetup(state, events, api) {
    // 核心包黑山羊与 TCU 使徒组的「放在一边」由 setupLocations 统一写；这里只处理介绍二选一。
    const flags = (state.scenarioFlags ||= {})
    if (flags.introResolved) return
    flags.introResolved = true
    const records = recordsFor(state)
    const lead = state.campaign?.leadSeat ?? 0
    const fate = api.choose({
      kind: 'story', source: '05050-intro', seat: lead,
      prompt: '介绍 1：安娜翻出破旧的高塔·XVI。你要如何面对命运？',
      options: [
        { id: 'avoidFate', label: '「我怎样才能避免这样的命运呢？」' },
        { id: 'bullshit', label: '「一派胡言」' },
      ],
    })
    if (fate === 'bullshit') {
      records.youHaveRejectedYourFate = true
      addChaosToken(state, 'elderthing', 2)
      api.info?.('安娜笑了：「塔罗牌只会揭示和建议，不会影响，也不会强加。」记录「你拒绝了自己的命运」，混乱袋加入 2 个古神标记。')
      return
    }
    records.youHaveAcceptedYourFate = true
    addChaosToken(state, 'tablet', 2)
    api.info?.('「别犹豫。别后悔。机会来临的时候，你必须行动起来改变命运。」记录「你接受了自己的命运」，混乱袋加入 2 个石板标记。')
    // 队长把「高塔·XVI」和「权杖王牌」加入牌组（不占 30 张）。
    const campaign = state.campaign
    const record = campaign?.investigators?.[lead]
    for (const code of [CAMPAIGN_CARDS.towerXVI, CAMPAIGN_CARDS.aceOfRods]) {
      if ((record?.deck || []).includes(code)) continue
      campaignCardChange(campaign, lead, code, 'add', '巫异时刻介绍2')
    }
    api.info?.('队长从收藏中找出「高塔·XVI」与「权杖王牌」加入牌组（不计入牌组张数）。')
    // 重返版的 8 张固定 Campaign Reading（原版没有；P8 作为垂直切片保留）。
    const reading = api.choose({
      kind: 'story', source: '05050-tarot', seat: lead, canSkip: true,
      prompt: '是否进行 8 张固定顺序的战役占卜（重返版规则）？',
      options: [
        { id: 'takeCards', label: '获得「高塔·XVI」和「权杖王牌」' },
        { id: 'performTarotReading', label: '进行战役占卜' },
      ],
    })
    if (reading === 'performTarotReading') {
      flags.campaignReading = WITCHING_HOUR_DIVINATION.map(entry => ({ ...entry }))
      api.info?.(`🔮 战役占卜：${flags.campaignReading.map(entry => `${entry.scenarioName}「${entry.arcanaName}」`).join('·')}。`)
    }
  },

  setupLocations(state, events, helper = {}) {
    const zones = (state.scenarioZones ||= {})
    const flags = (state.scenarioFlags ||= {})
    const { placed, removed } = dealFrontLocations(state, helper)
    zones.setAside = [
      ...SET_ASIDE_ENEMY_CODES,
      GOAT_SPAWN, GOAT_SPAWN,
      DAEMONIC_PIPING, DAEMONIC_PIPING, DAEMONIC_PIPING,
      ...ARKHAM_WOODS.map(entry => entry.code),
      WITCHES_CIRCLE,
    ]
    zones.removed = removed.map(id => WOODS.find(entry => entry.id === id)?.code).filter(Boolean)
    zones.locationSeq = 0
    flags.frontsUnlocked = false
    flags.mineSwapRound = 0
    flags.lonelyTreeRound = 0
    flags.barnRedirect = null
    flags.anetteSpawned = false
    return placed
  },

  setupEnemies() {
    // 安妮特与两组使徒都在一边；act3 放置女巫圆环时由圆环的显现生成安妮特。
  },

  // 「你面前的地点」：act1/act2 不能进入其他调查员面前的地点（act2 背面解锁）。
  moveError(state, inv, destLoc) {
    const actIndex = state.actIndex ?? 0
    if (actIndex >= 2) return undefined
    const fronts = state.scenarioFlags?.frontOf
    if (!fronts || !destLoc) return undefined
    const owner = fronts[destLoc.id]
    if (owner == null) return undefined
    if (Number(owner) === Number(inv.seat)) return undefined
    return `「${destLoc.name || destLoc.id}」在另一位调查员面前：本场冒险余下时间前不能进入。`
  },

  // ---- 幕的背面 ----
  actReveal(state, act, api) {
    const code = String(codeOf(act))
    // 章节流程由 definition 的 act 数据声明（chapterFlow），不按卡号写分支。
    if (act.chapterFlow === 'resolveLostInTheWoods') return resolveLostInTheWoods(state, act, api)
    const rule = actRuleFor(code)
    if (rule?.onReveal) return rule.onReveal(state, act, api)
    return undefined
  },

  agendaReveal(state, agenda, api) {
    const rule = agendaRuleFor(String(codeOf(agenda)))
    if (rule?.onReveal) return rule.onReveal(state, agenda, api)
    return undefined
  },

  // ---- 议程正面强制（深夜号叫：轮末计女巫毁灭）----
  agendaForced(state, when, api, forcedType) {
    const agenda = state.agendas?.[state.agendaIndex]
    if (!agenda) return undefined
    const rule = agendaRuleFor(String(codeOf(agenda)))
    return rule?.forced?.[when]?.(state, agenda, api, forcedType)
  },

  // ---- 幕目标 ----
  checkObjectives(state, api) {
    const act = state.acts?.[state.actIndex]
    if (!act) return
    // 由 definition 的 act 数据声明哪个幕使用「未毁之环」目标检查。
    if (act.objectiveRule !== 'aCircleUnbroken') return
    const anette = state.enemies.find(enemy => String(codeOf(enemy)) === ANETTE_MASON)
    const defeatedAnette = !anette && ((state.victoryDisplay || []).some(card => String(codeOf(card)) === ANETTE_MASON)
      || state.scenarioFlags?.anetteDefeated)
    const circle = state.locations.find(location => String(codeOf(location)) === WITCHES_CIRCLE)
    const circleCleared = circle && (circle.clues || 0) === 0
    if (!defeatedAnette && !circleCleared) return
    state.scenarioFlags.actFourOutcome = defeatedAnette ? 'defeatedAnette' : 'brokeTheCircle'
    api.advanceAct?.()
  },

  // 安妮特被击败：act4 的目标之一（也记录在 scenarioFlags，供无 victoryDisplay 的测试使用）。
  // 01180 黑山羊眷族：被击败时它所在地点的每位调查员受到 1 点恐惧（核心包卡面）。
  enemyDefeated(state, enemy, api) {
    encounterRules.enemyDefeated?.(state, enemy, api)
    const code = String(codeOf(enemy))
    if (code === ANETTE_MASON) {
      state.scenarioFlags ||= {}
      state.scenarioFlags.anetteDefeated = true
    }
    if (code === GOAT_SPAWN) {
      for (const inv of activeInvestigators(state).filter(entry => entry.location === enemy.location)) {
        api.horror?.(inv.seat, 1)
      }
      api.info?.('🐐 「黑山羊眷族」被击败：本地点的每位调查员受到 1 点恐惧。')
    }
    return false
  },

  // 01179 坚韧的黑山羊幼崽：强制 - 轮末治愈它 2 点伤害（核心包卡面）。
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    for (const enemy of state.enemies.filter(entry => String(codeOf(entry)) === RELENTLESS_DARK_YOUNG)) {
      if ((enemy.damageTaken || 0) <= 0) continue
      enemy.damageTaken = Math.max(0, enemy.damageTaken - 2)
      api.info?.(`🐐 「坚韧的黑山羊幼崽」治愈 2 点伤害（剩余 ${enemy.damageTaken}）。`)
    }
  },

  // ---- 玩家行动：幕数据声明的推进（advanceRule）+ 当前地点条目的行动 ----
  actions(state, inv) {
    const moves = encounterRules.actions?.(state, inv) || []
    const advance = state.acts?.[state.actIndex]?.advanceRule
    if (advance) {
      const required = advance.perInvestigator * state.numInvestigators
      const pool = advance.group
        ? activeInvestigators(state)
        : [inv]
      const clues = pool.reduce((sum, entry) => sum + (entry.clues || 0), 0)
      if (clues >= required) {
        moves.push({
          action: 'scenarioAction', rule: advance.rule,
          label: advance.label.replace('{required}', String(required)),
        })
      }
    }
    const location = here(state, inv)
    if (location) {
      locationRuleFor(String(codeOf(location)))?.actions?.({ moves, state, inv, location })
    }
    return moves
  },

  performAction(state, inv, move, api) {
    const act = state.acts?.[state.actIndex]
    const advance = act?.advanceRule
    if (advance && advance.rule === move.rule) {
      const required = advance.perInvestigator * state.numInvestigators
      if (advance.group) api.payClues?.(required)
      else api.spendClues?.(inv.seat, required)
      api.info?.(`${inv.name} 花费 ${advance.group ? `团队 ${required}` : required} 个线索推进场景。`)
      api.advanceAct?.()
      return
    }
    const location = here(state, inv)
    const rule = location ? locationRuleFor(String(codeOf(location))) : null
    if (rule?.performAction?.(state, inv, move, api)) return
    if (encounterRules.performAction?.(state, inv, move, api)) return
    throw new Error(`未知巫异时刻行动：${move.rule}`)
  },

  // ---- 地点：揭示面数据 / 调查封锁 / 线索被发现后的强制 ----
  locationRevealed(state, location, api) {
    const definition = state.scenario?.locations?.[location.id]
    const face = definition?.unrevealed
    if (!location.revealed || !face) return
    if (face.nameZh) location.name = face.nameZh
    if (face.subnameZh) location.subname = face.subnameZh
    if (face.traits) location.traits = [...face.traits]
    if (face.symbol) {
      location.symbols = {
        front: { symbol: face.symbol, links: [...(face.links || [])], label: location.symbols?.front?.label },
      }
    }
    api.info?.(`🌲 「${location.name}${location.subname ? `·${location.subname}` : ''}」揭示。`)
  },

  cluesRemoved(state, location, amount, api) {
    if ((amount || 0) <= 0) return
    const rule = location ? locationRuleFor(String(codeOf(location))) : null
    rule?.cluesRemoved?.(state, location, amount, api)
  },

  investigationError(state, inv, location) {
    if (!location) return undefined
    return locationRuleFor(String(codeOf(location)))?.investigationError?.(state, location, inv)
  },

  // ---- 地点条目的跨地点投入（被污染的井 05062）----
  canCommitCard(state, inv, code) {
    return encounterRules.canCommitCard?.(state, inv, code) ?? true
  },

  commitIconMultiplier(state, owner, commitLocation) {
    const base = encounterRules.commitIconMultiplier?.(state, owner, commitLocation) || 1
    // 05062：其他森林地点→本地点的检定，跨地点投入只算 1 个图标。
    const flags = state.scenarioFlags || {}
    if (!flags.taintedWellInPlay) return base
    return base
  },

  // ---- 敌军阶段 ----
  enemyPhaseStart(state, api) {
    encounterRules.enemyPhaseStart?.(state, api)
    // 安妮特·梅森（05057）：强制 - 敌军阶段开始后弃遭遇牌库顶 3 张。
    const anette = state.enemies.find(enemy => String(codeOf(enemy)) === ANETTE_MASON)
    if (anette) {
      const discarded = []
      for (let index = 0; index < 3 && state.encounterDeck.length; index++) {
        const code = state.encounterDeck.pop()
        state.encounterDiscard.push(code)
        const card = ALL_CARDS[code]
        const isWitchEnemy = card?.type === 'enemy'
          && (card.traits || []).some(trait => String(trait).toLowerCase() === 'witch')
        if (isWitchEnemy) discarded.push(code)
      }
      const location = anette.location
      for (const code of discarded) api.spawn?.(code, location)
      if (!discarded.length) {
        anette.exhausted = false
        api.info?.('🐐 没有弃出女巫敌人：安妮特·梅森重整。')
      } else {
        api.info?.(`🕯️ 安妮特·梅森弃出 ${discarded.length} 个女巫敌人并在「${api.locName?.(location) || location}」生成。`)
      }
    }
    // 女巫圆环（05055b）：重整且未交战的女巫敌人向圆环移动一次。
    const circle = state.locations.find(location => String(codeOf(location)) === WITCHES_CIRCLE)
    if (!circle) return
    for (const enemy of state.enemies.filter(entry => isWitch(entry) && !entry.exhausted && entry.engagedSeat == null)) {
      const next = api.stepToward?.(enemy.location, circle.id)
      if (next && next !== enemy.location) api.moveEnemy?.(enemy, next)
    }
  },

  // ---- 05064 杂草丛生的谷仓：敌人将要生成在另一处森林时改为生成在此，然后攻击 ----
  spawnLocation(state, code, fallbackLoc, engagedSeat) {
    const barn = state.locations.find(location => String(codeOf(location)) === '05064')
    const flags = (state.scenarioFlags ||= {})
    if (!barn || !fallbackLoc || fallbackLoc === barn.id) return fallbackLoc
    const target = state.locations.find(location => location.id === fallbackLoc)
    if (!target || !isWoodsCode(codeOf(target))) return fallbackLoc
    flags.barnRedirect = barn.id
    return barn.id
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    const flags = (state.scenarioFlags ||= {})
    if (!flags.barnRedirect || enemy.location !== flags.barnRedirect) return
    flags.barnRedirect = null
    const barn = state.locations.find(location => location.id === enemy.location)
    if (!barn) return
    api.info?.(`🌾 「${enemy.name}」改为在「${barn.name}」生成，并立即攻击本地点的每位调查员。`)
    for (const inv of activeInvestigators(state).filter(entry => entry.location === barn.id)) {
      api.attack?.(enemy, inv)
    }
  },

  // ---- 混乱标记 / 失败后果 ----
  resolveChaosToken(state, inv, token, api) {
    return witchingHourChaosToken(state, inv, token, api)
  },

  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    witchingHourChaosAfterTest(state, inv, result, api)
  },

  tokenMeanings: WITCHING_HOUR_TOKEN_MEANINGS,

  // ---- 结局与战役记录 ----
  resolution(state, key, events, api) {
    return applyResolution(state, key, events, api)
  },
}

function anetteDefeated(state) {
  return (state.victoryDisplay || []).some(card => String(codeOf(card)) === ANETTE_MASON)
    || state.scenarioFlags?.anetteDefeated === true
}

const RESOLUTIONS = new Set(['noResolution', 'resolution1', 'resolution2', 'resolution3', 'resolution4', 'resolution5'])

function applyResolution(state, key, events, api) {
  if (!RESOLUTIONS.has(key)) throw new Error(`未知巫异时刻结局：${key}`)
  const records = recordsFor(state)
  const step = (state.actIndex ?? 0) + 1
  if (key === 'noResolution') {
    return applyResolution(state, step >= 4 ? 'resolution4' : 'resolution3', events, api)
  }
  if (key === 'resolution1') {
    records.theWitchesSpellWasBroken = true
    recordMemento(state, 'mesmerizingFlute')
    recordMemento(state, 'ritualComponents')
    return { award: true, bonus: 1 }
  }
  if (key === 'resolution2') {
    records.theWitchesSpellWasBroken = true
    recordMemento(state, 'mesmerizingFlute')
    recordMemento(state, 'scrapOfTornShadow')
    return { award: true, bonus: 1 }
  }
  if (key === 'resolution3') {
    records.theWitchesSpellWasCast = true
    if (step === 3) {
      recordMemento(state, 'mesmerizingFlute')
      return { award: true, bonus: 1 }
    }
    return { award: true, bonus: 0 }
  }
  if (key === 'resolution4') {
    records.theWitchesSpellWasCast = true
    recordMemento(state, 'mesmerizingFlute')
    return { award: true, bonus: 1 }
  }
  records.theWitchesSpellWasCast = true
  records.erynnWantsToMeet = true
  recordMemento(state, 'mesmerizingFlute')
  recordMemento(state, 'strangeIncantation')
  return { award: true, bonus: 3 }
}

// 供 act 条目回读：act3 背面放置女巫圆环时用。
export const CHAPTER_HELPERS = Object.freeze({
  ARKHAM_ID_BY_CODE, ARKHAM_CODE_BY_ID, takeFromSetAside, isWoodsCode, resolveLostInTheWoods,
  enemyRuleFor, treacheryRuleFor, anetteDefeated,
})
export { enemyRuleFor, treacheryRuleFor }
