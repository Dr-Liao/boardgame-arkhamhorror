// 05238《聚合幻灭》· 章节行为（引擎钩子）
//
// 规则映射见 artifacts/migration/tcu/p8/specs/unionAndDisillusion.md。
// 约定：随机只走 helper.randomValue / api.random / api.shuffle；本章状态写
// state.scenarioFlags / state.scenarioZones（纯 JSON）；火盆走 P2.11 locationFlag。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { encounterResolveFor, entryFlags } from '../../../../../src/cards/card-rules.js'
import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { encounterRules, activeInvestigators, hasTrait, recordsFor } from '../../encounter-rules.js'
import { uadChaosToken, uadCultistReveal } from './chaos.js'
import {
  ACT_BEYOND_V1, ACT_BEYOND_V2, ACT_BEYOND_V3, ACT_BEYOND_V4, ACT_BINDING_RITE,
  ACT_BROKEN_RITE, ACT_DECKS, ACT_FATED_SOULS, ACT_UNVISITED_ISLE, AGENDA_CROSSROADS,
  AGENDA_LOVERS, ANETTE_MASON, COVEN_INITIATE, FATE_LIST, FORBIDDING_SHORE, GEIST_TRAP,
  ISLE_CODES, JOSEF_MEIGER, KEEPER_OF_SECRETS, LODGE_NEOPHYTE, MISKATONIC_RIVER,
  SPECTRAL_RAVEN, THE_SPECTRAL_WATCHER, TREACHERY_CODES, UNVISITED_ISLES, WHIPPOORWILL,
} from './definition.js'
import { scenarioGaps, scenarioApproximations } from './notes.js'

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
const original = card => card?.originalCode || card?.code
const locById = (state, id) => (state.locations || []).find(location => location.id === id) || null
const locByCode = (state, code) => (state.locations || []).find(location => original(location) === code) || null
const isleLocations = state => (state.locations || []).filter(location => ISLE_CODES.includes(original(location)))
const here = (state, inv) => locById(state, inv?.location)
const watcherOf = state => (state.enemies || []).find(enemy => original(enemy) === THE_SPECTRAL_WATCHER) || null
const traitsOf = card => ALL_CARDS[original(card)]?.traits || card?.traits || []
const setFlags = (state, patch) => Object.assign((state.scenarioFlags ||= {}), patch)

function takeFromSetAside(state, code) {
  const zones = (state.scenarioZones ||= {})
  const list = (zones.setAside ||= [])
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
  return index >= 0
}

// ---------------------------------------------------------------------------
// 阵营 / 火盆
// ---------------------------------------------------------------------------
export function factionOf(state) {
  const records = recordsFor(state)
  if (records.theInvestigatorsSidedWithTheLodge) return 'lodge'
  if (records.theInvestigatorsSidedWithTheCoven) return 'coven'
  return 'coven'
}

export function brazierLit(state, locationId) {
  const location = locById(state, locationId)
  if (!location) return false
  if (typeof location.flags?.brazier === 'boolean') return location.flags.brazier
  return location.litBrazier === true
}

export function setBrazier(state, api, locationId, lit) {
  const location = locById(state, locationId)
  if (typeof api?.setLocationFlag === 'function') api.setLocationFlag(locationId, 'brazier', lit)
  else if (location) {
    location.flags ||= {}
    location.flags.brazier = lit
  }
  return lit
}

function brazierVariant(lit) {
  return lit ? { flags: { brazier: true } } : {}
}

// 放置未访之岛 / 灵怪陷阱：入场时未揭示，附加火盆初始状态（女巫集会点燃）。
function placeUnrevealedLocation(state, api, id, { lit = false } = {}) {
  state.locationVariants ||= {}
  state.locationVariants[id] = { ...(state.locationVariants[id] || {}), ...brazierVariant(lit) }
  if (!locById(state, id)) api?.place?.(id)
  return locById(state, id)
}

export function litIsles(state) {
  return isleLocations(state).filter(location => brazierLit(state, location.id))
}

// ---------------------------------------------------------------------------
// 命运剧情卡（没有「冒险参考牌底」原语 → scenarioFlags.fateCards）
// ---------------------------------------------------------------------------
function setupFateCards(state) {
  const records = recordsFor(state)
  const missing = Array.isArray(records.missingPersons) ? records.missingPersons : []
  const includeAll = missing.length === 0
  const cards = FATE_LIST
    .filter(fate => includeAll || missing.includes(fate.person))
    .map(fate => ({
      code: fate.story, ally: fate.ally, enemy: fate.enemy, person: fate.person,
      trail: fate.trail, alive: fate.alive, dead: fate.dead, name: fate.name, resolved: false, seat: null,
    }))
  return cards
}

function spawnFateEnemy(state, api, fate, inv, exhausted) {
  const card = ALL_CARDS[fate.enemy] || {}
  const printed = state.scenario?.enemies?.[fate.enemy] || {}
  const locationId = inv?.location || 'miskatonicRiver'
  let enemy = null
  if (typeof api?.spawnStoryEnemy === 'function') {
    enemy = api.spawnStoryEnemy(fate.enemy, locationId, {
      name: card.nameZh || card.name || fate.name,
      fight: printed.fight ?? card.fight ?? 0, evade: printed.evade ?? card.evade ?? 0,
      health: printed.health ?? card.health ?? 1,
      damage: printed.damage ?? card.damage ?? 0, horror: printed.horror ?? card.horror ?? 0,
      hunter: Boolean(printed.hunter), alert: Boolean(printed.alert),
      retaliate: Boolean(printed.retaliate), traits: printed.traits || traitsOf(card),
    }, { exhausted: !!exhausted })
  } else if (typeof api?.spawn === 'function') {
    enemy = api.spawn(fate.enemy, locationId)
    if (enemy && exhausted) enemy.exhausted = true
  }
  if (enemy && exhausted) {
    enemy.exhausted = true
    if (enemy.engagedSeat != null) {
      const holder = state.investigators[enemy.engagedSeat]
      if (holder) holder.engaged = (holder.engaged || []).filter(id => id !== enemy.id)
    }
    enemy.engagedSeat = null
  }
  return enemy
}

function resolveFate(state, api, fate, inv) {
  if (!fate || fate.resolved) return
  const records = recordsFor(state)
  const disappeared = (records.disappearedIntoTheMist || []).includes(fate.person)
  const claimed = (records.wasClaimedBySpecters || []).includes(fate.person)
  const onTrail = Boolean(records[fate.trail])
  fate.resolved = true
  fate.seat = inv?.seat ?? null
  if (disappeared && onTrail) {
    removeFromSetAsideByCode(state, fate.ally)
    if (typeof api?.giveAsset === 'function' && inv) api.giveAsset(inv.seat, fate.ally)
    else if (inv) {
      inv.assets ||= []
      inv.assets.push({ id: `story:${fate.ally}`, code: fate.ally, originalCode: fate.ally })
    }
    records[fate.alive] = true
    api?.info?.(`“${fate.name}”从雾中跌出：你控制其剧情支援，记录其还活着。`)
    return
  }
  if (claimed) {
    spawnFateEnemy(state, api, fate, inv, onTrail)
    api?.info?.(`“${fate.name}”已被幽灵夺走性命：翻回敌人面生成${onTrail ? '（横置、不交战）' : '（与你交战）'}。`)
    return
  }
  api?.info?.(`“${fate.name}”的命运：你在原地没有找到其人。`)
}

function removeFromSetAsideByCode(state, code) {
  state.scenarioZones ||= {}
  const list = (state.scenarioZones.setAside ||= [])
  const index = list.indexOf(code)
  if (index >= 0) list.splice(index, 1)
}

// ---------------------------------------------------------------------------
// 幕 3/4 版本选择（战役记录）
// ---------------------------------------------------------------------------
export function actVersionFor(records) {
  if (records.theInvestigatorsSidedWithTheLodge) return 'v1'
  if (records.theInvestigatorsSidedWithTheCoven) {
    const deceiving = records.theInvestigatorsAreDeceivingTheLodge
    const inducted = records.theInvestigatorsWereInductedIntoTheInnerCircle
    const hidKnowledge = records.theInvestigatorsHidTheirKnowledgeOfTheCoven
    const keptMementos = records.theInvestigatorsKeptsTheirMementosHidden
    if (deceiving && inducted) return 'v2'
    if ([deceiving, hidKnowledge, keptMementos].filter(Boolean).length >= 2) return 'v3'
    return 'v4'
  }
  return 'v4'
}

// ---------------------------------------------------------------------------
// 阵法行动表（P2.5：2–4 个技能求和 + actionKind:'circle'）
// ---------------------------------------------------------------------------
export const CIRCLE_ACTIONS = Object.freeze({
  [FORBIDDING_SHORE]: { skills: ['willpower', 'intellect'], chooseSkill: true, difficulty: 3 },
  [UNVISITED_ISLES.standingStones]: { skills: ['willpower', 'intellect'], difficulty: 10 },
  [UNVISITED_ISLES.mistyClearing]: { skills: ['willpower', 'agility'], difficulty: 11 },
  [UNVISITED_ISLES.forsakenWoods]: { skills: ['willpower', 'combat'], difficulty: 11 },
  [UNVISITED_ISLES.mossCoveredSteps]: { skills: ['combat', 'agility'], difficulty: 10 },
  [UNVISITED_ISLES.hauntedSpring]: { skills: ['intellect', 'agility'], difficulty: 9 },
  [UNVISITED_ISLES.decayedWillow]: { skills: ['intellect', 'combat'], difficulty: 9 },
  [GEIST_TRAP]: { skills: ['willpower', 'intellect', 'combat', 'agility'], difficulty: 20 },
})

export const implementedEncounterCodes = [
  WHIPPOORWILL, SPECTRAL_RAVEN,
  '05262b', '05263b', '05264b', '05265b',
  '05268', '05269', '05270', '05271', '05272',
]

// 卡面子句完全未实现的内容（审计读点）。
export const behavior = {
  ...encounterRules,
  id: 'unionAndDisillusion',

  implementedEncounterCodes,
  scenarioGaps,
  scenarioApproximations,
  // 读点（测试 / UI / 其它 worker）
  factionOf,
  brazierLit,
  litIsles,
  actVersionFor,
  CIRCLE_ACTIONS,
  fateCards: state => (state.scenarioFlags || {}).fateCards || [],

  // 序章二选一（记录已存在时不询问）与幕 3/4 版本。
  preScenarioSetup(state, events, api) {
    const records = recordsFor(state)
    if (!records.theInvestigatorsSidedWithTheLodge && !records.theInvestigatorsSidedWithTheCoven) {
      let answer = 'coven'
      if (typeof api?.choose === 'function') {
        answer = api.choose({
          kind: 'story', source: 'unionAndDisillusion', seat: state.campaign?.leadSeat ?? 0,
          prompt: '你们要帮助秘社完成仪式，还是阻止秘社的仪式？',
          options: [
            { id: 'lodge', label: '我们得帮助秘社完成仪式。' },
            { id: 'coven', label: '我们得阻止秘社的仪式。' },
          ],
        })
      }
      if (answer === 'lodge') records.theInvestigatorsSidedWithTheLodge = true
      else records.theInvestigatorsSidedWithTheCoven = true
    }
    setFlags(state, { faction: factionOf(state) })
    const version = actVersionFor(records)
    const deck = ACT_DECKS[version]
    if (Array.isArray(state.acts) && deck) {
      state.acts[2] = JSON.parse(JSON.stringify(deck[2]))
      state.acts[3] = JSON.parse(JSON.stringify(deck[3]))
    }
    setFlags(state, { actVersion: version })
  },

  setupLocations(state, events, helper = {}) {
    const records = recordsFor(state)
    const faction = factionOf(state)
    // setup 的 helper：randomValue(state) 带 state 参数；shuffle(items, rng) 是两参。
    // 不能把 randomValue 直接当 rng（引擎会按 rng(items) 调用而报 `rng is not a function`）。
    const shuffle = list => (typeof helper?.shuffle === 'function'
      ? helper.shuffle([...list], () => helper.randomValue(state))
      : [...list])
    const shuffled = shuffle([...ISLE_CODES])
    const placedIsles = shuffled.slice(0, 2)
    const asideIsles = shuffled.slice(2)
    state.scenarioZones ||= {}
    state.scenarioZones.setAside = [
      GEIST_TRAP, TREACHERY_CODES.watchersGaze,
      ...asideIsles,
      // 三个整组放在一边（act 3 背面洗回；看守人本身也放在一边）
      THE_SPECTRAL_WATCHER, '05087', '05087',
      COVEN_INITIATE, COVEN_INITIATE, COVEN_INITIATE, '05091',
      LODGE_NEOPHYTE, LODGE_NEOPHYTE, LODGE_NEOPHYTE, KEEPER_OF_SECRETS, '05097', '05097',
      ...FATE_LIST.map(fate => fate.ally).filter(code => {
        const fate = FATE_LIST.find(entry => entry.ally === code)
        return !Array.isArray(records.missingPersons) || records.missingPersons.length === 0
          || records.missingPersons.includes(fate.person)
      }),
    ]
    state.scenarioZones.removed = []
    setFlags(state, {
      faction,
      asideIsles,
      placedIsles,
      fateCards: setupFateCards(state),
      watcherSpawned: false,
      watcherSouls: 0,
      watcherDefeatedAt: null,
      geistTrapPlaced: false,
      circleDifficultyRound: 0,
      mossStepsRound: 0,
      mossStepsPaid: {},
      noParleyJosef: false,
    })
    // 火盆：女巫集会支持者开局点燃危险河岸 + 2 张未访之岛。
    state.locationVariants ||= {}
    const lit = faction === 'coven'
    state.locationVariants.forbiddingShore = { ...(state.locationVariants.forbiddingShore || {}), ...brazierVariant(lit) }
    for (const code of placedIsles) {
      const id = idOfIsle(code)
      state.locationVariants[id] = { ...(state.locationVariants[id] || {}), ...brazierVariant(lit) }
    }
    return ['miskatonicRiver', 'forbiddingShore', ...placedIsles.map(idOfIsle)]
  },

  startLocation() {
    return 'miskatonicRiver'
  },

  // 鬼灵迷雾 / 灵怪陷阱：未揭示时不能进入。
  investigatorEntryError(state, location) {
    const code = original(location)
    if (ISLE_CODES.includes(code) && !location.revealed) {
      const lit = brazierLit(state, 'forbiddingShore')
      const faction = factionOf(state)
      if (faction === 'lodge' && !lit) return '鬼灵迷雾堵住道路：危险河岸的火盆尚未点燃，不能进入。'
      if (faction === 'coven' && lit) return '鬼灵迷雾堵住道路：危险河岸的火盆仍然点燃，不能进入。'
      return null
    }
    if (code === GEIST_TRAP && !location.revealed) return '通往仪式地点的道路被鬼灵迷雾所遮蔽：尚未揭示。'
    return null
  },

  // 阵法行动：任何有火盆且已揭示的地点。
  actions(state, inv) {
    const moves = []
    const location = here(state, inv)
    if (!location || !location.revealed) return moves
    const code = original(location)
    if (!CIRCLE_ACTIONS[code]) return moves
    const lit = brazierLit(state, location.id)
    moves.push({
      action: 'scenarioAction', rule: 'circle', label: '阵法：检定以寻找火盆',
      hint: lit ? '当前火盆已点燃' : '当前火盆未点燃',
    })
    return moves
  },

  performAction(state, inv, move, api) {
    if (!move || move.rule !== 'circle') {
      if (encounterRules.performAction?.(state, inv, move, api)) return true
      throw new Error(`未知聚合幻灭行动：${move?.rule}`)
    }
    const location = here(state, inv)
    const spec = CIRCLE_ACTIONS[original(location)]
    if (!spec) {
      api?.info?.('这里没有火盆。')
      return true
    }
    const finish = result => {
      if (!result?.success) {
        api?.info?.('阵法检定失败：火盆没有变化。')
        return
      }
      const lit = brazierLit(state, location.id)
      const options = []
      if (lit) options.push({ id: 'unlight', label: '熄灭此处的火盆' })
      else options.push({ id: 'light', label: '点燃此处的火盆' })
      options.push({ id: 'leave', label: '不做改变' })
      let answer = options[0].id
      if (typeof api?.choose === 'function') {
        answer = api.choose({
          kind: 'circle', source: original(location), seat: inv.seat,
          prompt: `阵法成功：${lit ? '熄灭' : '点燃'}火盆？`, options,
        })
      }
      if (answer === 'light') setBrazier(state, api, location.id, true)
      if (answer === 'unlight') setBrazier(state, api, location.id, false)
      api?.info?.(`阵法成功：${answer === 'leave' ? '火盆保持原样' : (answer === 'light' ? '火盆被点燃' : '火盆被熄灭')}。`)
    }
    if (spec.chooseSkill) {
      let skill = spec.skills[0]
      if (typeof api?.choose === 'function') {
        skill = api.choose({
          kind: 'circle', source: original(location), seat: inv.seat,
          prompt: '选择检定技能。',
          options: spec.skills.map(id => ({ id, label: { willpower: '意志', intellect: '智力', combat: '战斗', agility: '敏捷' }[id] })),
        })
      }
      if (!spec.skills.includes(skill)) skill = spec.skills[0]
      api?.test?.(inv.seat, skill, spec.difficulty, finish, 0,
        { label: '阵法', code: original(location) }, { actionKind: 'circle' })
      return true
    }
    // P2.5：2–4 个技能求和检定。
    api?.test?.(inv.seat, [...spec.skills], spec.difficulty, finish, 0,
      { label: '阵法', code: original(location) }, { actionKind: 'circle' })
    return true
  },

  // 立石闹鬼：本轮所有阵法检定难度 +2。
  testDifficultyModifier(state, inv, skill, difficulty, source) {
    const isCircle = source?.label === '阵法' || state.skillTest?.actionKind === 'circle'
    if (isCircle && (state.scenarioFlags?.circleDifficultyRound || 0) === state.round) return 2
    return 0
  },

  // 闹鬼脚本（P2.1 的 escape 子句：需要跨牌堆/跨检定状态的能力）。
  hauntedScript(state, payload, api) {
    const scriptId = payload?.scriptId
    const locationId = payload?.locationId || state.investigators?.[payload?.seat]?.location
    if (scriptId === 'standingStones') {
      setFlags(state, { circleDifficultyRound: state.round })
      api?.info?.('立石闹鬼：直到本轮结束，阵法行动期间的检定难度 +2。')
      return true
    }
    if (scriptId === 'mossSteps') {
      setFlags(state, { mossStepsRound: state.round, mossStepsPaid: {} })
      api?.info?.('苔藓阶梯闹鬼：本轮你的下一次移动行动额外花费 1 个行动。')
      return true
    }
    if (scriptId === 'forsakenWoods') {
      const nearby = state.enemies.filter(enemy => original(enemy) === WHIPPOORWILL)[0] || null
      const options = []
      const found = findWhippoorwill(state)
      if (found || true) options.push({ id: 'search', label: '查找夜鹰并生成在此地点' })
      if (nearby) options.push({ id: 'attack', label: '最近的夜鹰攻击你' })
      let answer = options[0].id
      if (typeof api?.choose === 'function' && options.length > 1) {
        answer = api.choose({
          kind: 'haunted', source: 'forsakenWoods', seat: payload?.seat,
          prompt: '被遗忘的树林闹鬼：选择一项。', options,
        })
      }
      if (answer === 'attack' && nearby) {
        api?.attack?.(nearby, state.investigators[payload.seat])
        return true
      }
      if (found) {
        removeEncounterCard(state, found)
        api?.spawn?.(WHIPPOORWILL, locationId)
      } else {
        api?.spawn?.(WHIPPOORWILL, locationId)
      }
      api?.info?.('被遗忘的树林闹鬼：一张夜鹰生成在此地点。')
      return true
    }
    return false
  },

  // 苔藓阶梯：下一次移动额外 1 行动。
  beforeMove(state, inv, destination, api) {
    if ((state.scenarioFlags?.mossStepsRound || 0) !== state.round) return
    const paid = (state.scenarioFlags.mossStepsPaid ||= {})
    if (paid[inv.seat]) return
    paid[inv.seat] = true
    if (state.phase === 'investigation') inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - 1)
    else {
      inv.pendingActionLoss ||= {}
      inv.pendingActionLoss[state.round] = (inv.pendingActionLoss[state.round] || 0) + 1
    }
    api?.info?.('苔藓阶梯：下一次移动额外花费 1 个行动。')
  },

  // -------------------------------------------------------------------------
  // 幕 / 议程
  // -------------------------------------------------------------------------
  actReveal(state, act, api) {
    const code = String(original(act))
    if (code === ACT_UNVISITED_ISLE) {
      const aside = [...(state.scenarioFlags?.asideIsles || [])]
      const placedIsles = state.scenarioFlags?.placedIsles || []
      const faction = factionOf(state)
      for (const inv of activeInvestigators(state)) {
        if (!aside.length) break
        const isleCode = aside.shift()
        const id = idOfIsle(isleCode)
        placeUnrevealedLocation(state, api, id, { lit: faction === 'coven' })
        placedIsles.push(isleCode)
        api?.moveInvestigator?.(inv.seat, id)
        if (typeof api?.moveInvestigator !== 'function') inv.location = id
        api?.info?.(`${inv.name} 面前放置了「未访之岛」，并立即移动到该地点。`)
      }
      setFlags(state, { asideIsles: aside, placedIsles })
      dealFateCards(state, api)
      return
    }
    if (code === ACT_FATED_SOULS) {
      const watcherCode = THE_SPECTRAL_WATCHER
      takeFromSetAside(state, watcherCode)
      const watcher = typeof api?.spawn === 'function' ? api.spawn(watcherCode, 'miskatonicRiver') : null
      if (watcher) {
        watcher.lostSouls = state.scenarioFlags?.watcherSouls || 0
        watcher.health = (Number(state.scenario?.enemies?.[watcherCode]?.health) || Number(ALL_CARDS[watcherCode]?.health) || 5) + watcher.lostSouls * (state.numInvestigators || 1)
      }
      setFlags(state, { watcherSpawned: true })
      // 看守人的注视洗入遭遇牌库 + 洗回弃牌堆。
      const gaze = TREACHERY_CODES.watchersGaze
      if (takeFromSetAside(state, gaze)) {
        state.encounterDeck ||= []
        state.encounterDeck.push(gaze)
        if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
      }
      state.encounterDeck = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
      state.encounterDiscard = []
      if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
      // 灵怪陷阱入场（未揭示）；女巫集会则点燃火盆。
      const lit = factionOf(state) === 'coven'
      placeUnrevealedLocation(state, api, 'geistTrap', { lit })
      setFlags(state, { geistTrapPlaced: true })
      api?.info?.('命数已定背面：幽灵看守人出现在米斯卡塔尼克河，灵怪陷阱入场。')
      return
    }
    if ([ACT_BEYOND_V1, ACT_BEYOND_V2, ACT_BEYOND_V3, ACT_BEYOND_V4].includes(code)) {
      revealGeistTrapAndGather(state, api)
      if (code === ACT_BEYOND_V1) {
        if (recordsFor(state).theWitchesSpellWasCast) {
          spawnPrinted(state, api, ANETTE_MASON, 'geistTrap')
        } else {
          const count = (state.numInvestigators || 1) > 2 ? 2 : 1
          for (let index = 0; index < count; index++) spawnPrinted(state, api, COVEN_INITIATE, 'geistTrap')
        }
        shuffleAsideIntoDeck(state, api, [COVEN_INITIATE, '05091'])
      } else if (code === ACT_BEYOND_V2) {
        state.chaosBag = (state.chaosBag || []).filter(token => token !== 'cultist')
        api?.info?.('迷雾彼端（版本二）：所有异教徒标记从混乱袋中移除。')
      } else {
        const count = (state.numInvestigators || 1) > 2 ? 2 : 1
        for (let index = 0; index < count; index++) spawnPrinted(state, api, LODGE_NEOPHYTE, 'geistTrap')
        if (recordsFor(state).josefIsAliveAndWell) {
          setFlags(state, { noParleyJosef: true })
          spawnPrinted(state, api, JOSEF_MEIGER, 'geistTrap')
        }
        shuffleAsideIntoDeck(state, api, [LODGE_NEOPHYTE, KEEPER_OF_SECRETS, '05097', '05097'])
      }
      return
    }
    if (code === ACT_BINDING_RITE) {
      api?.finish?.('r1')
      return
    }
    if (code === ACT_BROKEN_RITE) api?.finish?.('r4')
  },

  agendaReveal(state, agenda, api) {
    const code = String(original(agenda))
    if (code === AGENDA_LOVERS) {
      state.encounterDeck = [...(state.encounterDeck || []), ...(state.encounterDiscard || [])]
      state.encounterDiscard = []
      if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
      const taken = (recordsFor(state).wasTakenByTheWatcher || []).length
      setFlags(state, { watcherSouls: taken })
      const watcher = watcherOf(state)
      if (watcher) {
        watcher.lostSouls = taken
        watcher.health = (Number(state.scenario?.enemies?.[THE_SPECTRAL_WATCHER]?.health) || Number(ALL_CARDS[THE_SPECTRAL_WATCHER]?.health) || 5) + taken * (state.numInvestigators || 1)
      }
      api?.info?.(`恋人·VI 背面：洗回弃牌堆；${taken} 个灵魂被偷走（看守人 +${taken} 攻击 / +${taken * (state.numInvestigators || 1)} 生命）。`)
      return
    }
    if (code === AGENDA_CROSSROADS) {
      for (const inv of activeInvestigators(state)) {
        api?.trauma?.(inv.seat, 'physical', 1)
        inv.defeated = true
        api?.info?.(`命运的十字路口背面：${inv.name} 被击败并承受 1 点肉体创伤。`)
      }
      api?.finish?.('r5')
    }
  },

  checkObjectives(state, api) {
    const act = state.acts?.[state.actIndex]
    if (!act) return
    const code = String(original(act))
    const isles = isleLocations(state)
    if ([ACT_BEYOND_V1, ACT_BEYOND_V2, ACT_BEYOND_V3, ACT_BEYOND_V4].includes(code)) {
      if (!isles.length) return
      const wantLit = code === ACT_BEYOND_V1
      const ready = isles.every(location => location.revealed && brazierLit(state, location.id) === wantLit)
      if (ready) api?.advanceAct?.()
      return
    }
    if (code === ACT_BINDING_RITE || code === ACT_BROKEN_RITE) {
      const watchedGoal = brazierLit(state, 'geistTrap') === (code === ACT_BINDING_RITE)
      const defeatedAtTrap = Boolean(state.scenarioFlags?.watcherDefeatedAt)
      if (defeatedAtTrap && watchedGoal) api?.advanceAct?.()
    }
  },

  // -------------------------------------------------------------------------
  // 敌人
  // -------------------------------------------------------------------------
  spawnLocation(state, code) {
    if (code === WHIPPOORWILL || code === SPECTRAL_RAVEN) {
      const alive = activeInvestigators(state)
      return alive[0]?.location || null
    }
    return null
  },

  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    const code = String(original(enemy))
    if (code === THE_SPECTRAL_WATCHER) {
      enemy.lostSouls = Number(enemy.lostSouls) || Number(state.scenarioFlags?.watcherSouls) || 0
      enemy.health = (Number(enemy.health) || 5) + enemy.lostSouls * (state.numInvestigators || 1)
      setFlags(state, { watcherSpawned: true })
      return
    }
    if (code === SPECTRAL_RAVEN) {
      enemy.prey = 'lowestIntellect'
      return
    }
    // 秘社新信徒的「入场放 1 毁灭」：用 definition 声明的 ruleId 判断（共享组条目不属本章）。
    if (code === LODGE_NEOPHYTE) {
      enemy.doom = (enemy.doom || 0) + 1
      api?.info?.('秘社新信徒入场：在其上放置 1 个毁灭。')
    }
  },

  enemyDefeated(state, enemy, api) {
    const code = String(original(enemy))
    if (code === THE_SPECTRAL_WATCHER) {
      // 卡面：被击败时不弃掉，改为治愈所有伤害、解除交战并横置；本轮补给阶段不重整。
      enemy.damageTaken = 0
      enemy.horror = 0
      enemy.exhausted = true
      enemy.engagedSeat = null
      if (!state.enemies.includes(enemy)) state.enemies.push(enemy)
      const atTrap = String(original(locById(state, enemy.location))) === GEIST_TRAP
      if (atTrap) {
        setFlags(state, { watcherDefeatedAt: enemy.location })
        api?.info?.('幽灵看守人在灵怪陷阱被击败：它没有被弃掉，治愈伤害并横置。')
        const actCode = String(original(state.acts?.[state.actIndex]))
        if ((actCode === ACT_BINDING_RITE || actCode === ACT_BROKEN_RITE)
          && brazierLit(state, 'geistTrap') === (actCode === ACT_BINDING_RITE)) api?.advanceAct?.()
      } else {
        api?.info?.('幽灵看守人被击败：它没有被弃掉，治愈伤害并横置。')
      }
      return true
    }
    if (FATE_LIST.some(fate => fate.enemy === code)) {
      const fate = FATE_LIST.find(entry => entry.enemy === code)
      if (fate) recordsFor(state)[fate.dead] = true
      return encounterRules.enemyDefeated?.(state, enemy, api) || false
    }
    return encounterRules.enemyDefeated?.(state, enemy, api) || false
  },

  enemyEngaged(state, enemy, inv, api) {
    encounterRules.enemyEngaged?.(state, enemy, inv, api)
    const code = String(original(enemy))
    const flags = entryFlags(code) || {}
    if (flags.onEngageDiscardTwo) {
      api?.discardChosen?.(inv.seat, flags.onEngageDiscardTwo, enemy.name)
      api?.info?.(`${enemy.name}与你交战：选择并弃掉 ${flags.onEngageDiscardTwo} 张手牌。`)
      return
    }
    if (flags.onEngageLoseTwoResources) {
      inv.resources = Math.max(0, (inv.resources || 0) - 2)
      api?.info?.(`${enemy.name}与你交战：失去 2 个资源。`)
      return
    }
    if (code === SPECTRAL_RAVEN) {
      const haunted = typeof api?.haunted === 'function' && locById(state, inv.location)?.haunted
      let answer = 'modify'
      if (typeof api?.choose === 'function') {
        answer = api.choose({
          kind: 'enemy', source: SPECTRAL_RAVEN, seat: inv.seat,
          prompt: '幽灵乌鸦与你交战：结算所在地点的闹鬼能力，或让它 +2 攻击/+2 躲避直到调查阶段结束。',
          options: [
            ...(haunted ? [{ id: 'haunted', label: '结算所在地点的闹鬼能力' }] : []),
            { id: 'modify', label: '幽灵乌鸦 +2 攻击与 +2 躲避' },
          ],
        })
      }
      if (answer === 'haunted') api?.haunted?.(inv.seat, { locationId: inv.location })
      else {
        enemy.ravenBoostRound = state.round
        enemy.ravenBoostPhase = 'investigation'
        api?.info?.('幽灵乌鸦得到 +2 攻击与 +2 躲避直到调查阶段结束。')
      }
    }
  },

  afterEvade(state, inv, enemy, result, api) {
    encounterRules.afterEvade?.(state, inv, enemy, result, api)
    const evadeFlags = entryFlags(String(original(enemy))) || {}
    if (evadeFlags.onEvadeDamage && result?.success) {
      api?.damage?.(inv.seat, evadeFlags.onEvadeDamage)
      api?.info?.(`你成功躲避${enemy.name}：受到 ${evadeFlags.onEvadeDamage} 点伤害。`)
    }
  },

  enemyAttackedSuccessfully(state, inv, enemy, api) {
    encounterRules.enemyAttackedSuccessfully?.(state, inv, enemy, api)
    if (entryFlags(String(original(enemy)))?.onAttackedHorrorIfReady && !enemy.exhausted) {
      api?.horror?.(inv.seat, 1)
      api?.info?.(`你成功攻击${enemy.name}：她仍处于重整状态，受到 1 点恐惧。`)
    }
  },

  // 夜鹰：所在地点的调查员 -1 全部技能。
  statModifier(state, inv, skill) {
    let delta = encounterRules.statModifier?.(state, inv, skill) || 0
    const whippoorwillHere = state.enemies.some(enemy =>
      String(original(enemy)) === WHIPPOORWILL && enemy.location === inv.location && !enemy.exhausted)
    if (whippoorwillHere) delta -= 1
    return delta
  },

  enemyStatModifier(state, enemy, stat) {
    let delta = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    const code = String(original(enemy))
    if (code === THE_SPECTRAL_WATCHER && (stat === 'fight' || stat === 'evade')) {
      delta += Number(enemy.lostSouls) || 0
    }
    if (code === SPECTRAL_RAVEN && state.phase === 'investigation'
      && enemy.ravenBoostRound === state.round && (stat === 'fight' || stat === 'evade')) delta += 2
    return delta
  },

  // 共享 encounter-rules 的幽灵敌人地点限制不适用于本章（UAD 幽灵敌人卡面无此限制）。
  canFightEnemy() {
    return true
  },

  canEvadeEnemy() {
    return true
  },

  // 05269/05270 威胁区的强制：在将受到伤害/恐惧时额外 2 点并弃掉本卡。
  beforeHarm(state, inv, harm, api) {
    if (!inv || !harm) return harm
    let { damage = 0, horror = 0 } = harm
    const has = code => (inv.threat || []).some(card => original(card) === code)
    if (damage > 0 && has(TREACHERY_CODES.psychopompsSong)) {
      inv.threat = inv.threat.filter(card => original(card) !== TREACHERY_CODES.psychopompsSong)
      damage += 2
      api?.info?.('灵魂之歌：你额外受到 2 点伤害，然后弃掉灵魂之歌。')
    }
    if (horror > 0 && has(TREACHERY_CODES.deathApproaches)) {
      inv.threat = inv.threat.filter(card => original(card) !== TREACHERY_CODES.deathApproaches)
      horror += 2
      api?.info?.('死期临近：你额外受到 2 点恐惧，然后弃掉死期临近。')
    }
    return { ...harm, damage, horror }
  },

  // -------------------------------------------------------------------------
  // 混乱标记 / 检定
  // -------------------------------------------------------------------------
  resolveChaosToken(state, inv, token, api) {
    if (token === 'cultist') uadCultistReveal(state, inv, api)
    return uadChaosToken(state, inv, token, api)
  },

  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    if (!result) return
    const drawn = (result.drawn || []).filter(token => !(result.cancelledTokens || []).includes(token))
    const failed = !result.success
    if (!failed) return
    if (drawn.includes('tablet')) {
      const locals = state.enemies.filter(enemy =>
        enemy.location === inv.location && traitsOf(enemy).some(trait => String(trait).toLowerCase() === 'spectral'))
      if (locals.length) {
        const target = locals[0]
        api?.attack?.(target, inv)
        api?.info?.(`石板失败：所在地点的幽灵敌人「${target.name}」攻击你（不论是否横置）。`)
      }
    }
    if (drawn.includes('elderthing') && state.skillTest?.actionKind === 'circle') {
      if (typeof api?.haunted === 'function') api.haunted(inv.seat, { locationId: inv.location })
      api?.info?.('古神标记失败：结算你所在地点的所有闹鬼能力。')
    }
  },

  afterChaosBagSetup(state) {
    const records = recordsFor(state)
    const heretics = records.hereticsWereUnleashedUntoArkham === true ? 1
      : Number(records.hereticsWereUnleashedUntoArkham) || 0
    if (heretics > 0) {
      state.doom = (state.doom || 0) + heretics
      setFlags(state, { startingDoom: heretics })
    }
  },

  // -------------------------------------------------------------------------
  // 诡计（本章 5 张；共享组诡计回落到 W-shared 的单条条目）
  // -------------------------------------------------------------------------
  resolveEncounter(state, inv, treachery, api) {
    const code = String(original(treachery))
    if (code === TREACHERY_CODES.eagerForDeath) {
      const difficulty = 2 + (Number(inv.damage) || 0)
      api?.test?.(inv.seat, 'willpower', difficulty, result => {
        if (result?.success) return
        api.horror?.(inv.seat, 2)
        api.info?.('渴望死亡：检定失败，受到 2 点恐惧。')
      }, 0, { label: '渴望死亡', code })
      return false
    }
    if (code === TREACHERY_CODES.psychopompsSong || code === TREACHERY_CODES.deathApproaches) {
      inv.threat ||= []
      if (!inv.threat.some(card => original(card) === code)) {
        inv.threat.push({ id: `threat:${code}`, code, originalCode: code, name: ALL_CARDS[code]?.nameZh || code })
      }
      api?.info?.(`「${ALL_CARDS[code]?.nameZh || code}」进入 ${inv.name} 的威胁区域。`)
      return false
    }
    if (code === TREACHERY_CODES.markedForDeath) {
      const difficulty = 2 + (Number(inv.horror) || 0)
      api?.test?.(inv.seat, 'agility', difficulty, result => {
        if (result?.success) return
        api.damage?.(inv.seat, 2)
        api.info?.('死亡记号：检定失败，受到 2 点伤害。')
      }, 0, { label: '死亡记号', code })
      return false
    }
    if (code === TREACHERY_CODES.watchersGaze) {
      for (const target of activeInvestigators(state)) {
        api?.test?.(target.seat, 'willpower', 5, result => {
          if (result?.success) return
          const watcher = watcherOf(state)
          const watcherLocation = watcher?.location
          const options = [{ id: 'here', label: '结算你所在地点的闹鬼能力' }]
          if (watcherLocation) options.push({ id: 'watcher', label: '结算幽灵看守人所在地点的闹鬼能力' })
          let answer = options[0].id
          if (typeof api?.choose === 'function') {
            answer = api.choose({
              kind: 'treachery', source: TREACHERY_CODES.watchersGaze, seat: target.seat,
              prompt: '看守人的注视：检定失败，选择结算哪个地点的闹鬼能力。', options,
            })
          }
          const locationId = answer === 'watcher' ? watcherLocation : target.location
          if (typeof api?.haunted === 'function' && locationId) api.haunted(target.seat, { locationId })
          api?.info?.('看守人的注视：结算闹鬼能力。')
        }, 0, { label: '看守人的注视', code })
      }
      return false
    }
    const entryResolve = encounterResolveFor(code)
    if (entryResolve) return entryResolve(state, inv, treachery, api, { location: here(state, inv) })
    api?.info?.(`（共享遭遇「${ALL_CARDS[code]?.nameZh || code}」由战役共享条目结算。）`)
    return false
  },

  // -------------------------------------------------------------------------
  // 结局
  // -------------------------------------------------------------------------
  resolution(state, key, events, api) {
    const records = recordsFor(state)
    const known = ['noResolution', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10']
    if (!known.includes(key)) throw new Error(`未知聚合幻灭结局：${key}`)
    if (key === 'noResolution') return this.resolution(state, 'r5', events, api)
    if (key === 'r1') {
      const canSideWithLodge = Boolean(records.theInvestigatorsWereInductedIntoTheInnerCircle)
        && !records.theInvestigatorsAreDeceivingTheLodge
      let answer = canSideWithLodge ? 'yes' : 'no'
      if (typeof api?.choose === 'function' && canSideWithLodge) {
        answer = api.choose({
          kind: 'resolution', source: '05247', seat: state.campaign?.leadSeat ?? 0,
          prompt: '桑福德宣称他欺骗了魔鬼：你们相信他吗？',
          options: [
            { id: 'yes', label: '是的，我们忠于秘社。' },
            { id: 'no', label: '不，我们站在女巫一边。' },
          ],
        })
      }
      return this.resolution(state, answer === 'yes' ? 'r2' : 'r3', events, api)
    }
    if (key === 'r2') {
      records.theTrueWorkOfTheSilverTwilightLodgeHasBegun = true
      api?.info?.('银暮秘社的真正计划开始实行：秘社胜利（战役结束流程由 P9 接线）。')
      return { award: true, bonus: 0 }
    }
    if (key === 'r3') return recordSanfordAndConclusion(state, events, api, this)
    if (key === 'r4') return recordAnetteAndConclusion(state, events, api, this)
    if (key === 'r5') {
      const spellCast = Boolean(records.theWitchesSpellWasCast)
      const josefDisappeared = Boolean(records.josefDisappearedIntoTheMist)
      const heretics = records.hereticsWereUnleashedUntoArkham === true ? 1
        : Number(records.hereticsWereUnleashedUntoArkham) || 0
      const firstGroup = [not(spellCast), not(josefDisappeared), heretics <= 1].filter(Boolean).length
      api?.info?.(`结局 5：第一组属实 ${firstGroup} 项（法术被破坏=${!spellCast}、约瑟夫得救=${!josefDisappeared}、异端者≤1=${heretics <= 1}）。`)
      return this.resolution(state, firstGroup >= 2 ? 'r6' : 'r7', events, api)
    }
    if (key === 'r6') return recordSanfordAndConclusion(state, events, api, this)
    if (key === 'r7') return recordAnetteAndConclusion(state, events, api, this)
    if (key === 'r8') return resolution8(state, events, api, records)
    if (key === 'r9') {
      records.theCovenOfKeziahHoldsTheWorldInItsGrasp = true
      api?.info?.('女巫集会掌控世界：女巫集会胜利（战役结束流程由 P9 接线）。')
      return { award: true, bonus: 0 }
    }
    if (key === 'r10') return recordAnetteAndConclusion(state, events, api, this)
    throw new Error(`未知聚合幻灭结局：${key}`)
  },
}

// ---------------------------------------------------------------------------
// 内部函数
// ---------------------------------------------------------------------------
const not = value => !value

function idOfIsle(code) {
  const entry = Object.entries(UNVISITED_ISLES).find(([, value]) => value === code)
  return entry ? entry[0] : code
}

function spawnPrinted(state, api, code, locationId) {
  const card = ALL_CARDS[code] || {}
  const printed = state.scenario?.enemies?.[code] || {}
  if (typeof api?.spawnStoryEnemy === 'function') {
    return api.spawnStoryEnemy(code, locationId, {
      name: card.nameZh || card.name || code,
      fight: printed.fight ?? card.fight ?? 0, evade: printed.evade ?? card.evade ?? 0,
      health: printed.health ?? card.health ?? 1,
      damage: printed.damage ?? card.damage ?? 0, horror: printed.horror ?? card.horror ?? 0,
      hunter: Boolean(printed.hunter), alert: Boolean(printed.alert),
      retaliate: Boolean(printed.retaliate), aloof: Boolean(printed.aloof),
      traits: printed.traits || traitsOf(card),
    }, {})
  }
  return api?.spawn?.(code, locationId) || null
}

function revealGeistTrapAndGather(state, api) {
  const trap = locByCode(state, GEIST_TRAP)
  if (!trap) placeUnrevealedLocation(state, api, 'geistTrap', { lit: factionOf(state) === 'coven' })
  const target = locByCode(state, GEIST_TRAP)
  if (target && !target.revealed) api?.reveal?.(target.id)
  for (const inv of activeInvestigators(state)) {
    if (ISLE_CODES.includes(String(original(locById(state, inv.location))))) {
      if (target) {
        api?.moveInvestigator?.(inv.seat, target.id)
        if (typeof api?.moveInvestigator !== 'function') inv.location = target.id
      }
      api?.info?.(`${inv.name} 被拉进灵怪陷阱。`)
    }
  }
}

function shuffleAsideIntoDeck(state, api, codes) {
  state.scenarioZones ||= {}
  const aside = (state.scenarioZones.setAside ||= [])
  const moved = []
  for (const code of codes) {
    const index = aside.indexOf(code)
    if (index >= 0) {
      aside.splice(index, 1)
      moved.push(code)
    }
  }
  state.encounterDeck = [...(state.encounterDeck || []), ...moved, ...(state.encounterDiscard || [])]
  state.encounterDiscard = []
  if (typeof api?.shuffle === 'function') state.encounterDeck = api.shuffle(state.encounterDeck)
  api?.info?.(`银暮秘社/女巫集会的卡牌与弃牌堆一起洗入遭遇牌库。`)
}

function dealFateCards(state, api) {
  const cards = state.scenarioFlags?.fateCards || []
  const investigators = activeInvestigators(state)
  if (!cards.length || !investigators.length) return
  // 参考实现：洗混冒险参考牌底的命运卡，按玩家顺序随机发放，直到发完并逐张结算。
  const shuffled = typeof api?.shuffle === 'function' ? api.shuffle(cards) : [...cards]
  for (const [index, fate] of shuffled.entries()) {
    const inv = investigators[index % investigators.length]
    resolveFate(state, api, fate, inv)
  }
}

function findWhippoorwill(state) {
  const zones = ['encounterDeck', 'encounterDiscard']
  for (const zone of zones) {
    const list = state[zone] || []
    for (const [index, code] of list.entries()) {
      if (code === WHIPPOORWILL) return { zone, index, code }
    }
  }
  return null
}

function removeEncounterCard(state, found) {
  if (!found) return
  const list = state[found.zone] || []
  const index = list.indexOf(found.code)
  if (index >= 0) list.splice(index, 1)
}

function apiSafeInfo(state, text) {
  state.scenarioFlags ||= {}
  state.scenarioFlags._log ||= []
  state.scenarioFlags._log.push(text)
}

function apiSafeLoseAction(state, inv) {
  if (state.phase === 'investigation') inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - 1)
  else {
    inv.pendingActionLoss ||= {}
    inv.pendingActionLoss[state.round] = (inv.pendingActionLoss[state.round] || 0) + 1
  }
  state.scenarioFlags ||= {}
  state.scenarioFlags._log ||= []
  state.scenarioFlags._log.push('苔藓阶梯：下一次移动额外花费 1 个行动。')
}

function recordSanfordAndConclusion(state, events, api, behaviorObject) {
  recordsFor(state).carlSanfordPossessesTheSecretsOfTheUniverse = true
  api?.info?.('记录：卡尔·桑福德知晓了宇宙之秘。转至结局 8。')
  return behaviorObject.resolution(state, 'r8', events, api)
}

function recordAnetteAndConclusion(state, events, api, behaviorObject) {
  recordsFor(state).anetteMasonIsPossessedByEvil = true
  api?.info?.('记录：安妮特·梅森被魔鬼附身。转至结局 8。')
  return behaviorObject.resolution(state, 'r8', events, api)
}

function resolution8(state, events, api, records) {
  // 移除机关盒：R8 结算属于本关结局，引擎 api 只有 campaignCardChange。
  const removeCard = (seat, code) => {
    const record = state.campaign?.investigators?.[seat]
    if (!record) return
    if (Array.isArray(record.deck) && record.deck.includes(code)) {
      record.deck = record.deck.filter(item => item !== code)
    }
  }
  for (const inv of state.investigators) removeCard(inv.seat, '05228')
  // 失踪者：还活着 → 任选一位调查员把剧情支援加入牌库；否则记录死亡。
  for (const fate of FATE_LIST) {
    const alive = Boolean(records[fate.alive])
    if (!alive) {
      records[fate.dead] = true
      api?.info?.(`记录：${fate.name}已死亡。`)
      continue
    }
    const candidates = activeInvestigators(state).filter(inv => state.campaign?.investigators?.[inv.seat])
    if (!candidates.length) continue
    let seat = candidates[0].seat
    if (candidates.length > 1 && typeof api?.choose === 'function') {
      const answer = api.choose({
        kind: 'investigator', source: '05265', seat: state.campaign?.leadSeat ?? 0,
        prompt: `选择将「${ALL_CARDS[fate.ally]?.nameZh || fate.name}」剧情支援加入牌库的调查员。`,
        options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
      })
      seat = candidates.some(inv => inv.seat === Number(answer)) ? Number(answer) : seat
    }
    campaignCardChange(state.campaign, seat, fate.ally, 'add', state.scenario.id)
    api?.info?.(`${fate.name}还活着：其剧情支援加入调查员 ${seat + 1} 的牌库（不计入 30 张）。`)
  }
  api?.info?.('结局 8：结算失踪者与经验值（XP 未实现，见 gaps）。')
  return { award: true, bonus: 0 }
}
