// 重返真相幻影 · 章节行为。
//
// 基础章节的梦境前导、确信/疑惑路线、风琴手与结局记录直接复用基础 behavior；这里只覆盖：
//   1. 布置：六组巴黎地点（基础版 + 52041–52046）各随机选一张，另一张移出游戏；
//      两张影中身形（52047）放在一边；
//   2. 52040 背面追加规则：风琴手入场后，把遭遇弃牌堆与两张影中身形洗入遭遇牌库。
import { behavior as baseBehavior } from '../../../thePathToCarcosa/scenarios/aPhantomOfTruth/behavior.js'
import { lowSanitySwapModifier, resolveFigureInTheShadows } from '../../campaign-rules.js'
import { FIGURE_IN_THE_SHADOWS, ORGANIST_CODES } from './definition.js'
import { returnToIntroduction } from '../../story.js'

const original = card => card?.originalCode || card?.code
const ORGANISTS = new Set(ORGANIST_CODES)

function chooseVariant(state, id, helper) {
  const variants = state.scenario.locationVariants[id]
  const chosen = variants[Math.floor(helper.randomValue(state) * variants.length)]
  state.locationVariants[id] = structuredClone(chosen)
  return chosen.originalCode
}

export const behavior = {
  ...baseBehavior,
  id: 'returnToAPhantomOfTruth',
  introduction: returnToIntroduction('aPhantomOfTruth'),

  setupLocations(state, events, helper) {
    const plan = this.setupPlan(state)
    state.scenarioFlags ||= {}
    state.scenarioFlags.route = plan.route
    state.scenarioFlags.organistCode = plan.organistCode
    state.scenarioFlags.actOneAdvancedWith = null
    state.scenarioFlags.figureInTheShadowsShuffled = false
    const otherOrganist = plan.organistCode === '03221' ? '03221b' : '03221'
    state.scenarioZones = {
      setAside: [plan.organistCode, FIGURE_IN_THE_SHADOWS, FIGURE_IN_THE_SHADOWS],
      removed: [otherOrganist],
    }
    // 九组地点变体（基础三组 + 重返六组）各随机选一张；未选中的移出游戏。
    const selectedCodes = []
    const allCodes = []
    for (const [id, variants] of Object.entries(state.scenario.locationVariants)) {
      const codes = variants.map(variant => variant.originalCode)
      allCodes.push(...codes)
      selectedCodes.push(chooseVariant(state, id, helper))
    }
    state.scenarioZones.removed.push(...allCodes.filter(code => !selectedCodes.includes(code)))
    state.acts = plan.actCodes.map(code =>
      structuredClone(state.scenario.acts.find(act => act.originalCode === code)))
    return Object.keys(state.scenario.locations)
  },

  // 52040 背面：风琴手入场后，把遭遇弃牌堆与放在一边的两张影中身形洗入遭遇牌库。
  enemySpawned(state, enemy, api) {
    baseBehavior.enemySpawned?.(state, enemy, api)
    if (!ORGANISTS.has(original(enemy)) || state.scenarioFlags.figureInTheShadowsShuffled) return
    state.scenarioFlags.figureInTheShadowsShuffled = true
    const aside = state.scenarioZones.setAside || []
    const remaining = aside.filter(code => code !== FIGURE_IN_THE_SHADOWS)
    state.scenarioZones.setAside = remaining
    const additions = [...(state.encounterDiscard || []), FIGURE_IN_THE_SHADOWS, FIGURE_IN_THE_SHADOWS]
    state.encounterDiscard = []
    state.encounterDeck = api?.shuffle
      ? api.shuffle([...(state.encounterDeck || []), ...additions])
      : [...(state.encounterDeck || []), ...additions]
    api?.info?.('风琴手入场：遭遇弃牌堆与两张影中身形被洗入遭遇牌库。')
  },

  // 52069 猎食的拜亚基：与剩余神智 4 或以下的调查员交战时交换攻击/躲避值。
  enemyStatModifier(state, enemy, stat, inv) {
    const base = baseBehavior.enemyStatModifier?.(state, enemy, stat, inv) || 0
    return base + lowSanitySwapModifier(state, enemy, stat, inv)
  },

  // 52047 影中身形：按剧本日志的疑惑/确信移动风琴手或结算其猎手关键词。
  resolveEncounter(state, inv, card, api) {
    if (original(card) === FIGURE_IN_THE_SHADOWS) {
      return resolveFigureInTheShadows(state, inv, api, ORGANIST_CODES)
    }
    return baseBehavior.resolveEncounter?.(state, inv, card, api) || false
  },
}
