// P3 批次 2 的运行时扩展：把 6 个新原语挂到 scenarioRuntime 上。
//
// 只做「纯数据 → 内容层窄接口」的转发，不改变任何既有行为：
// 没有用到这些原语的战役（全部既有循环）调用它们也不会写状态（只读函数不建字段）。
// 口径：docs/-migration-roadmap.md §5.2；账本 primitive-plan.json 的 batch P3-2。

import {
  addCounter, counterAtLeast, counterOf, counterSummary, highestCounter, resetCounter,
  setCounter, setCounterMax,
} from './counters.js'
import { swarmingCount, swarmingCountForText, swarmingSpec } from './swarming.js'
import {
  clearSwarmCards, placeSwarmCards, removeSwarmCard, splitSwarmingDamage, swarmBlockedReason,
  swarmCanBeDefeated, swarmCardsOf, swarmCountOf, swarmHostOf,
} from './swarm.js'
import {
  isVeiledLocation, normalizeVeiledScenario, revealVeiledLocation, shuffleVeiledIntoDeck,
  veiledBlocksInvestigation,
} from './veiled.js'
import {
  addTokenToBag, createTokenBag, infestedCount, isInfestedLocation, markInfested, clearInfested,
  resetTokenBag, returnTokenToBag, revealTokenFromBag, tokenBagInfo,
} from './token-bag.js'
import { chainNeighbors, linkVerticalChain, moveAlongChain, orderVerticalChain } from './vertical-chain.js'

export function scenarioRuntimeExtras(state) {
  return {
    // 按调查员的计数器（警报等级 / 赏金）
    counters: {
      get: (seat, id) => counterOf(state, seat, id),
      set: (seat, id, value, options) => setCounter(state, seat, id, value, options),
      add: (seat, id, delta = 1, options) => addCounter(state, seat, id, delta, options),
      max: id => counterSummary(state, id, state.numInvestigators || 0),
      highestOf: id => highestCounter(state, id),
      atLeast: (seat, id, threshold) => counterAtLeast(state, seat, id, threshold),
      setMax: (id, max) => setCounterMax(state, id, max),
      reset: id => resetCounter(state, id),
    },
    // Swarming X 求值（薄封装；放置见 swarm）
    swarming: {
      spec: text => swarmingSpec(text),
      count: (spec, options) => swarmingCount(spec, options),
      countForText: (text, options) => swarmingCountForText(state, text, options),
    },
    // 蜂拥卡放置 / 清空 / 击败判定（draw 由内容层注入，默认遭遇牌库顶）
    swarm: {
      place: (host, count, options) => placeSwarmCards(state, host, count, options),
      cardsOf: host => swarmCardsOf(host),
      countOf: host => swarmCountOf(host),
      remove: (host, swarmId) => removeSwarmCard(host, swarmId),
      clear: host => clearSwarmCards(host),
      canDefeat: host => swarmCanBeDefeated(host),
      blockedReason: host => swarmBlockedReason(host),
      hostOf: enemy => swarmHostOf(state, enemy),
      splitDamage: (host, damage, remainingHealth) => splitSwarmingDamage(host, damage, remainingHealth),
    },
    // 掩藏地点（未揭示限制 / 翻面 / 洗回）
    veiled: {
      isVeiled: card => isVeiledLocation(card),
      blocksInvestigation: location => veiledBlocksInvestigation(location),
      reveal: id => revealVeiledLocation(state, id),
      shuffleBack: (id, deckKey = 'encounter') => shuffleVeiledIntoDeck(state, id, deckKey),
      validate: scenario => normalizeVeiledScenario(scenario),
    },
    // 蛛群滋生袋（独立 token 袋 + infestation 状态）
    tokenBag: {
      create: (id, tokens) => createTokenBag(state, id, tokens),
      info: id => tokenBagInfo(state, id),
      reveal: (id, options) => revealTokenFromBag(state, id, options),
      add: (id, token) => addTokenToBag(state, id, token),
      return: (id, token) => returnTokenToBag(state, id, token),
      reset: (id, tokens = null) => resetTokenBag(state, id, tokens),
      infestedCount: () => infestedCount(state),
      isInfested: locationId => isInfestedLocation(state, locationId),
      markInfested: locationId => markInfested(state, locationId),
      clearInfested: locationId => clearInfested(state, locationId),
    },
    // 纵向地点链（神秘阶梯 / 大网）
    verticalChain: {
      order: ids => (Array.isArray(ids)
        ? ids.map(id => (state.locations || []).find(location => String(location.id) === String(id))).filter(Boolean)
        : orderVerticalChain(state.locations || [])),
      link: ids => linkVerticalChain(state, ids),
      neighbors: id => chainNeighbors(state, id),
      move: (id, delta) => moveAlongChain(state, id, delta),
    },
  }
}
