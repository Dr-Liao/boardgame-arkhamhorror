// 能力 API · 通用动作与展示（Phase 6 · 6d-11，abilityApi 收尾）。
//
// abilityApi 的最后一批：通用动作（伤害/恐惧/资源/抽牌/线索/移动/混沌标记/检定入口）、
// 卡牌与地点信息读取、牌堆与牌库操作、若干状态标记。拆完这一批，abilityApi 只剩
// 一个「按域 spread」的装配函数。
//
// 依赖注入同前几批；doFight 是工厂产物，用惰性 thunk 注入避免 TDZ。

import { currentRevelation, investigationFrameRef } from './resolution-scope.js'
import { syncSpellCredit } from './spell-actions.js'
import { setLocationShroudMod } from './location-attachments.js'
import { loseResources as applyResourceLoss } from './resource-loss.js'
import { ignoreLimitForRound } from './limits.js'

export function createMiscApi(state, events, deps) {
  const {
    SKILL_NAMES,
    abilityTargets,
    activeEffects,
    addDoom,
    discardLocked,
    addTrauma,
    aliveInvestigators,
    applyDamage,
    applyHorror,
    assetsCannotReady,
    attachCardTo,
    autoEvadeEnemy,
    canDiscoverClueAt,
    cardDef,
    cardHasTrait,
    cardName,
    checkDefeated,
    createEffect,
    damageEnemy,
    discoverClueAt,
    disengageEnemy,
    discardRandomFromHand,
    drawCards,
    effectiveTraits,
    engageEnemy,
    failedTestResolves,
    finishScenario,
    getHandSize,
    getMaxHealth,
    getStat,
    handSize,
    info,
    isWeaknessCard,
    leaveAsset,
    locName,
    // 2026-10-28：地点特性原语与地点帷幕临时修正（location-traits.js / locations.js）。
    locationTraits,
    newCardInstance,
    newPlayerAssetInstance,
    performTest,
    placeCluesOnLocation,
    playCost,
    playedEffect,
    randomValue,
    relocateEnemy,
    relocateInvestigator,
    removeCardByCode,
    removeOne,
    requestChoice,
    returnAssetToHand,
    searchTop,
    shuffle,
    tokenLabel,
    unique,
    // 第 122 轮（第 4 批收尾）：照明弹的搜索入场与杜克的移动目的地点需要这两个引擎入口。
    triggerReaction,
    investigatorMoveDestinations,
    doResign,
    doFightRaw,
    playCardFromDiscardForced,
    playCardFromOtherHandForced,
    // 第 5 步 P6：治疗恐惧的统一入口 / 资源寄存 / 取消记账（都要能开窗口）。
    healHorrorFrom,
    resourceBank,
    hunchDeck,
    reactionWindow,
    noteCardCancelled,
    getMaxSanity,
    privateInfo,
    // 2026-10-25 第五轮修复 05186。
    registeredEntry,
    // 2026-10-25 第五轮：通用读点（敌人运行期修正 / 地点帷幕 / 显现作用域）。
    scenarioRuntime,
    extendHealHorror,
  } = deps

  const doFight = (...args) => doFightRaw(...args)

  // 卡上毁灭标记的唯一写点（setAssetDoom / removeDoomFromCard 共用）：
  // 移除到阈值以下时回收未使用的法术额度（05006）。
  const setCardDoom = (card, amount) => {
    if (!card) return 0
    const before = card.doom || 0
    card.doom = Math.max(0, amount)
    if (card.doom < before) {
      const owner = (state.investigators || []).find(inv => (inv.assets || []).includes(card))
      if (owner) syncSpellCredit(state, owner)
    }
    return card.doom
  }

  return {
    info: text => info(state, events, text),
    // 「撤退」类事件/能力的统一入口（02151 “我要走了！”）。
    resign: seat => doResign(state, seat, events),
    random: () => randomValue(state),
    // 剧本标记（state.scenarioFlags）的读写：卡文件不直接写 state（审计 R1），统一走这里。
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    setScenarioFlag: (key, value = true) => {
      state.scenarioFlags ||= {}
      if (value === undefined || value === null) delete state.scenarioFlags[key]
      else state.scenarioFlags[key] = value
      return state.scenarioFlags[key] ?? null
    },
    choice: options => requestChoice(state, options),
    // 兼容别名（2026-10-28 收口）：遭遇侧内容历史上用 `choose`，玩家侧用 `choice`。
    // 两者最终都落到同一个 requestChoice；canonical 名字是 `choice`，新卡只用 `choice`。
    choose: options => requestChoice(state, options),
    damage: (seat, amount) => applyDamage(state, state.investigators[seat], amount, events),
    horror: (seat, amount) => applyHorror(state, state.investigators[seat], amount, events),
    directDamage: (seat, amount) => applyDamage(state, state.investigators[seat], amount, events, true),
    directHorror: (seat, amount) => applyHorror(state, state.investigators[seat], amount, events, true),
    healDamage: (seat, amount) => {
      const inv = state.investigators[seat]
      if (inv) inv.damage = Math.max(0, (inv.damage || 0) - amount)
    },
    // 第 5 步 P6：治疗恐惧走统一入口（治疗支援时 owner 是控制者），
    // 这样「在你的卡牌效果治愈恐惧后」的反应有一个事后窗口，且「理性思考」的承接规则只有一处。
    healHorror: (seat, amount, options = {}) => {
      const inv = state.investigators[seat]
      if (inv) healHorrorFrom(state, inv, amount, events, options)
    },
    gainResources: (seat, amount) => {
      const inv = state.investigators[seat]
      // 第 5 步 P6：卡牌效果获得的资源可能被「家族遗产」寄存（resourceBank 规则）。
      if (inv) resourceBank.gainResource(state, inv, amount, events)
    },
    // 2026-10-25 第七轮修复 05003/05011：资源寄存 v2 读写点。
    bankResources: (seat, amount) => {
      const inv = state.investigators[seat]
      return inv ? resourceBank.bankResources(state, inv, amount, events) : 0
    },
    bankedResources: target => {
      const inv = Number.isInteger(target) ? state.investigators[target]
        : (target?.seat != null ? state.investigators[target.seat] : target)
      return inv ? resourceBank.bankedOf(inv) : 0
    },
    withdrawBanked: (seat, amount) => {
      const inv = state.investigators[seat]
      return inv ? resourceBank.withdrawBanked(state, inv, amount, events) : 0
    },
    spendBanked: (seat, amount) => {
      const inv = state.investigators[seat]
      return inv ? resourceBank.spendBanked(state, inv, amount, events) : 0
    },
    availableResources: target => {
      const inv = Number.isInteger(target) ? state.investigators[target]
        : (target?.seat != null ? state.investigators[target.seat] : target)
      return inv ? (inv.resources || 0) : 0
    },
    spendResources: (seat, amount) => {
      const inv = state.investigators[seat]
      return inv ? resourceBank.spendResources(state, inv, amount, events) : 0
    },
    // 第 5 步 P6：资源寄存的两条卡面读写点（家族遗产）。
    resourceBank: {
      bankedOf: inv => resourceBank.bankedOf(inv),
      withdraw: inv => resourceBank.withdrawAll(state, inv, events),
    },
    // 2026-10-25：卡面描述子可读的神智上限（05114「剩余神智值」按修正后上限计算）。
    maxSanity: seat => {
      const inv = state.investigators[seat]
      return inv ? getMaxSanity(inv) : 0
    },
    // 2026-10-25：05319「查看另一位调查员手牌」的私密投影（只对该座位可见，不进公开日志）。
    privateInfo: (seat, text, presentation = null) => privateInfo(state, events, seat, text, presentation),
    // 第 5 步 P6：直觉牌库的两条卡面读写点（乔·戴蒙德的旧印）。
    hunchDeck: {
      insightsInDiscard: inv => hunchDeck.insightsInDiscard(inv),
      moveToBottom: (inv, code) => hunchDeck.moveToBottom(state, inv, code, events),
    },
    loseResources: (seat, amount) => {
      const inv = state.investigators[seat]
      if (!inv || !(amount > 0)) return 0
      return applyResourceLoss(state, inv, amount, { reactionWindow, events, info })
    },
    // 2026-10-25：05280 的「失去行动」面向。卡面把「弃手牌/失资源/失行动/受伤/受恐惧」
    // 统一成同一个替换效果；窗口名与 what 字段供条目按面向分派。
    loseActions: (seat, amount) => {
      const inv = state.investigators[seat]
      if (!inv || !(amount > 0)) return 0
      const context = reactionWindow(state, 'wouldLoseActions', {
        when: 'wouldLoseActions', seat: inv.seat, amount, what: 'actions', location: inv.location,
        source: { kind: state._enemyAttackResolving ? 'enemyAttack' : state._treacheryResolving ? 'encounter' : 'other' },
        prompt: `${inv.name} 将要失去 ${amount} 个行动`,
      }, events)
      if (context.cancelled) {
        info(state, events, `🛡️ ${inv.name} 忽略了失去行动的效果。`)
        return 0
      }
      const lost = Math.min(inv.actionsLeft || 0, amount)
      inv.actionsLeft = Math.max(0, (inv.actionsLeft || 0) - lost)
      return lost
    },
    drawCards: (seat, amount) => drawCards(state, state.investigators[seat], amount, events),
    // Phase 5（5c-18）：抽牌并把引擎的抽牌日志写进事件流。
    // 「扒手」这类旧 handler 自己遍历 drawCards 的返回值打日志，走 api.drawCards 会丢掉
    // 「抽取了 1 张牌」这行——它进 state.log 也进重放指纹，因此需要一个同源的带日志版本。
    drawCardsLogged: (seat, amount) => {
      const texts = drawCards(state, state.investigators[seat], amount, events)
      for (const text of texts) info(state, events, text)
      return texts.length
    },
    discardFromHand: (seat, code) => {
      const inv = state.investigators[seat]
      const index = inv?.hand.indexOf(code)
      if (index == null || index < 0) return false
      inv.hand.splice(index, 1)
      inv.discard.push(code)
      return true
    },
    // 2026-10-25：05152「所附属支援被弃掉后：把该支援与其升级附属返回各自所有者手牌」。
    // 标记 returnedToHand 让后续弃牌守卫跳过；升级（attachments）一并返回。
    returnAssetAndAttachmentsToHand: (seat, asset, options = {}) => {
      const controller = state.investigators[seat]
      if (!controller || !asset) return false
      // 2026-10-25 第六轮修复 05152：options 支持 onlyUpgrades（只返回 [[Upgrade]] 附属）、
      // byOwnerSeat（各归其所有者手牌，而不是全部给控制器）。
      const label = cardName(asset.code)
      const targets = []
      const mainOwner = options.byOwnerSeat && Number.isInteger(asset.ownerSeat)
        ? (state.investigators[asset.ownerSeat] || controller) : controller
      targets.push({ code: asset.code, owner: mainOwner })
      for (const attachment of asset.attachments || []) {
        if (!attachment?.code) continue
        const traits = cardDef(attachment.code)?.traits || []
        if (options.onlyUpgrades && !traits.some(trait => String(trait).toLowerCase() === 'upgrade')) continue
        const owner = options.byOwnerSeat && Number.isInteger(attachment.ownerSeat)
          ? (state.investigators[attachment.ownerSeat] || controller) : controller
        targets.push({ code: attachment.code, owner })
      }
      for (const { code, owner } of targets) {
        if (owner && !(owner.hand || []).includes(code)) owner.hand.push(code)
      }
      asset.returnedToHand = true
      const countText = targets.length > 1 ? `及其 ${targets.length - 1} 张附属` : ''
      info(state, events, `♻️ ${controller.name} 把「${label}」${countText}返回手牌。`)
      return true
    },
    // 2026-10-25 第七轮修复 05021：把能力来源卡从当前区域移入其所有者弃牌堆（assets/attachments/threat）。
    discardSelf: (code = null) => {
      const targetCode = code || state._resolvingCardCode
      if (!targetCode) return false
      for (const owner of state.investigators || []) {
        const asset = (owner.assets || []).find(item => item.code === targetCode)
        if (asset) {
          leaveAsset(state, owner, asset, events)
          if (!asset.returnedToHand && !asset.removedFromGame) owner.discard.push(asset.code)
          info(state, events, `「${cardName(targetCode)}」被弃掉。`)
          return true
        }
      }
      for (const owner of state.investigators || []) {
        const attachments = owner.attachments || []
        const index = attachments.findIndex(item => item.code === targetCode)
        if (index < 0) continue
        const [attachment] = attachments.splice(index, 1)
        const discardOwner = state.investigators[Number.isInteger(attachment.ownerSeat) ? attachment.ownerSeat : owner.seat] || owner
        discardOwner.discard.push(targetCode)
        info(state, events, `「${cardName(targetCode)}」被弃掉。`)
        return true
      }
      for (const owner of state.investigators || []) {
        const index = (owner.threat || []).findIndex(item => item.code === targetCode)
        if (index < 0) continue
        owner.threat.splice(index, 1)
        owner.discard.push(targetCode)
        info(state, events, `「${cardName(targetCode)}」被弃掉。`)
        return true
      }
      return false
    },
    // 2026-10-25 第七轮修复 05235：强制从弃牌堆打出事件（结算后可从游戏移除）。
    playCardFromDiscard: (seat, code, options = {}) =>
      playCardFromDiscardForced(state, seat, code, events, options),
    // 第三个参数用于「发现任意地点的线索」（02224）：判定仍按目标地点走剧情的 canDiscoverClues。
    discoverClue: (seat, amount = 1, locationId = null) =>
      discoverClueAt(state, state.investigators[seat], amount, events, { locationId: locationId ?? undefined }),
    canDiscoverClueAt: (seat, locationId) =>
      canDiscoverClueAt(state, state.investigators[seat], state.locations.find(loc => loc.id === locationId)),
    placeClues: (seat, amount = 1) => placeCluesOnLocation(state, state.investigators[seat], amount, events),
    // 05016「我不会再逃了！」：本回合躲避成功可改为造成伤害（读点 combat.js 的 evadeDamageInsteadRound）。
    evadeDamageInstead: seat => {
      const inv = state.investigators[seat]
      if (!inv) return false
      inv.evadeDamageInsteadRound = state.round
      return true
    },
    // 05049 佩妮：下个回合额外一次行动（读点 beginInvestigationPhase 的 inv.extraActionNextTurn）。
    grantExtraActionNextTurn: seat => {
      const inv = state.investigators[seat]
      if (!inv) return false
      inv.extraActionNextTurn = true
      return true
    },
    // 05010 悬案：fromHunch 通道打出后清掉直觉牌库揭示标记（读点 hunch-deck 的 returnHunchCard）。
    clearHunchRevealed: seat => {
      const inv = state.investigators[seat]
      if (!inv) return false
      inv.hunchRevealed = null
      return true
    },
    // 05015 可怕的秘密：弱点结算后洗回牌库（deck-ops.js 按 shuffleWeaknessAfterResolution 读点）。
    scheduleWeaknessShuffle: (seat, code) => {
      const inv = state.investigators[seat]
      if (!inv || !code) return false
      inv.shuffleWeaknessAfterResolution = String(code)
      return true
    },
    // 04195 暴露弱点：本阶段下一次对该敌人的攻击攻击值视为 0（combat.js 读点）。
    exposeEnemyWeakness: enemy => {
      if (!enemy) return false
      enemy.exposeWeakness = { round: state.round, phase: state.phase }
      return true
    },
    // 05018 神秘乐曲：本阶段密谋不能因毁灭阈值推进（act-agenda.js 读点）。
    lockAgendaDoomThisPhase: () => {
      state.agendaDoomLock = { round: state.round, phase: state.phase }
      return true
    },
    // 04010 走私货物：本次打出的卡结算后洗回牌库（actions.js 的 _playDisposal 读点）。
    shufflePlayedCardBack: () => {
      state._playDisposal = 'shuffleBack'
      return true
    },
    // 05004 黛安娜：取消效果的那张卡在本次结算结束后压到她底下（reveal.js 的 flushDeferredBeneath 读点）。
    deferCardBeneath: (seat, code) => {
      if (!code) return false
      state.deferredBeneath = [...(state.deferredBeneath || []), { seat, code }]
      return true
    },
    // 03038 藏身地点：已在场的非精英敌人立即获得藏身地点提供的冷漠（敌人移动/入场时由引擎重算）。
    grantHidingSpotAloof: enemy => {
      if (!enemy || enemy.elite) return false
      enemy.hidingSpotAloof = true
      enemy.aloof = true
      return true
    },
    clearEnemyAloof: enemy => {
      if (!enemy) return false
      enemy.aloof = false
      return true
    },
    moveInvestigator: (seat, locationId) => relocateInvestigator(state, seat, locationId, events),
    damageEnemy: (enemy, amount, seat, source = null) => damageEnemy(state, enemy, amount, seat, events, source),
    // 敌人自愈（狼人德鲁这类「攻击时治愈 1 点伤害」）。只改实例，不触发击败/胜利结算。
    healEnemy: (enemy, amount = 1) => {
      const target = typeof enemy === 'string' ? state.enemies.find(item => item.id === enemy) : enemy
      if (target) target.damageTaken = Math.max(0, (target.damageTaken || 0) - amount)
    },
    moveEnemy: (enemy, locationId) => relocateEnemy(state, enemy, locationId, events),
    engage: (enemy, seat) => engageEnemy(state, enemy, seat, events),
    autoEvade: enemy => autoEvadeEnemy(state, enemy, events),
    exhaust: card => { if (card) card.exhausted = true },
    ready: card => { if (card) card.exhausted = false },
    // 移除一张场上卡上的全部/指定数量毁灭标记（月光仪式这类卡用）。
    setAssetDoom: (card, amount = 0) => setCardDoom(card, amount),
    // 「移除任意卡牌上的 N 个毁灭标记」（04303 古代遗物）：地点 / 敌人 / 支援都走同一条写点。
    removeDoomFromCard: (card, amount = 1) => {
      if (!card) return 0
      const removed = Math.min(Math.max(0, Number(amount) || 0), Number(card.doom) || 0)
      if (!removed) return 0
      setCardDoom(card, (Number(card.doom) || 0) - removed)
      return removed
    },
    addUses: (card, amount) => {
      if (!card) return
      card.uses = (card.uses || 0) + amount
      // 2026-10-25 第五轮修复 05186：条目声明「花费充能/弹药时获得等量资源」。
      if (amount < 0 && registeredEntry(card.code)?.spentUsesGainResources === true) {
        const owner = state.investigators.find(inv => (inv.assets || []).includes(card) || (inv.threat || []).includes(card))
        if (owner) {
          owner.resources = (owner.resources || 0) + (-amount)
          info(state, events, `「${cardName(card.code)}」花费 ${-amount} 个标记：${owner.name} 获得 ${-amount} 资源。`)
        }
      }
    },
    // 2026-10-25 第五轮修复（05281）：把某项技能的基础值临时设为 value（until: 'endOfRound'|'endOfTurn'|'endOfPhase'）。
    setBaseSkillValue: (seat, skill, value, options = {}) => {
      const inv = state.investigators[seat]
      if (!inv || !Object.hasOwn(SKILL_NAMES, skill)) return null
      inv.statOverrides ||= {}
      inv.statOverrides[skill] ||= []
      const entry = { value: Number(value) || 0 }
      if (options.until === 'endOfRound') entry.round = state.round
      else if (options.until === 'endOfTurn') entry.turnSerial = state.turnSerial
      else if (options.until === 'endOfPhase') { entry.round = state.round; entry.phase = state.phase }
      inv.statOverrides[skill].push(entry)
      return entry
    },
    addDoom: (amount = 1) => addDoom(state, amount, events),
    // 2026-10-25 第七轮修复 05158：调查中把目标改到连接地点（可选新/原隐藏值）。
    retargetInvestigation: (locationId, options = {}) => {
      const frame = investigationFrameRef()
      const test = state.skillTest
      if (!frame || !test) return null
      const inv = state.investigators[test.seat]
      const original = state.locations.find(loc => loc.id === frame.locationId)
      const target = state.locations.find(loc => loc.id === locationId)
      if (!target || !original || !target.revealed) return null
      if (!(original.connections || []).includes(locationId)) return null
      const shroudValue = options.shroud === 'original'
        ? (Number(test.difficulty) || 0)
        : (scenarioRuntime(state, events).locationShroud(locationId) ?? (target.shroud + (target.shroudMod || 0)))
      frame.retarget = { locationId, shroudValue }
      test.difficulty = shroudValue
      info(state, events, `🔎 ${inv?.name || '调查员'} 改为在「${target.name}」调查（隐藏值 ${shroudValue}）。`)
      return { locationId, shroudValue }
    },
    // 2026-10-25 第七轮修复 05322：把本次调查变成「原地点 + 所选地点」双地点调查（≤2 连接、已揭示）。
    chooseDualInvestigation: (locationId, options = {}) => {
      const frame = investigationFrameRef()
      const test = state.skillTest
      if (!frame || !test) return null
      const original = state.locations.find(loc => loc.id === frame.locationId)
      const target = state.locations.find(loc => loc.id === locationId)
      if (!target || !original || !target.revealed) return null
      let distance = Infinity
      {
        let frontier = [original.id]
        const seen = new Set(frontier)
        for (let depth = 1; depth <= 3 && distance === Infinity; depth++) {
          const next = []
          for (const id of frontier) {
            const loc = state.locations.find(l => l.id === id)
            for (const conn of loc?.connections || []) {
              if (seen.has(conn)) continue
              seen.add(conn)
              if (conn === locationId) { distance = depth; break }
              next.push(conn)
            }
            if (distance !== Infinity) break
          }
          frontier = next
        }
      }
      if (distance > 2) return null
      const shroudValue = options.shroud === 'original'
        ? (Number(test.difficulty) || 0)
        : (scenarioRuntime(state, events).locationShroud(locationId) ?? (target.shroud + (target.shroudMod || 0)))
      frame.dual = { locationId, shroudValue }
      test.difficulty = shroudValue
      info(state, events, `🔎 ${state.investigators[test.seat]?.name || '调查员'} 同时在「${target.name}」调查（使用隐藏值 ${shroudValue}）。`)
      return { locationId, shroudValue }
    },
    // 2026-10-25 第七轮修复 05033：本次符号效果「取消某个候选 / 让某个候选再结算一次」。
    setSymbolEffect: (effect = null) => {
      if (!state.skillTest) return null
      state.skillTest.symbolEffect = effect || null
      return state.skillTest.symbolEffect
    },
    symbolEffect: () => state.skillTest?.symbolEffect || null,
    // 2026-10-25 第七轮修复 05319：看另一名调查员手牌后，从其手牌打出一张（由本调查员控制/付费）。
    playCardFromOtherHand: (fromSeat, code) =>
      playCardFromOtherHandForced(state, state.currentSeat, fromSeat, code, events),
    // 2026-10-25 第七轮修复 05320：把刚打出的事件「再次打出」（从实际落点取出、完整付费/窗口/目标）。
    replayEventAsHand: (seat, code) =>
      playCardFromDiscardForced(state, Number.isInteger(seat) ? seat : state.currentSeat, code, events, { exileAfter: false }),
    // 2026-10-25 第七轮修复 05040：把「下一次行动期间生效」的持续效果排队（dispatch 在行动开始时挂上）。
    scheduleActionEffects: (records = []) => {
      if (!Array.isArray(records) || !records.length) return 0
      state.pendingActionEffects ||= []
      for (const record of records) if (record) state.pendingActionEffects.push({ ...record })
      return state.pendingActionEffects.length
    },
    // 2026-10-25 第七轮修复 05004：「忽略」路径也可显式记一次取消事实（黛安娜反应读点）。
    noteCancelled: (what = null) => noteCardCancelled(reactionWindow, state, events, { seat: state.currentSeat, what }),
    // 2026-10-25 第七轮修复 05007：向当前 horrorHealed 窗口追加治疗（不新开窗口）。
    extendHealHorror: (seat, amount) => extendHealHorror(state, seat, amount, events),
    // 2026-10-25 第五轮：条目 API 的通用读点。
    addEnemyStatModifier: (enemy, mods, options) => scenarioRuntime(state, events).addEnemyStatModifier(enemy, mods, options),
    locationShroud: locationId => scenarioRuntime(state, events).locationShroud(locationId),
    revelationResolving: () => currentRevelation() != null || Boolean(state._treacheryResolving),
    cancelDoomPlacement: (card, amount = 1) => scenarioRuntime(state, events).cancelDoomPlacement(card, amount),
    // 2026-10-28 P2-6（05005 丽塔·杨的旧印）：「直到本轮结束，忽略某条能力的限制」。
    // 上限本身仍由引擎 limits.js 记账；忽略期间只在同一窗口实例内去重（见 limitUsed）。
    ignoreLimitForRound: descriptorId => ignoreLimitForRound(state, descriptorId),
    // Phase 1（A1）：持续效果的唯一创建接口。修正与能力都从 state.effects 读，
    // 到期由引擎的统一过期点处理，内容层不需要（也不允许）自己记时间戳。
    addEffect: (record, ownerSeat = null) => createEffect(state, {
      ...record,
      controllerSeat: record?.controllerSeat ?? ownerSeat ?? state.currentSeat,
    }),
    effects: () => activeEffects(state),
    addChaosToken: token => { state.chaosBag.push(token) },
    removeChaosToken: token => {
      const index = state.chaosBag.indexOf(token)
      if (index >= 0) state.chaosBag.splice(index, 1)
      return index >= 0
    },
    test: (seat, skill, difficulty, options = {}) => performTest(state, seat, skill, difficulty, options),
    setShroudMod: (location, amount) => setLocationShroudMod(location, amount),    // 2026-10-28：地点特性原语（运行期授予/撤销；连接重算与投影 grantedTraits 由原语统一处理）。
    addLocationTrait: (location, trait, options = {}) => locationTraits.add(state, location, trait, options),
    removeLocationTrait: (location, trait, options = {}) => locationTraits.remove(state, location, trait, options),
    grantedLocationTraits: location => locationTraits.granted(location),
    // 2026-10-28 P2-6：地点交换 / 移出游戏（05125 探访巫宅的地点原语）。
    // 与遭遇面 scenario-runtime 共用同一份实现（src/engine/location-swap.js），这里只是能力面入口。
    swapLocation: (fromId, toId, options = {}) => scenarioRuntime(state, events).swapLocation(fromId, toId, options),
    removeLocationFromGame: (id, options = {}) => scenarioRuntime(state, events).removeLocationFromGame(id, options),
    // 调查员获得特性（04085 伊格的诅咒「获得蛇族特性」）：写 inv.traits，读点 effectiveTraits / 投影。
    addInvestigatorTrait: (seat, trait) => {
      const owner = state.investigators[seat]
      if (!owner || !trait) return false
      owner.traits = [...new Set([...(owner.traits || []), String(trait)])]
      return true
    },
    // 「诱敌深入」：把附属地点标记为敌人本轮的移动目标；回合结束由 turn.js 弃掉。
    setLocationLure: (locationId, seat, code = null) => {
      const location = state.locations.find(item => item.id === locationId)
      if (!location) return false
      location.lure = { seat, round: state.round, code }
      return true
    },
    // 「团队合作」：把一件支援交给同地点的另一名调查员（离场钩子照走，所有权转移）。
    giveAsset: (asset, targetSeat) => {
      const target = state.investigators[targetSeat]
      const owner = state.investigators.find(person => person.assets?.includes(asset))
      if (!asset || !owner || !target || owner === target) return false
      leaveAsset(state, owner, asset)
      target.assets.push(asset)
      return true
    },
    gainAction: (seat, amount = 1) => {
      const inv = state.investigators[seat]
      if (inv) inv.actionsLeft += amount
    },
    finish: key => finishScenario(state, key, events),
    // 查询与检索：内容层不直接读引擎内部实现，只通过这些窄接口。
    cardName: code => cardName(code),
    // Phase 2（C2）：运行期特性读点（含 add:trait 授予），内容层不需要 import 引擎。
    cardTraits: code => cardDef(code)?.traits || [],
    cardIcons: code => ({ ...(cardDef(code)?.icons || {}) }),
    effectiveTraits: code => effectiveTraits(state, state.investigators[state.currentSeat], code),
    locationName: id => locName(state, id),
    // P0：02007/02011/03310 等条目写的是 api.locName；两个名字指向同一读点。
    locName: id => locName(state, id),
    // Phase 5（5c）：卡面印刷数值（恐惧/伤害上限），「治愈支援身上的恐惧」这类卡要用。
    cardSanity: code => cardDef(code)?.sanity || 0,
    cardType: code => cardDef(code)?.type || null,
    // Phase 5（5c）：治愈支援自身承受的伤害/恐惧（「急救」这类卡）。
    healAsset: (card, spec = {}) => {
      if (!card) return card
      card.damage = Math.max(0, (card.damage || 0) - (spec.damage || 0))
      if (spec.horror) {
        // 第 5 步 P6：支援上的恐惧同样走统一入口；owner 由调用方（描述子上下文）给出。
        const owner = spec.owner || state.investigators[spec.ownerSeat ?? state.currentSeat]
        if (owner) healHorrorFrom(state, card, spec.horror, events, { ...spec, owner })
        else card.horror = Math.max(0, (card.horror || 0) - spec.horror)
      }
      return card
    },
    cardFactions: code => {
      const def = cardDef(code)
      return def?.factions || (def?.klass ? [def.klass] : [])
    },
    // Phase 5（5c）：「本回合该敌人的战斗/躲避值 -N」（解剖图）。
    sealRandomChaosToken: card => {
      if (!card) return null
      let token
      if (state.chaosBag.length) {
        token = state.chaosBag.splice(Math.floor(randomValue(state) * state.chaosBag.length), 1)[0]
      }
      if (!token) { state.chaosBag.push(token); return null }
      card.sealedToken = token
      state.chaos.sealed ||= []
      state.chaos.sealed.push({ token, source: card.id })
      state.sealedTokens = state.chaos.sealed.map(entry => entry.token)
      return token
    },
    // Phase 5（5c-24）：混乱标记的展示文案（内容层写日志时用）。
    tokenLabel: token => tokenLabel(token),
    // Phase 5（5c-21）：「以折扣打出另一张牌」的候选筛选——这张牌现在打出去有没有合法目标。
    // 与 effectError / validateMove 用的是同一份 abilityTargets；没有目标要求时恒为真
    // （与旧 handler 的判定一致：`played` 为空也算"可以打"）。
    cardHasLegalTarget: (seat, code) => {
      const owner = state.investigators[seat]
      const played = playedEffect(code)
      if (!owner || !played) return true
      if (played.target === 'enemy' || ['fight', 'evade'].includes(played.type)) {
        return abilityTargets(state, owner, played).length > 0
      }
      return true
    },
    // Phase 5（5c-19）：把控制的一张支援拿回手牌（「求助盟友」）。
    // 离场钩子照常结算（leaveAsset），与旧 handler 的写法一致。
    returnAssetToHand: (seat, card) => {
      const owner = state.investigators[seat]
      if (!owner || !card) return false
      leaveAsset(state, owner, card, events)
      owner.hand.push(card.code)
      return true
    },
    // Phase 5（5c-19）：读牌库顶 N 张的卡号（**只读**，不移动也不洗牌）。
    // 顺序与 `inv.deck.slice(-N)` 相同（末位是牌库顶），筛选逻辑留在内容层。
    topDeckCodes: (seat, count = 1) => {
      const owner = state.investigators[seat]
      if (!owner) return []
      const n = Math.min(Math.max(0, count), owner.deck.length)
      return n > 0 ? owner.deck.slice(-n) : []
    },
    // Phase 5（5c-19）：把牌库里的一张牌附属到场上的一张支援（不占用槽位）。
    attachCardFromDeck: (host, code) => {
      const owner = state.investigators.find(person => (person.assets || []).includes(host))
      if (!owner || !code) return null
      const index = owner.deck.lastIndexOf(code)
      if (index < 0) return null
      owner.deck.splice(index, 1)
      return attachCardTo(state, owner.seat, code, host)
    },
    shuffleDeck: seat => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      owner.deck = shuffle(owner.deck, () => randomValue(state))
      return owner.deck.length
    },
    // Phase 5（5c-9）：检定的「揭示计划」与额外标记数（黑暗预言 / 勇斗异劫）。
    // Phase 5（5c-12）：重试上一次失败的技能检定（学无止境）。
    retryLastFailedTest: (cardLabel, skillBonus = 0) => {
      const failed = state.lastFailedTest
      const active = state.investigators[state.currentSeat]
      if (!failed || failed.seat !== state.currentSeat) {
        info(state, events, '没有可以重新尝试的技能检定。')
        return false
      }
      info(state, events, `🔁 ${active.name} 用「${cardLabel}」重新尝试${SKILL_NAMES[failed.skill]}检定（+${skillBonus}）。`)
      performTest(state, failed.seat, failed.skill, failed.difficulty, {
        source: failed.source, skillBonus, peril: failed.peril, resolve: failedTestResolves.get(state),
      })
      return true
    },
    // Phase 5（5c-12）：这名调查员**下一次**检定不揭示混乱标记（秘籍的主动能力）。
    skipNextTestTokens: seat => {
      const owner = state.investigators[seat]
      if (!owner) return false
      owner.nextTestNoTokens = { round: state.round }
      return true
    },
    // Phase 5（5c-12）：本次检定不揭示混乱标记（秘籍 / 纳克特手稿）。
    skipTestTokens: () => {
      if (!state.skillTest) return false
      state.skillTest.skipTokens = true
      return true
    },
    // 04313 改变命运：枚举「场上」的全部诡计实例（威胁区、地点/敌人/幕/议程的附属）。
    // 返回纯数据视图；真正移除走 discardCardInPlay。
    cardsInPlayTreacheries: () => {
      const out = []
      const codeOf = entry => entry?.originalCode || entry?.code || null
      for (const inv of state.investigators) {
        for (const threat of inv.threat || []) {
          out.push({ code: codeOf(threat), hostType: 'investigator', host: inv, hostId: inv.seat, attachment: threat })
        }
      }
      for (const location of state.locations || []) {
        for (const attachment of location.attachments || []) {
          out.push({ code: codeOf(attachment), hostType: 'location', host: location, hostId: location.id, attachment })
        }
      }
      for (const enemy of state.enemies || []) {
        for (const attachment of enemy.attachments || []) {
          out.push({ code: codeOf(attachment), hostType: 'enemy', host: enemy, hostId: enemy.id, attachment })
        }
      }
      for (const [hostType, hosts] of [['agenda', state.agendas || []], ['act', state.acts || []]]) {
        for (const host of hosts) {
          for (const attachment of host.attachments || []) {
            out.push({ code: codeOf(attachment), hostType, host, hostId: host.id || host.code, attachment })
          }
        }
      }
      return out.filter(entry => entry.code)
    },
    discardCardInPlay: entry => {
      if (!entry?.code) return false
      const removeFrom = list => {
        const index = (list || []).indexOf(entry.attachment)
        if (index >= 0) { list.splice(index, 1); return true }
        return false
      }
      let removed = false
      if (entry.hostType === 'investigator') removed = removeFrom(entry.host?.threat)
      else if (entry.hostType === 'location' || entry.hostType === 'enemy' || entry.hostType === 'agenda' || entry.hostType === 'act') {
        removed = removeFrom(entry.host?.attachments)
      }
      if (!removed) return false
      state.encounterDiscard.push(entry.code)
      info(state, events, `🃏 「${cardName(entry.code)}」从场上被弃掉。`)
      return true
    },
    // Phase 5（5c-17）：把这张支援附属到敌人身上（手铐：横置 + 脱离交战）。
    attachSelfTo: (code, enemyId) => {
      const active = state.investigators[state.currentSeat]
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (!active || !enemy) return false
      const existing = active.assets.find(asset => asset.code === code)
      if (existing) leaveAsset(state, active, existing, events, { keepAttachments: true })
      attachCardTo(state, active.seat, code, enemy)
      enemy.exhausted = true
      disengageEnemy(state, enemy)
      return true
    },
    // Phase 5（5c-16）：卡面费用与"直接放置入场"（发掘古物）。
    cardCost: code => cardDef(code)?.cost ?? 0,
    putAssetIntoPlay: (seat, code) => {
      const owner = state.investigators[seat]
      if (!owner || !cardDef(code)) return false
      if (!removeCardByCode(owner.hand, code)) return false
      owner.assets.push(newPlayerAssetInstance(state, owner, code))
      return true
    },
    // Phase 5（5c-15）：把伤害设为上限并做击败检查（「我会在地狱里见你」这类自我击败）。
    lethalSelfDamage: seat => {
      const target = state.investigators[seat]
      if (!target) return false
      target.damage = getMaxHealth(target)
      checkDefeated(state, seat, events)
      return true
    },
    // Phase 5（5c-15）：检定中的临时加成 / 成功后的额外结算 / 创伤 / 弃牌堆招募盟友。
    addTestPendingBonus: amount => {
      if (!state.skillTest) return 0
      state.skillTest.pendingBonus = (state.skillTest.pendingBonus || 0) + amount
      return state.skillTest.pendingBonus
    },
    addExtraOnSuccess: effectData => {
      if (!state.skillTest) return false
      state.skillTest.extraOnSuccess ||= []
      state.skillTest.extraOnSuccess.push(effectData)
      return true
    },
    addTrauma: (seat, kind, amount = 1) => {
      if (!state.investigators[seat]) return false
      addTrauma(state, seat, kind, amount, events)
      return true
    },
    recruitAllyFromDiscard: (seat, source = null) => {
      const owner = state.investigators[seat]
      if (!owner || discardLocked(state, owner)) return false
      const candidates = state.investigators.flatMap(person => person.discard
        .filter(code => cardDef(code)?.type === 'asset' && (cardDef(code)?.traits || [])
          .some(trait => String(trait).toLowerCase() === 'ally'))
        .map(code => ({ code, owner: person })))
      if (!candidates.length || !owner) return false
      // 03238 的 X 费用：按所选盟友的印刷费用支付。
      const affordable = candidates.filter(item => owner.resources >= (cardDef(item.code)?.cost || 0))
      if (!affordable.length) return false
      const answer = requestChoice(state, { kind: 'card', source, seat, prompt: '选择弃牌堆中的盟友。',
        options: affordable.map((item, index) => ({ id: String(index), cardCode: item.code, label: cardName(item.code) })) })
      const picked = affordable[Number(answer)]
      if (!picked) return false
      const cost = cardDef(picked.code)?.cost || 0
      resourceBank.spendFromPool(owner, cost)
      removeOne(picked.owner.discard, picked.code)
      owner.assets.push(newPlayerAssetInstance(state, owner, picked.code))
      return true
    },
    // 「不期而遇」：从任意玩家弃牌堆临时招募一个盟友，本轮结束弃掉。
    recruitTemporaryAllyFromDiscard: (seat, source = null) => {
      const owner = state.investigators[seat]
      if (!owner) return false
      const candidates = aliveInvestigators(state).flatMap(person => person.discard
        .map(code => ({ owner: person, code }))
        .filter(item => (cardDef(item.code)?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')))
      if (!candidates.length) return false
      const chosen = candidates.length === 1 ? candidates[0] : (() => {
        const answer = requestChoice(state, {
          kind: 'card', source, seat, prompt: '选择任意玩家弃牌堆中的盟友支援。',
          options: candidates.map((item, index) => ({ id: String(index), cardCode: item.code,
            label: `${cardName(item.code)}（${item.owner.name} 的弃牌堆）` })),
        })
        return candidates[Number(answer)]
      })()
      if (!chosen) return false
      const index = chosen.owner.discard.indexOf(chosen.code)
      if (index >= 0) chosen.owner.discard.splice(index, 1)
      owner.assets.push(newCardInstance(state, chosen.code, { exhausted: false, temporaryAllyRound: state.round }))
      info(state, events, `${owner.name} 让「${cardName(chosen.code)}」暂时入场。`)
      return true
    },
    discardRandomFromHand: (seat, amount = 1) => discardRandomFromHand(state, state.investigators[seat], amount, events),
    // 本阶段下一次攻击该敌人时战斗值 -N（可叠加）。
    addEnemyFightReduction: (enemy, amount) => {
      if (!enemy) return 0
      const active = enemy.fightReduction?.round === state.round && enemy.fightReduction.phase === state.phase
      enemy.fightReduction = {
        amount: (active ? enemy.fightReduction.amount : 0) + amount,
        round: state.round, phase: state.phase,
      }
      return enemy.fightReduction.amount
    },
    // Phase 5（5c-14）：卡面读数与"打出标记"（时刻警惕 / 障眼戏法）。
    playCost: (seat, code) => {
      const owner = state.investigators[seat]
      const def = cardDef(code)
      return owner && def ? playCost(state, owner, def) : 0
    },
    cardName: code => cardName(code),
    cardTraits: code => (cardDef(code)?.traits || []).map(trait => String(trait).toLowerCase()),
    markSleightOfHand: code => {
      const played = state.investigators[state.currentSeat]?.assets.filter(item => item.code === code).at(-1)
      if (played) played.sleightOfHand = { round: state.round, turnSeat: state.currentSeat }
      return Boolean(played)
    },
    // Phase 5（5c-13）：启动一次技能检定（内容层自己给难度与成功后的后续动作）。
    // 注意：abilityApi 已有 test(seat, skill, difficulty, options)，这里用不同名字避免覆盖。
    startTest: spec => {
      const seat = spec.seat ?? state.currentSeat
      performTest(state, seat, spec.skill, spec.difficulty ?? 0, {
        source: spec.source || undefined,
        skillBonus: spec.skillBonus ?? 0,
        peril: spec.peril === true,
        resolve: typeof spec.resolve === 'function' ? spec.resolve : undefined,
      })
      return true
    },
    // Phase 5（5c-13）：手牌上限与直接恐惧（养神术的溢出惩罚）。
    handSize: seat => getHandSize(state, state.investigators[seat ?? state.currentSeat]),
    applyHorror: (seat, amount) => {
      const target = state.investigators[seat]
      if (!target || !amount) return
      applyHorror(state, target, amount, events)
    },
    planTestReveal: spec => {
      if (!state.skillTest) return null
      state.skillTest.pendingRevealPlan = { ...spec }
      return state.skillTest.pendingRevealPlan
    },
    addExtraChaosChoices: (amount, source = null) => {
      if (!state.skillTest) return 0
      state.skillTest.extraChaosChoices = (state.skillTest.extraChaosChoices || 0) + amount
      if (source) state.skillTest.extraChaosSource = source
      return state.skillTest.extraChaosChoices
    },
    // 调查员当前属性（与 getStat 同源）：判定「难度高出多少」这类卡要用。
    stat: (seat, skill) => getStat(state, state.investigators[seat], skill),
    // 把当前遭遇卡改由指定座位接手（可以指定别人，不只是自己）。
    redirectEncounterTo: seat => {
      const context = state._reaction?.context || state._reaction
      const owner = state.investigators[seat]
      if (!context || !owner || context.when !== 'encounterDrawn') return false
      context.redirectSeat = seat
      context.location = owner.location
      return true
    },
    // 把敌人放回遭遇牌库顶并解除交战（狗屎运）。
    shuffleEnemyToEncounterTop: enemy => {
      if (!enemy) return false
      const index = state.enemies.indexOf(enemy)
      if (index >= 0) state.enemies.splice(index, 1)
      for (const owner of state.investigators) {
        if (Array.isArray(owner.engaged)) owner.engaged = owner.engaged.filter(id => id !== enemy.id)
      }
      state.encounterDeck.push(enemy.code)
      return true
    },
    // Phase 5（5c-8）：反应窗口的上下文（快速事件的结算靠它拿到「这次遭遇/攻击」的信息）。
    reactionContext: () => state._reaction || null,
    // 在反应窗口里记录一个标记（例如「哎呀！」把这次攻击伤害转给另一个敌人）。
    // 旧式实现写的是 `_reaction.context`（存在时），这里保持同一目标。
    setReactionFlag: (key, value = true) => {
      if (!state._reaction) return false
      const target = state._reaction.context || state._reaction
      target[key] = value
      return true
    },
    // 「绑定怪物」：横置并解除交战，然后把这张牌附到敌人身上。
    bindMonsterToEnemy: (enemy, seat, code = null) => {
      if (!enemy) return false
      enemy.exhausted = true
      if (enemy.engagedSeat != null) disengageEnemy(state, enemy)
      enemy.bindMonster = { ownerSeat: seat, code }
      return true
    },
    // 「窄路逃生」：取消正在结算的攻击，并让下一次躲避 +2。
    cancelCurrentAttack: () => {
      if (!state._reaction) return false
      state._reaction.cancelled = true
      return true
    },
    prepareEvadeBonus: (amount = 2, seat = state.currentSeat) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      owner.narrowEscape = { amount, round: state.round, turnSeat: state.currentSeat }
      return owner.narrowEscape
    },
    // 「阿登森林护甲」：取消正在分配的 N 点伤害（反应窗口里的唯一接线点）。
    cancelDamage: (amount = 1) => {
      const reaction = state._reaction
      if (!reaction) return 0
      if (reaction.context) reaction.context.cancelDamage = (reaction.context.cancelDamage || 0) + amount
      else reaction.damage = Math.max(0, (reaction.damage || 0) - amount)
      return amount
    },
    // Phase 5（5c-18）：「追忆未来」在检定开始时指定一个混乱标记。
    // 命中时横置与 +2 仍由引擎的标记揭示段处理（读点 state.skillTest.namedToken 不变）。
    nameChaosToken: (seat, options = {}) => {
      const owner = state.investigators[seat]
      const asset = options.asset || null
      if (!asset || asset.exhausted || !state.skillTest || !owner) {
        info(state, events, options.unavailableText || '现在不能指定混乱标记。')
        return null
      }
      const faces = unique(state.chaosBag)
      const chosen = faces.length === 1 ? faces[0] : requestChoice(state, { kind: 'token', source: asset.id, seat,
        prompt: options.prompt || '指定一个混乱标记；本次检定揭示它时本次检定 +2。',
        options: faces.map(face => ({ id: face, label: tokenLabel(face) })) })
      state.skillTest.namedToken = { token: faces.includes(chosen) ? chosen : faces[0], assetId: asset.id }
      info(state, events, `🔮 ${owner.name} 用「${cardName(asset.code)}」指定了 ${tokenLabel(state.skillTest.namedToken.token)}。`)
      return state.skillTest.namedToken.token
    },
    // Phase 5（5c-18）：「再试一次」把本次检定投入的一张自己的技能牌收回手牌。
    recallCommittedSkill: (seat, options = {}) => {
      const owner = state.investigators[seat]
      if (!owner) return null
      const committed = (state.skillTest?.committed || [])
        .filter(item => item.seat === seat && cardDef(item.code)?.type === 'skill')
      if (!committed.length) {
        info(state, events, options.emptyText || '本次检定没有可收回的技能牌。')
        return null
      }
      // 检定时可以投入两张同名技能牌；选项 id 用下标，避免重复卡号。
      const chosenIndex = committed.length === 1 ? 0 : Number(requestChoice(state, { kind: 'card',
        source: options.source || committed[0].code, seat,
        prompt: options.prompt || '选择要返回手牌的一张技能牌。',
        options: committed.map((item, index) => ({ id: String(index), cardCode: item.code, label: cardName(item.code) })) }))
      const entry = committed[chosenIndex] || committed[0]
      removeOne(state.skillTest.committed, entry)
      owner.hand.push(entry.code)
      info(state, events, `「${cardName(options.source || entry.code)}」把「${cardName(entry.code)}」返回 ${owner.name} 的手牌。`)
      return entry.code
    },
    // 「我來处理」：把当前遭遇卡改由该座位接手结算（反应窗口里唯一的接线点）。
    redirectEncounter: (seat, bonus = 0) => {
      const context = state._reaction?.context || state._reaction
      const owner = state.investigators[seat]
      if (!context || !owner || context.when !== 'encounterDrawn' || context.seat === seat) return false
      context.redirectSeat = seat
      context.location = owner.location
      if (bonus) context.redirectBonus = bonus
      return true
    },
    // 第 121 轮（第 4 批）：反应窗口里的通用原语，取代 player-effects.js 中按卡分派的
    // cancelHarmGainResources / cancelHarm / redrawEncounter（卡面差异只剩 maximum 与文案）。
    cancelHarm: (seat, options = {}) => {
      const context = state._reaction
      const owner = state.investigators[seat]
      if (!context || !owner || context.when !== 'harmDealt') return null
      const maximum = options.maximum ?? 5
      const cap = Math.min(maximum, (context.damage || 0) + (context.horror || 0))
      const choices = []
      for (let damage = 0; damage <= Math.min(context.damage || 0, cap); damage++) {
        for (let horror = 0; horror <= Math.min(context.horror || 0, cap - damage); horror++) {
          if (damage + horror > 0) {
            choices.push({ id: `${damage}:${horror}`,
              label: `取消 ${damage} 伤害、${horror} 恐惧${options.gainResources ? `（获得 ${damage + horror} 资源）` : ''}` })
          }
        }
      }
      if (!choices.length) return null
      const answer = choices.length === 1 ? choices[0].id : requestChoice(state, {
        kind: 'harm', source: options.source || 'cancelHarm', seat,
        prompt: options.prompt || '选择要取消的伤害与恐惧。', options: choices,
      })
      const [damage, horror] = String(answer).split(':').map(Number)
      if (!Number.isFinite(damage) || !Number.isFinite(horror)) return null
      context.damage = Math.max(0, (context.damage || 0) - damage)
      context.horror = Math.max(0, (context.horror || 0) - horror)
      if (options.gainResources) owner.resources += damage + horror
      info(state, events, `${owner.name} 取消 ${damage} 点伤害与 ${horror} 点恐惧`
        + (options.gainResources ? `，并获得 ${damage + horror} 资源。` : '。'))
      // 第 5 步 P6：取消效果是一张卡做的事，「你拥有的一张卡取消了……」的反应靠这份记账。
      noteCardCancelled(reactionWindow, state, events, { seat, what: 'harm' })
      return { damage, horror }
    },
    // 取消刚抽到的遭遇卡（可要求重抽一张），取代 02302 的 redrawEncounter 分派。
    cancelEncounterDraw: (seat, options = {}) => {
      const context = state._reaction?.context || state._reaction
      const when = context?.when || state._reaction?.when
      if (!context || when !== 'encounterDrawn') return false
      // 2026-10-25 第四轮修复 cannot-cancel-card-flag（05342）：卡面「不能被取消」时拒绝取消。
      if (context.cannotCancel) {
        info(state, events, '这张遭遇牌的效果不能被取消。')
        return false
      }
      context.cancelled = true
      if (options.redraw === true) context.redraw = true
      if (options.shuffleBack === true) context.shuffleBack = true
      noteCardCancelled(reactionWindow, state, events, { seat, what: 'encounter' })
      return true
    },
    // 第 122 轮（第 4 批收尾）：搜索任意调查员牌库顶 N 张，把符合特质的牌直接放进场
    // （照明弹 02115 的第二个选项）。日志与旧实现一致：不额外写「加入手牌」之类的行。
    searchDeckIntoPlay: (seat, options = {}) => {
      const controller = state.investigators[seat]
      if (!controller) return null
      const owners = aliveInvestigators(state)
      if (!owners.length) return null
      const ownerSeat = options.fromSeat != null ? options.fromSeat
        : owners.length === 1 ? owners[0].seat : Number(requestChoice(state, {
          kind: 'target', source: options.source || 'searchDeckIntoPlay', seat,
          prompt: options.ownerPrompt || '选择要搜索的牌库。',
          options: owners.map(owner => ({ id: String(owner.seat), label: `${owner.name} 的牌库` })),
        }))
      const owner = state.investigators[ownerSeat]
      if (!owner) return null
      const amount = options.amount || 9
      const trait = String(options.trait || 'ally').toLowerCase()
      const cards = owner.deck.slice(-Math.min(amount, owner.deck.length))
      const matches = cards.filter(code => (cardDef(code)?.traits || []).some(item => String(item).toLowerCase() === trait))
      let played = null
      if (matches.length) {
        const chosen = matches.length === 1 ? matches[0] : matches[Number(requestChoice(state, {
          kind: 'card', source: options.source || 'searchDeckIntoPlay', seat,
          prompt: options.prompt || '选择要放置入场的牌。',
          options: matches.map((code, index) => ({ id: String(index), cardCode: code, label: cardName(code) })),
        }))]
        const code = chosen || matches[0]
        const index = owner.deck.lastIndexOf(code)
        if (index >= 0) owner.deck.splice(index, 1)
        const asset = newCardInstance(state, code, { exhausted: false })
        controller.assets.push(asset)
        played = asset
        triggerReaction(state, seat, 'assetEnteredPlay', events,
          { assetCode: code, assetId: asset.id, location: controller.location })
      }
      owner.deck = shuffle(owner.deck, () => randomValue(state))
      return played
    },
    // 杜克（02014）调查前可先移动：返回本次可移动到的地点 id 列表。
    moveDestinations: seat => investigatorMoveDestinations(state, seat, {}),
    isNonWeakness: code => {
      const def = cardDef(code)
      return Boolean(def) && !isWeaknessCard(def)
    },
    enemiesAt: locationId => state.enemies.filter(enemy => enemy.location === locationId),
    investigatorsAt: locationId => aliveInvestigators(state).filter(inv => inv.location === locationId),
    countControlled: (seat, { trait = null, usesType = null } = {}) => {
      const inv = state.investigators[seat]
      if (!inv) return []
      return [...inv.assets, ...(inv.threat || [])].filter(card => {
        // Phase 2（C2）：特性判定合并运行期授予（add:trait）。
        if (trait && !cardHasTrait(state, inv, card.code, trait)) return false
        if (usesType) {
          const type = String(card.usesType || '').toLowerCase()
          if (!(type === String(usesType).toLowerCase() || type === `${String(usesType).toLowerCase()}s`)) return false
        }
        return true
      })
    },
    assetsCannotReady: inv => assetsCannotReady(inv),
    searchTop: (seat, options) => searchTop(state, seat, options, events),
    fight: (seat, enemyId, options = {}) => doFight(state, seat, { enemyId, ...options }, events, options.noSpend === true),
    // Phase 5（5b-8）：技能名（「戴红手套的男子」的提示与日志要用）。
    skillName: skill => SKILL_NAMES[skill] || skill,
    // Phase 5（5a-15）：按 id 取地点（弱点附着用）。
  }
}
