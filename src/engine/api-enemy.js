import { clearPlayerDiscard, replacePlayerZoneCards } from './player-zones.js'
import { keysOnExit } from './scenario-keys.js'
import { discardHostedAssets } from './hosted-assets.js'
import { enemyCanEnterLocation, protectFromEnemies } from './enemy-entry.js'
// 能力 API · 敌人 / 威胁 / 毁灭写入（Phase 6 · 6d-8，abilityApi 第二批）。
//
// 这一组方法覆盖「敌人与威胁区的写入」：测试修正、阻止攻击、移除/生成敌人、
// 遭遇牌库交互、线索与毁灭的搬运、绑定标记、销毁与放逐。
// 与 api-card.js 同样的工厂形状：createXxxApi(state, events, deps) —— 能力层只拿得到 api，
// 所以必须继续闭包 state / events。

export function createEnemyApi(state, events, deps) {
  const {
    campaignState,
    assetCannotLeavePlay,
    attachCardTo,
    cardName,
    chooseEnemy,
    enemyDef,
    engageEnemy,
    info,
    isChargeAsset,
    leaveAsset,
    newCardInstance,
    randomValue,
    recordResearch,
    shuffle,
    spawnEnemy,
    reactionWindow,
    shuffleEnemyIntoEncounterDeck,
  } = deps

  return {
    protectFromEnemies: (seat, ids, options) => protectFromEnemies(state, seat, ids, options),
    // 批次 3（60483）：该敌人本轮不能攻击指定调查员（读点与剧本 API 同一份 attackProtection）。
    protectFromEnemyAttack: (enemy, seat = state.currentSeat) => {
      const actual = state.enemies.find(candidate => candidate.id === (typeof enemy === 'string' ? enemy : enemy?.id))
      if (!actual || !state.investigators[seat]) return false
      actual.attackProtection ||= {}
      actual.attackProtection[seat] = state.round
      return true
    },
    shuffleEnemyIntoEncounterDeck: (enemy, options) => shuffleEnemyIntoEncounterDeck(state, enemy, options, events),
    moveEnemyToEncounterBottom: (enemy, options) => shuffleEnemyIntoEncounterDeck(state, enemy, { ...options, toBottom: true }, events),
    enemyTestModifier: (enemy, spec = {}) => {
      if (!enemy) return enemy
      return campaignState.setEnemyTestModifier(enemy, state, spec)
    },
    // Phase 5（5c）：「本阶段非精英敌人不攻击」（内讧）。
    preventNonEliteAttacks: (seat = state.currentSeat, { until = 'enemyPhase' } = {}) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      if (until === 'endOfRound') { owner.onTheLam = true; return true }
      owner.infighting = { round: state.round, phase: 'enemy' }
      return owner.infighting
    },
    // Phase 5（5c）：把敌人移出游戏（不经过伤害）与把卡洗回遭遇牌库（「劝服」）。
    removeEnemy: (enemy, { seat = null } = {}) => {
      if (!state.enemies.includes(enemy)) return enemy
      if (deps.replaceEnemyLeaveDestination(state, enemy, events)) {
        deps.discardEnemyCard(state, enemy, events, { destinationReplaced: true, seat })
        return enemy
      }
      deps.returnBondedEnemyAttachments(state, enemy)
      deps.clearEnemyAssetHost(state, enemy)
      keysOnExit(state, `enemy:${enemy.id}`, enemy.location, seat)
      if (enemy.hostId) { returnSwarmCard(state, enemy); return enemy }
      for (const member of swarmGroup(state, enemy).slice(1)) returnSwarmCard(state, member)
      for (const inv of state.investigators) inv.engaged = inv.engaged.filter(id => id !== enemy.id)
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) {
        discardHostedAssets(state, enemy, (owner, code) => owner.discard.push(code), { keepAssets: true })
        state.enemies.splice(index, 1)
      }
      return enemy
    },
    shuffleIntoEncounterDeck: code => {
      state.encounterDeck = shuffle([...state.encounterDeck, code], () => randomValue(state))
      return state.encounterDeck.length
    },
    shuffleIntoEncounterDeckTop: (code, count) => {
      const size = Math.min(state.encounterDeck.length, Math.max(0, Math.trunc(count)))
      const top = state.encounterDeck.splice(state.encounterDeck.length - size, size)
      state.encounterDeck.push(...shuffle([...top, code], () => randomValue(state)))
      return true
    },
    // Phase 5（5c-10）：这张正在结算的事件是否来自弃牌堆（临时武器 / 应急处理）。
    fromDiscardCode: () => state._fromDiscardCode || null,
    shuffleDiscardIntoDeck: (seat = state.currentSeat) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      owner.deck = replacePlayerZoneCards(state, owner, shuffle([...owner.deck, ...owner.discard], () => randomValue(state)), 'shuffle')
      clearPlayerDiscard(owner)
      return owner.deck.length
    },
    // Phase 5（5c-23）：「追猎」——遭遇牌库顶 N 张里的敌人候选（只读，顺序按牌库顶在数组末位）。
    preventEnemyDamage: (enemy, { duration = 'endOfRound' } = {}) => {
      if (duration !== 'endOfRound' || !state.enemies.includes(enemy)) return false
      enemy.preventDamageRound = state.round
      return true
    },
    encounterEnemies: (count = 9, { nonElite = false } = {}) => {
      const deck = state.encounterDeck || []
      const size = Math.min(Math.max(0, Math.trunc(count)), deck.length)
      return deck.slice(deck.length - size).filter(code => {
        const definition = enemyDef(code)
        return definition && (!nonElite || (!definition.elite
          && !definition.traits?.some(trait => trait.toLowerCase() === 'elite')))
      })
    },
    shuffleEncounterDeck: () => {
      state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
    },
    // Phase 5（5c-23）：从遭遇牌库取一张敌人放到该座位所在地点、洗回牌库并交战。
    spawnEncounterEnemy: (seat, code, { ignoreSpawn = false } = {}) => {
      const owner = state.investigators[seat]
      if (!owner || !code) return null
      const index = state.encounterDeck.lastIndexOf(code)
      if (index < 0) return null
      state.encounterDeck.splice(index, 1)
      state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
      const spawned = spawnEnemy(state, code, owner.location, seat, ignoreSpawn, false, seat, { forceEngage: ignoreSpawn })
      if (spawned && spawned.location === owner.location && spawned.engagedSeat !== seat) engageEnemy(state, spawned, seat, events)
      return spawned
    },
    searchAndSpawnEnemy: (seat, { nonElite = false, exhausted = false, engage = false, source = null, onSpawn = null } = {}) => {
      const owner = state.investigators[seat]
      if (!owner || owner.defeated || owner.resigned || state.scenario?.mechanics?.noEncounterDeck) return null
      const searched = reactionWindow(state, 'searchWouldResolve', {
        when: 'searchWouldResolve', seat, location: owner.location, zone: 'encounterDeck',
        count: state.encounterDeck.length, choose: 1, source, extraCards: 0, extraTargets: 0,
      }, events, { allowNested: true })
      if (searched.cancelled) return null
      let first = null
      const attempts = 1 + Math.max(0, searched.extraTargets || 0)
      for (let count = 0; count < attempts; count++) {
        const candidates = ['encounterDeck', 'encounterDiscard'].flatMap(pile =>
          [...new Set(state[pile])].flatMap(code => {
            const def = enemyDef(code)
            if (!def || (nonElite && (def.elite || def.traits?.some(trait => trait.toLowerCase() === 'elite')))
              || !enemyCanEnterLocation(state, { code, originalCode: def.originalCode || code }, owner.location)) return []
            return [{ id: `${pile}:${code}`, pile, code, def }]
          }))
        if (!candidates.length) break
        const id = candidates.length === 1 ? candidates[0].id : deps.requestChoice(state, {
          kind: 'search', source, seat, prompt: '从遭遇牌库和遭遇弃牌堆选择一个敌人。',
          options: candidates.map(({ id, pile, code }) => ({
            id, cardCode: code, label: `${cardName(code)}（${pile === 'encounterDeck' ? '遭遇牌库' : '遭遇弃牌堆'}）`,
          })),
        })
        const picked = candidates.find(item => item.id === id)
        if (!picked) break
        const pile = state[picked.pile]
        const index = pile.lastIndexOf(picked.code)
        if (index < 0) break
        pile.splice(index, 1)
        const enemy = spawnEnemy(state, picked.code, owner.location, engage ? seat : null, true, false, seat,
          { exhausted, forceEngage: engage })
        const spawned = enemy || picked.def
        first ||= spawned
        onSpawn?.(spawned)
      }
      state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
      return first
    },
    // Phase 5（5c-22）：「预警」花 1 个线索并把它放回所在地点（这是卡的代价，不是退还费用）。
    // 三处写入与旧 handler 逐字一致：个人线索 -N、state.clues（各人线索之和）-N、地点线索 +N。
    spendClueToLocation: (seat, amount = 1) => {
      const owner = state.investigators[seat]
      const location = state.locations.find(item => item.id === owner?.location)
      if (!owner || !location || (owner.clues || 0) < amount) return 0
      return deps.placeCluesOnLocation(state, owner, amount, events)
    },
    // Phase 5（5c-30）：「骷髅钥匙」把支援附属到所在地点（可带声明式字段，如 shroudAsOne）。
    attachSelfToLocation: (card, locationId, fields = {}) => {
      const owner = state.investigators.find(person => (person.assets || []).includes(card))
      const location = state.locations.find(item => item.id === locationId)
      if (!owner || !location || !card) return null
      leaveAsset(state, owner, card, events)
      return attachCardTo(state, owner.seat, card.code, location, fields)
    },
    // Phase 5（5c-29）：「古代雕文」这类卡要把「研究记录」写进战役账本。
    recordResearch: key => {
      if (!key) return false
      recordResearch(state, key)
      return true
    },
    // Phase 5（5c-29）：支援的充能类型（`usesType`）也要能由内容层声明。
    setUsesType: (card, type) => {
      if (!card || !type) return null
      card.usesType = type
      return card.usesType
    },
    // Phase 5（5c-28）：充能支援的判定与「能不能离场」——「灵语人 / 愤怒之灵」这类卡的候选筛选。
    isChargeAsset: card => isChargeAsset(card),
    canLeavePlay: card => !assetCannotLeavePlay(card),
    // Phase 5（5c-27）：「掩埋」——把刚击败的非精英敌人与这张事件卡一起放进胜利区。
    buryEnemyInVictory: (enemy, eventCode) => {
      if (!enemy || enemy.elite) return false
      const originalCode = enemy.originalCode || enemy.code
      const owner = state.investigators[enemy.bearerSeat]
      const piles = owner ? [owner.discard, state.encounterDiscard] : [state.encounterDiscard]
      for (const pile of piles) {
        const index = pile.lastIndexOf(enemy.code)
        if (index >= 0) { pile.splice(index, 1); break }
      }
      if (!state.victoryDisplay.some(card => card.id === enemy.id)) {
        state.victoryDisplay.push({ id: enemy.id, code: enemy.code, originalCode, victory: enemy.victory || 0 })
      }
      // 事件卡本身也进胜利区：处置段读的是反应上下文里的 eventToVictory。
      if (state._reaction) state._reaction.eventToVictory = eventCode
      if (eventCode) info(state, events, `「${cardName(eventCode)}」将「${enemy.name}」和自身加入胜利区。`)
      return true
    },
    // Phase 5（5c-26）：「暗示」这类「先选敌人、再按某个技能躲避」的能力。
    // 与 effectError / validateMove 共用同一份 abilityTargets（旧实现就是 chooseEnemy）。
    chooseEnemy: (seat, effect = {}) => chooseEnemy(state, seat, effect),
    // Phase 5（5c-25）：调查员级的「本局一次」标记（读点就是 inv.gameFlags，随存档往返）。
    gameFlag: (seat, key) => Boolean(state.investigators[seat]?.gameFlags?.[key]),
    setGameFlag: (seat, key, value = true) => {
      const owner = state.investigators[seat]
      if (!owner) return false
      owner.gameFlags ||= {}
      if (value) owner.gameFlags[key] = true
      else delete owner.gameFlags[key]
      return Boolean(value)
    },
    // Phase 5（5c-25）：当前密谋上的毁灭数与移除（「古代遗物」这类卡要读它再写日志）。
    doom: () => state.doom || 0,
    removeDoom: (amount = 1) => {
      const removed = Math.min(amount, state.doom || 0)
      state.doom = (state.doom || 0) - removed
      return removed
    },
    // Phase 5（5c-24）：把正在结算的这张牌**自身**放置入场（「危险预感」这类打出后变成场上卡的事件）。
    putSelfIntoPlay: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner || !code) return null
      const asset = newCardInstance(state, code, { exhausted: false, enteredRound: state.round })
      owner.assets.push(asset)
      return asset
    },
    // Phase 5（5c-24）：从混乱袋随机抽一个标记并封印到这张卡上（随机数走 randomValue，可重放）。
    // 空袋时的兜底与旧实现逐字一致（把 undefined 塞回袋子，等价于无事发生）。
  }
}
import { swarmGroup, returnSwarmCard } from './swarm.js'
