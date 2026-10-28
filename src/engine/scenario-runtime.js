// 剧本运行时（scenarioRuntime）从 engine.js 拆出的模块（Phase 6 · 6d-13）。
//
// 剧本内容（遭遇卡、地点、密谋、议程）拿不到引擎内部，只能拿到这个窄接口：
// 放置地点、生成敌人、造成伤害、抽遭遇、推进密谋…… 它本质是「内容层 ↔ 引擎」的边界对象。
// 拆成独立模块后，这个边界从 90 个依赖一眼可见，也方便后续战役插件化时按战役切分。
//
// 依赖注入同前几批；被多个 api 依赖表引用的 doPlay / performTest 用惰性 thunk。

import { linkLocationBySymbols } from './locations.js'
import { attachLocationCard, addLocationShroud, setLocationShroudMod } from './location-attachments.js'
import { scenarioRuntimeExtras } from './scenario-runtime-extras.js'
import {
  buildScenarioLocationDeck, chooseScenarioLocationDeck, discardScenarioLocation,
  drawScenarioLocationDeck, scenarioLocationDeckInfo, shuffleScenarioLocationIntoDeck,
} from './alt-decks.js'
import { LOCATION_FLAGS as LOCATION_FLAG_KEYS,
  addBreach, breachOf, breachTotal, locationFlagOf, locationSkullValue, removeBreach, setLocationFlag,
} from './location-state.js'
import { loseResources as applyResourceLoss } from './resource-loss.js'
import { clearCluesOnEnemy, moveClueToEnemy } from './enemy-clues.js'
import { ignoreLimitForRound } from './limits.js'
// 2026-10-28 P2-6：地点交换 / 移出游戏原语（05125 收口；实现与依赖注入见 location-swap.js）。
import { removeLocationFromGame, swapLocationInPlay } from './location-swap.js'

export function createScenarioRuntime(deps) {
  const {
    EFFECTS,
    addBasicWeakness,
    addDoom,
    addToExplorationDeck,
    // 2026-10-25 第五轮：剧情资产附属到敌人 / 地点当前帷幕读点。
    attachCardTo,
    entityModifierTotal,
    addTrauma,
    addYigsFury,
    advanceAct,
    advanceAgenda,
    aliveInvestigators,
    aloofPreventsAttack,
    applyDamage,
    applyHarm,
    applyHorror,
    // 2026-10-28 P1：声明式遭遇检定（treacheryRule.test）的失败分支复用引擎同一份 applyPenalty。
    applyPenalty,
    autoEngageAll,
    autoEvadeEnemy,
    beginChaosTest,
    basicWeaknessPool,
    buildExplorationDeck,
    buildTarotDeck,
    campaignCardChange,
    campaignState,
    chooseTarot,
    discardDrawnTarot,
    drawTarot,
    canDiscardFromHand,
    canDiscoverClueAt,
    cardDef,
    cardName,
    checkSupplies,
    crossOffSupply,
    damageEnemy,
    defeatAll,
    defeatEnemy,
    defeatedAssetRetaliation,
    discardEnemyCard,
    discardRandomFromHand,
    discardUntilEnemy,
    discardUntilEnemyTrait,
    discardUntilEnemyFromEncounter,
    // 第 2 步 P2.2：第二遭遇牌堆（幽灵界）的建堆/抽牌/洗回/弃牌与公开读数。
    addToExtraEncounterDeck,
    discardFromExtraEncounterDeck,
    discardTopOfExtraEncounterDeck,
    discoverClueAt,
    disengageEnemy,
    doExplore,
    doInvestigate,
    doPlay,
    doResign,
    doomCards,
    drawCards,
    drawChaosToken,
    drawEncounter,
    drawExtraEncounter,
    replayEncounterRevelation,
    drawMadnessWeakness,
    eliminateInvestigator,
    endChaosTest,
    enemyAttack,
    enemyCanBeDefeated,
    enemyCannotAttack,
    enemyCannotBeAttacked,
    enemyFightValue,
    enemyHealth,
    engageEnemy,
    expeditionLeaderSeat,
    extraEncounterDeckInfo,
    extraEncounterDecksInfo,
    finishScenario,
    banishEnemyToVictory,
    enemyFace,
    flipEnemyFace,
    flipLocationFace,
    flipScenarioLocation,
    grantSupplies,
    groupPayment,
    // 2026-10-25 第四轮修复 05171b：把修改后的技能值暴露给内容层（区别于印刷基值）。
    getStat,
    // 第四循环P2.1：闹鬼结算（印刷 + 授予能力、顺序询问、可取消、可重复）。
    clearHauntedGrants,
    grantHaunted,
    hauntedAbilitiesAt,
    hasSupply,
    hunterStep,
    info,
    investigateTest,
    isLocationHaunted,
    isSpectralLocation,
    isPoisoned,
    isWeaknessCode,
    leaveAsset,
    leadDecisionSeat,
    locName,
    // 2026-10-28：地点特性原语与地点帷幕临时修正（见 location-traits.js / locations.js）。
    locationTraits,
    setLocationShroudMod,
    moveRelicOfAges,
    newCardInstance,
    notifyCluesRemoved,
    performTest,
    placeDoomOnCard,
    placeLocation,
    poisonInvestigator,
    preyTarget,
    privateInfo,
    randomValue,
    // 2026-10-25：05280 的按面向取消窗口（失去行动等）。
    reactionWindow,
    recordVengeance,
    registeredEntry,
    relicOfAges,
    relicOfAgesLocation,
    relocateEnemy,
    relocateInvestigator,
    removeLocation,
    removeOne,
    requestChoice,
    resolveHaunted,
    revealLocation,
    ruleCodeForOriginal,
    scenarioAssetPlayError,
    scenarioBehavior,
    setExpeditionLeader,
    shuffleTarotIntoDeck,
    setExtraEncounterDeck,
    shuffle,
    shuffleIntoExtraEncounterDeck,
    spawnEnemy,
    spawnStoryAsset,
    spawnStoryEnemy,
    spendAction,
    spendClues,
    stepToward,
    suppliesAtLocation,
    suppliesFor,
    syncClues,
    tarotInfo,
    tarotOrientation,
    tarotRemaining,
    // Phase 7（第 116 轮）：条目写「揭示的混乱标记」日志时用的中文标记名（与引擎日志同源）。
    tokenLabel,
    vengeancePoints,
    yigsFury,
  } = deps

function scenarioRuntime(state, events, testSource = null) {
  return {
    info: text => info(state, events, text),
    cardName: code => cardName(code),
    // 混乱标记的中文名：「旧印」「骷髅」…（条目写日志时用，不要复制标签表）。
    tokenLabel: token => tokenLabel(token),
    random: () => randomValue(state),
    // 剧本标记：内容层与卡条目共用同一个 API（卡文件不得直接写 state.scenarioFlags）。
    scenarioFlag: key => state.scenarioFlags?.[key] ?? null,
    setScenarioFlag: (key, value = true) => {
      state.scenarioFlags ||= {}
      if (value === undefined || value === null) delete state.scenarioFlags[key]
      else state.scenarioFlags[key] = value
      return state.scenarioFlags[key] ?? null
    },
    shuffle: list => shuffle(list, () => randomValue(state)),
    defeatAll: () => defeatAll(state, events),
    discardUntilEnemyTrait: trait => discardUntilEnemyTrait(state, trait, events),
    decideSeat: () => leadDecisionSeat(state),
    preyTarget: (rule, seats) => preyTarget(state, rule, seats),
    // 2026-10-25 第四轮修复 05171b：读取「修改后」的技能值（含被动/效果修正，区别于印刷基值）。
    investigatorStat: (seat, skill) => {
      const inv = state.investigators[seat]
      return inv ? getStat(state, inv, skill) : 0
    },
    ruleCode: original => ruleCodeForOriginal(original),
    basicWeaknesses: trait => basicWeaknessPool().filter(code =>
      (cardDef(code)?.traits || []).some(value => String(value).toLowerCase() === String(trait).toLowerCase())),
    isWeaknessCode: code => isWeaknessCode(code),
    spendAction: seat => spendAction(state, state.investigators[seat]),
    campaignCardChange: (...args) => campaignCardChange(...args),
    // 第 2 步 P2.10：战役资产加入某位调查员的战役牌组（不占 30 张，下一章带入）。
    campaignCard: (code, seat = 0, reason) => campaignCardChange(state.campaign, seat, code, 'add', reason || '剧情奖励'),
    locName: id => locName(state, id),
    locationDistance: (from, targets) => {
      const queue = [[from, 0]]
      const seen = new Set([from])
      for (const [id, steps] of queue) {
        if (targets.includes(id)) return steps
        const location = state.locations.find(candidate => candidate.id === id)
        for (const next of location?.connections || []) {
          if (seen.has(next)) continue
          seen.add(next)
          queue.push([next, steps + 1])
        }
      }
      return -1
    },
    locationName: id => state.locations.find(location => location.id === id)?.name || id,
    // 2026-10-28：地点特性原语（location-traits.js）。内容层（章节 behavior / 地点条目）用它
    // 授予/撤销运行时特性；连接重算与投影的 grantedTraits 都由原语内部完成。
    addLocationTrait: (location, trait, options = {}) => locationTraits.add(state, location, trait, options),
    removeLocationTrait: (location, trait, options = {}) => locationTraits.remove(state, location, trait, options),
    grantedLocationTraits: location => locationTraits.granted(location),
    // 地点帷幕的临时修正（如「直到皮博迪先生重整，该地点 -1 帷幕」）；撤销时反向调用。
    setShroudMod: (location, amount) => setLocationShroudMod(location, amount),
    autoEngageAll: () => autoEngageAll(state, events),
    place: id => placeLocation(state, id, events),
    reveal: id => revealLocation(state, id, events),
    remove: id => removeLocation(state, id, events),
    // 2026-10-28 P2-6：地点交换 / 移出游戏（05125 探访巫宅）。旧地点上的线索/毁灭/地点附属/
    // 玩家地点附属/敌人/调查员迁移语义由原语统一处理，卡条目不再写 state.locations。
    swapLocation: (fromId, toId, options = {}) => swapLocationInPlay(state, events, fromId, toId, options, {
      placeLocation, removeLocation, relocateInvestigator, relocateEnemy,
    }),
    removeLocationFromGame: (id, options = {}) => removeLocationFromGame(state, events, id, options, {
      removeLocation, discardEnemyCard,
    }),
    // 「放进遭遇牌库并洗牌」：把牌洗回遭遇牌库（地点 / 诡计卡通用模板）。
    // 逐字等价于「encounterDeck.push(...codes) 后 api.shuffleEncounterDeck()」：只消耗一次洗牌随机。
    shuffleIntoEncounterDeck: (codes, options = {}) => {
      const list = Array.isArray(codes) ? codes.filter(Boolean) : [codes].filter(Boolean)
      if (!list.length) return (state.encounterDeck || []).length
      state.encounterDeck = [...(state.encounterDeck || []), ...list]
      if (options.shuffle !== false) state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state))
      return state.encounterDeck.length
    },
    // 场景区「放一边」取卡（地点入场 / 洗入遭遇牌库；同类写法散落在多张循环卡里）。
    takeFromSetAside: code => {
      const setAside = state.scenarioZones?.setAside
      if (!Array.isArray(setAside)) return false
      const index = setAside.indexOf(String(code))
      if (index < 0) return false
      setAside.splice(index, 1)
      return true
    },
    spawn: (code, location) => spawnEnemy(state, code, location, null, true),
    spawnEngaged: (code, location, seat) => spawnEnemy(state, code, location, seat),
    // 从玩家牌/无目录数据生成的敌人（04331 飞天水螅：把牌库顶的牌视为敌人）。
    spawnStoryEnemy: (code, location, stats = {}, extra = {}) => spawnStoryEnemy(state, code, location, stats, extra, events),
    attack: (enemy, inv) => enemyAttack(state, enemy, inv, events, '剧本效果', { kind: 'effect' }),
    // 「无视卡牌效果」通用开关（失落时代 P2）：共享解析器与章节 behavior 在
    // 自己的攻击循环里也能用同一份判定。Phase 3（D1）起，敌人自己的卡面声明优先。
    cannotAttack: enemy => enemyCannotAttack(state, enemy),
    cannotBeAttacked: enemy => enemyCannotBeAttacked(state, enemy),
    // 冷漠（aloof）：剧本自己的攻击行动在列出目标和结算前要问这个读点，
    // 否则会绕过 doFight 的冷漠限制（如课外活动的炼金试剂攻击）。
    aloofPreventsAttack: (enemy, inv = state.investigators[state.currentSeat], options = {}) =>
      aloofPreventsAttack(state, inv, enemy, options),
    damage: (seat, n) => applyDamage(state, state.investigators[seat], n, events),
    horror: (seat, n) => applyHorror(state, state.investigators[seat], n, events),
    healDamage: (seat, n) => {
      const inv = state.investigators[seat]
      inv.damage = Math.max(0, inv.damage - n)
    },
    healHorror: (seat, n) => {
      const inv = state.investigators[seat]
      inv.horror = Math.max(0, inv.horror - n)
    },
    directDamage: (seat, n) => applyDamage(state, state.investigators[seat], n, events, true),
    directHorror: (seat, n) => applyHorror(state, state.investigators[seat], n, events, true),
    assetsFirstDamage: (seat, n) => applyHarm(state, state.investigators[seat], n, 0, events, false, null, true),
    moveInvestigator: (seat, destination) => relocateInvestigator(state, seat, destination, events),
    moveEnemy: (enemy, destination) => relocateEnemy(state, enemy, destination, events),
    stepToward: (from, to) => stepToward(state, from, to),
    hunterStep: (enemy, options) => hunterStep(state, enemy, options),
    loseActions: (seat, n) => {
      const inv = state.investigators[seat]
      if (!inv || !(n > 0)) return 0
      const context = reactionWindow(state, 'wouldLoseActions', {
        when: 'wouldLoseActions', seat, amount: n, what: 'actions', location: inv.location,
        prompt: `${inv.name} 将要失去 ${n} 个行动`,
      }, events)
      if (context.cancelled) {
        info(state, events, `🛡️ ${inv.name} 忽略了失去行动的效果。`)
        return 0
      }
      if (state.phase === 'investigation') inv.actionsLeft = Math.max(0, inv.actionsLeft - n)
      else {
        inv.pendingActionLoss ||= {}
        inv.pendingActionLoss[state.round] = (inv.pendingActionLoss[state.round] || 0) + n
      }
      return n
    },
    removeAsset: (seat, assetId) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return null
      leaveAsset(state, inv, asset, events)
      return asset.code
    },
    damageAsset: (seat, assetId, n) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return
      asset.damage = (asset.damage || 0) + n
      if (asset.damage >= (cardDef(asset.code)?.health || Infinity)) {
        leaveAsset(state, inv, asset, events)
        if (!asset.removedFromGame && !asset.returnedToHand) inv.discard.push(asset.code)
        const retaliationDamage = registeredEntry(asset.code)?.defeatedDamage
        if (retaliationDamage) defeatedAssetRetaliation(state, inv, retaliationDamage, events)
      }
    },
    horrorAsset: (seat, assetId, n) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return
      asset.horror = (asset.horror || 0) + n
      if (asset.horror >= (cardDef(asset.code)?.sanity || Infinity)) {
        leaveAsset(state, inv, asset, events)
        if (!asset.removedFromGame && !asset.returnedToHand) inv.discard.push(asset.code)
        if (registeredEntry(asset.code)?.defeatedDamage) defeatedAssetRetaliation(state, inv, registeredEntry(asset.code).defeatedDamage, events)
      }
    },
    discardAsset: (seat, assetId) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return null
      leaveAsset(state, inv, asset, events)
      if (!asset.removedFromGame && !asset.returnedToHand) inv.discard.push(asset.code)
      return asset.code
    },
    // 04082 补给短缺：与玩家卡 api.loseResources 共用同一实现（含 wouldLoseResources 窗口）。
    loseResources: (seat, amount) => {
      const inv = state.investigators[seat]
      return applyResourceLoss(state, inv, amount, { reactionWindow, events, info })
    },
    shuffleAssetIntoDeck: (seat, assetId) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return null
      leaveAsset(state, inv, asset, events)
      if (!asset.removedFromGame) inv.deck.push(asset.code)
      inv.deck = shuffle(inv.deck, () => randomValue(state))
      return asset.code
    },
    // 剧本 runtime 发起的技能检定默认视为「冒险卡牌上印刷能力」的检定：
    // 04153 参透真谛等「只能投入冒险卡能力检定」的卡以此为判据。调用方显式传
    // source.ability=false 时不覆盖（保留旧行为）。
    test: (seat, skill, difficulty, resolve, skillBonus = 0, source = null, options = {}) => {
      const merged = source && typeof source === 'object'
        ? { type: 'scenario', ability: true, ...source }
        : { type: 'scenario', ability: true, label: source || testSource || undefined }
      if (merged.ability === false) delete merged.ability
      return performTest(state, seat, skill, difficulty, { ...options, resolve, skillBonus, source: merged })
    },
    investigate: (seat, options = {}) => doInvestigate(state, seat, options, events, true),
    // 失败惩罚的唯一结算入口：效果种类与数值仍由 applyPenalty（treachery-tokens.js）实现，
    // 内容层只传 `{ kind, ... }` 与失败差值（声明式遭遇检定用）。
    applyPenalty: (seat, fail, failedBy, options) => applyPenalty(state, state.investigators[seat], fail, failedBy, events, options),
    investigateTest: (seat, options = {}) => investigateTest(state, seat, options, events),
    endTurn: seat => {
      const target = state.investigators[seat]
      if (!target) return
      target.actionsLeft = 0
      if (state.currentSeat === seat) target.turnEnded = true
    },
    discardUntilEnemy: (seat, predicate) => discardUntilEnemyFromEncounter(state, seat, predicate, events),
    discardAnyEnemy: () => discardUntilEnemy(state, events),
    clueRemoved: (loc, n) => notifyCluesRemoved(state, loc, n, events),
    // 敌人身上的线索（03098 / 03099 / 03100 / 03144 / 03145）：唯一写入口。
    // from: 'location'（默认，敌人所在地点）| 'investigator'（该座位的线索池）。
    // 「往事回声」议程的 clueToDoom 翻面由原语统一处理，条目不再 import 条目辅助函数。
    moveClueToEnemy: (enemy, options = {}) => moveClueToEnemy(state, enemy, options),
    clearCluesOnEnemy: enemy => clearCluesOnEnemy(enemy),
    // 「直到本轮结束，忽略某条能力的限制」（与玩家面同一实现，见 api-misc）。
    ignoreLimitForRound: descriptorId => ignoreLimitForRound(state, descriptorId),
    finish: key => finishScenario(state, key, events),
    resign: seat => doResign(state, seat, events),
    advanceAct: () => advanceAct(state, events),
    advanceAgenda: () => advanceAgenda(state, events),
    // 2026-10-25 第四轮修复 05044（agenda-in-place-flip）：只翻当前议程的展示面并播报该面正文，
    // 不推进 agendaIndex、不清 state.doom、不触发议程推进阈值/离场钩子。
    flipAgendaInPlace: face => {
      const target = face === 'back' ? 'back' : 'front'
      state.agendaFace = target
      const agenda = state.agendas?.[state.agendaIndex]
      const text = target === 'back' ? (agenda?.backText || agenda?.text || '') : (agenda?.text || '')
      info(state, events, `🃏 密谋「${agenda?.name || ''}」翻至${target === 'back' ? '背面' : '正面'}。`, {
        kind: 'automatic', face: target, card: agenda?.code || null, text,
      })
      scenarioBehavior(state).agendaFlipped?.(state, target, scenarioRuntime(state, events))
      return target
    },
    clearDoom: () => {
      state.doom = 0
      for (const card of doomCards(state)) card.doom = 0
      scenarioBehavior(state).doomCleared?.(state, scenarioRuntime(state, events))
    },
    addDoom: n => addDoom(state, n, events),
    // 移除当前密谋上的 N 点毁灭（05126 把议程毁灭转移到那赫卜）。
    removeDoom: (amount = 1) => {
      const removed = Math.min(Math.max(0, Number(amount) || 0), Number(state.doom) || 0)
      if (!removed) return 0
      state.doom = Math.max(0, (Number(state.doom) || 0) - removed)
      return removed
    },
    // 移除某张卡上的全部毁灭（05126 清零议程实例 .doom；05237 也可用 cancelDoomPlacement）。
    clearDoomOnCard: card => {
      if (!card) return 0
      const removed = Number(card.doom) || 0
      delete card.doom
      return removed
    },
    // 全局帷幕修正（03101 淤泥与污物：每个地点 +1）。
    addFog: (amount = 1) => {
      state.fogMod = (Number(state.fogMod) || 0) + Number(amount || 0)
      return state.fogMod
    },
    // 03256 堵塞通道：「本轮不能离开该地点」（读点 hidden-rules.js 的 cannotLeaveRound）。
    lockLocationThisRound: location => {
      if (!location) return false
      location.cannotLeaveRound = state.round
      return true
    },
    // 03183 疯人院暴食怪：记录「本阶段猎手移动过」（读点 attackModifier / hunterMovedRound）。
    markHunterMoved: enemy => {
      if (!enemy) return false
      enemy.hunterMovedRound = state.round
      return true
    },
    // 03086 迅捷的拜亚基：本阶段不攻击（读点 turn.js 的 skipAttackRound）。
    skipEnemyAttackThisRound: enemy => {
      if (!enemy) return false
      enemy.skipAttackRound = state.round
      return true
    },
    // 05267 幽灵乌鸦：给敌人挂一个「持续到某轮」的数值增益标记（读点 encounter-rules 的 enemyStatModifier）。
    boostEnemyUntil: (enemy, key, round) => {
      if (!enemy || !key) return false
      enemy[key] = round
      return true
    },
    // 05100 冥府之雾：引擎 preyTarget 优先读实例上的 preySeat（null = 清掉）。
    setEnemyPreySeat: (enemy, seat) => {
      if (!enemy) return null
      if (seat == null) delete enemy.preySeat
      else enemy.preySeat = seat
      return enemy.preySeat ?? null
    },
    // 04055 暗起波澜：敌人资源计数（卡面初始化为 0）。
    setEnemyResources: (enemy, amount) => {
      if (!enemy) return null
      enemy.resources = Math.max(0, Number(amount) || 0)
      return enemy.resources
    },
    // 05103 怨灵：记录最近一次伤害来源与轮次，供击败时的「法术/遗物」判定读取。
    recordEnemyDamageSource: (enemy, source, round = state.round) => {
      if (!enemy) return null
      enemy.lastDamageSource = source ?? null
      enemy.lastDamagedRound = round
      return { source: enemy.lastDamageSource, round }
    },
    // 04146 鲜血阴谋：附属到当前密谋（唯一写点）并调整毁灭阈值。
    attachToAgenda: (code, extra = {}) => {
      const agenda = state.agendas?.[state.agendaIndex]
      if (!agenda || !code) return null
      return attachCardTo(state, null, code, agenda, extra)
    },
    addAgendaDoomThreshold: (delta = 1) => {
      const agenda = state.agendas?.[state.agendaIndex]
      if (!agenda) return null
      agenda.doomThreshold = Math.max(1, (agenda.doomThreshold || 0) + Number(delta || 0))
      return agenda.doomThreshold
    },
    // 02102/02089：地点计数器型障碍（引擎按地点字段读数量，卡只声明计数键）。
    markLocationCounter: (locationId, key, amount = 1) => {
      const location = (state.locations || []).find(entry => entry.id === locationId)
      if (!location || !key) return null
      location[key] = Math.max(0, (Number(location[key]) || 0) + Number(amount || 0))
      return location[key]
    },
    // 02180 蒸汽之爪：本轮不能移动离开本地点（movement.js 读 inv.steamImmobileRound）。
    lockMovementThisRound: seat => {
      const inv = state.investigators[seat]
      if (!inv) return false
      inv.steamImmobileRound = state.round
      return true
    },
    // 04079 蟒蛇：下一个补给阶段不能重整（phases 读 campaign-state 的 cannotReadyRound）。
    preventReadyNextUpkeep: seat => {
      const inv = state.investigators[seat]
      if (!inv) return false
      campaignState.setCannotReadyRound(inv, state.round)
      return true
    },
    // 04195 暴露弱点：本阶段下一次对该敌人的攻击攻击值视为 0（combat.js 读点）。
    exposeEnemyWeakness: enemy => {
      if (!enemy) return false
      enemy.exposeWeakness = { round: state.round, phase: state.phase }
      return true
    },
    // 03038 藏身地点：已在场的非精英敌人立即获得藏身地点提供的冷漠（敌人移动/入场时由引擎重算）。
    grantHidingSpotAloof: enemy => {
      if (!enemy || enemy.elite) return false
      enemy.hidingSpotAloof = true
      enemy.aloof = true
      return true
    },
    // 02063 四叶草俱乐部：剧本让特定敌人失去冷漠（章节规则读条目数据后统一调用）。
    clearEnemyAloof: enemy => {
      if (!enemy) return false
      enemy.aloof = false
      return true
    },
    // 05018 神秘乐曲：本阶段密谋不能因毁灭阈值推进（act-agenda.js 读点）。
    lockAgendaDoomThisPhase: () => {
      state.agendaDoomLock = { round: state.round, phase: state.phase }
      return true
    },
    // 05104 被困的灵魂：本次检定投入卡牌的额外费用（tests.js 的 beforeCommitCard 读点）。
    setHauntedCommitCost: locationId => {
      state.hauntedCommitCost = { locationId, paidSeats: [] }
      return state.hauntedCommitCost
    },
    clearHauntedCommitCost: () => {
      delete state.hauntedCommitCost
      return true
    },
    // 03203 第三夜：把当前幕指针移到指定幕（随后由卡片调用 advanceAct）。
    setActIndex: index => {
      const acts = state.acts || []
      if (!Number.isInteger(index) || index < 0 || index >= acts.length) return false
      state.actIndex = index
      return true
    },
    // 05136 古老者之城：让两个地点互相连接（连接是双向的，写点唯一）。
    connectLocations: (aId, bId) => {
      const a = (state.locations || []).find(location => location.id === aId)
      const b = (state.locations || []).find(location => location.id === bId)
      if (!a || !b) return false
      a.connections ||= []
      b.connections ||= []
      if (!a.connections.includes(bId)) a.connections.push(bId)
      if (!b.connections.includes(aId)) b.connections.push(aId)
      return true
    },
    // 02101 世外诡影：每位调查员弃掉手牌中指定类型的每张卡牌。
    discardHandOfTypes: (seat, types = []) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      const wanted = new Set(types)
      const discarded = owner.hand.filter(code => wanted.has(cardDef(code)?.type))
      if (!discarded.length) return 0
      owner.hand = owner.hand.filter(code => !wanted.has(cardDef(code)?.type))
      owner.discard.push(...discarded)
      return discarded.length
    },
    // 02296 哭嚎仪式：把弃牌堆里的弱点洗回牌库。
    shuffleDiscardWeaknessesIntoDeck: seat => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      const weaknesses = owner.discard.filter(code =>
        ['weakness', 'basicweakness'].includes(cardDef(code)?.subtype))
      if (!weaknesses.length) return 0
      owner.discard = owner.discard.filter(code => !weaknesses.includes(code))
      owner.deck.push(...weaknesses)
      owner.deck = shuffle(owner.deck, () => randomValue(state))
      return weaknesses.length
    },
    // 幕上线索（03070 带着情报撤退）：读点 act-agenda.js 的 state.actClues。
    placeCluesOnAct: (amount = 1) => {
      state.actClues = (Number(state.actClues) || 0) + Number(amount || 0)
      return state.actClues
    },
    // 敌人治愈 N 点伤害（01179 坚韧的黑山羊幼崽「轮末治愈 2 点」）：写 damageTaken，读点同伤害。
    healEnemy: (enemy, amount = 1) => {
      if (!enemy) return 0
      const before = Number(enemy.damageTaken) || 0
      enemy.damageTaken = Math.max(0, before - Math.max(0, Number(amount) || 0))
      return before - enemy.damageTaken
    },
    // 05267/05087：敌人的横置/重整（敌人阶段与「如同敌军阶段」的结算共用读点）。
    readyEnemy: enemy => {
      if (!enemy) return false
      enemy.exhausted = false
      return true
    },
    exhaustEnemy: enemy => {
      if (!enemy) return false
      enemy.exhausted = true
      return true
    },
    // 剧本强制全员撤退（02198「怪兽的美餐」）：只写 resigned 标记，不走个人撤退日志/提前结算。
    markResigned: seat => {
      const inv = state.investigators[seat]
      if (!inv) return false
      inv.resigned = true
      return true
    },
    // 2026-10-25 第六轮修复 05237：撤销「刚放置的」毁灭（只作用于传入的卡实例）。
    cancelDoomPlacement: (card, amount = 1) => {
      // card=null 表示密谋/议程上的毁灭（05237 的神话阶段主用例）。
      if (!card) {
        const removed = Math.min(Math.max(0, amount), state.doom || 0)
        if (!removed) return 0
        state.doom = Math.max(0, (state.doom || 0) - removed)
        info(state, events, `🛡️ 取消了密谋上刚放置的 ${removed} 点毁灭（当前 ${state.doom}）。`)
        return removed
      }
      const removed = Math.min(Math.max(0, amount), card.doom || 0)
      if (!removed) return 0
      card.doom = Math.max(0, (card.doom || 0) - removed)
      info(state, events, `🛡️ 取消了「${card.name || cardName(card.code)}」刚放置的 ${removed} 点毁灭。`)
      scenarioBehavior(state).doomRemoved?.(state, { target: card, amount: removed }, scenarioRuntime(state, events))
      return removed
    },
    // 2026-10-25 第五轮修复（05321/05157）：敌人运行期数值修正（fight/evade/health，可带 floor；
    // until: 'endOfRound' | 'endOfTurn' | 'endOfPhase' | 'investigationEnd'）。
    // 'investigationEnd'（2026-10-28 P2-6，03096 哈斯塔的傀儡）：本轮调查阶段结束。
    // 在调查阶段内即当前轮；神话/敌人/维持阶段交战则顺延到下一轮的调查阶段。
    addEnemyStatModifier: (enemy, mods = {}, options = {}) => {
      if (!enemy) return null
      enemy.statMods ||= []
      const until = {}
      if (options.until === 'endOfRound') until.round = state.round
      else if (options.until === 'endOfTurn') until.turnSerial = state.turnSerial
      else if (options.until === 'endOfPhase') { until.round = state.round; until.phase = state.phase }
      else if (options.until === 'investigationEnd') {
        until.round = state.round + (['enemy', 'upkeep'].includes(state.phase) ? 1 : 0)
        until.phase = 'investigation'
      }
      const entry = { until }
      for (const key of ['fight', 'evade', 'health']) {
        if (Number.isFinite(mods[key])) entry[key] = mods[key]
      }
      if (Number.isFinite(mods.floor)) entry.floor = mods.floor
      enemy.statMods.push(entry)
      return entry
    },
    // 2026-10-25 第七轮修复 05286a/05288a：按幕搬运的「裂口」容器（state.acts[i].breaches）。
    actBreaches: (target = null) => {
      const act = target || state.acts?.[state.actIndex]
      return act?.breaches || 0
    },
    addActBreach: (target = null, amount = 1) => {
      const act = target || state.acts?.[state.actIndex]
      if (!act) return 0
      act.breaches = Math.max(0, (act.breaches || 0) + Math.max(0, Math.floor(amount) || 0))
      return act.breaches
    },
    removeActBreach: (target = null, amount = 1) => {
      const act = target || state.acts?.[state.actIndex]
      if (!act) return 0
      const removed = Math.min(act.breaches || 0, Math.max(0, Math.floor(amount) || 0))
      act.breaches = Math.max(0, (act.breaches || 0) - removed)
      return removed
    },
    // 2026-10-25 第七轮修复 05201：幕牌库旁的提醒实体（纯提醒载体，不影响规则状态）。
    addActReminder: (code, actIndex = null) => {
      if (!code) return null
      state.actReminders ||= []
      const reminder = { code, actIndex: Number.isInteger(actIndex) ? actIndex : (state.actIndex ?? 0) }
      state.actReminders.push(reminder)
      return reminder
    },
    actReminders: (actIndex = null) => {
      const list = state.actReminders || []
      if (!Number.isInteger(actIndex)) return [...list]
      return list.filter(item => item.actIndex === actIndex)
    },
    removeActReminder: (code, actIndex = null) => {
      const list = state.actReminders || []
      const index = list.findIndex(item => item.code === code
        && (!Number.isInteger(actIndex) || item.actIndex === actIndex))
      if (index < 0) return null
      return list.splice(index, 1)[0]
    },
    // 2026-10-25 第七轮修复 05222：把目标上的 1 个毁灭标记「翻至线索面」（语义等价载体）。
    flipMarker: (target, options = {}) => {
      const amount = Math.max(1, Math.floor(options.amount || 1))
      if (!target) return 0
      const labels = target.markers || []
      let flipped = 0
      for (let i = 0; i < amount; i++) {
        if ((target.doom || 0) <= 0) break
        target.doom -= 1
        target.clues = (target.clues || 0) + 1
        flipped += 1
      }
      if (flipped) {
        labels.push(`doomToClue:${flipped}`)
        target.markers = labels
        info(state, events, `🔄 把「${target.name || cardName(target.code)}」上的 ${flipped} 个毁灭标记翻至线索面。`)
      }
      return flipped
    },
    // 在「某一张卡」上放毁灭的统一入口（敌人在内）：走 doomPlaced 钩子与 04265 手铐拦截。
    doomOn: (card, amount = 1) => placeDoomOnCard(state, card, amount, events, { silent: true }),
    // 2026-10-25 本循环修复 doom-placement-prevention：内容可先问「这张卡此刻能不能被放置毁灭」。
    canPlaceDoomOn: card => scenarioBehavior(state).canPlaceDoomOn?.(state, card) !== false,
    // 2026-10-25 第四轮修复 05307：地点遭遇附属的真实实例承载（显示/文本空白/关闭行动读同一份数据）。
    attachEncounterToLocation: (code, locationId, extra = {}) => {
      const location = state.locations.find(loc => loc.id === locationId)
      if (!location) return null
      location.attachments ||= []
      const attachment = { id: `locatt-${location.id}-${location.attachments.length + 1}-${code}`, code, ...extra }
      location.attachments.push(attachment)
      return attachment
    },
    detachLocationAttachment: (locationId, attachmentId) => {
      const location = state.locations.find(loc => loc.id === locationId)
      if (!location?.attachments) return null
      const index = location.attachments.findIndex(item => item.id === attachmentId)
      if (index < 0) return null
      return location.attachments.splice(index, 1)[0]
    },
    locationAttachments: locationId => {
      const location = state.locations.find(loc => loc.id === locationId)
      return location?.attachments ? [...location.attachments] : []
    },
    payClues: (n, location) => groupPayment(state, n, location, events),
    spendClues: (seat, n) => { const inv = state.investigators[seat]; if (inv.clues < n) throw new Error('线索不足'); inv.clues -= n; syncClues(state) },
    trauma: (seat, kind, n) => addTrauma(state, seat, kind, n, events),
    storyAsset: (code, location) => spawnStoryAsset(state, code, location, events),
    // 失落的时代机制（M3-A）
    supplies: seat => suppliesFor(state, seat),
    hasSupply: (seat, name) => hasSupply(state, seat, name),
    grantSupplies: (seat, names) => grantSupplies(state, seat, names, events),
    crossOffSupply: (seat, name) => crossOffSupply(state, seat, name, events),
    checkSupplies: (seat, name) => checkSupplies(state, state.investigators[seat], name),
    suppliesAt: location => suppliesAtLocation(state, location),
    vengeance: () => vengeancePoints(state),
    recordVengeance: (amount, card) => recordVengeance(state, amount, card),
    isPoisoned: seat => isPoisoned(state.investigators[seat]),
    poison: seat => poisonInvestigator(state, seat, events),
    yigsFury: () => yigsFury(state),
    addYigsFury: amount => addYigsFury(state, amount, events),
    relicOfAges: () => relicOfAges(state),
    relicOfAgesLocation: () => relicOfAgesLocation(state),
    moveRelicOfAges: payload => moveRelicOfAges(state, payload, events),
    expeditionLeader: () => expeditionLeaderSeat(state),
    setExpeditionLeader: seat => setExpeditionLeader(state, seat, events),
    buildExplorationDeck: codes => buildExplorationDeck(state, codes, events),
    addToExplorationDeck: (codes, options) => addToExplorationDeck(state, codes, options),
    explorationDeck: () => [...(state.explorationDeck || [])],
    shuffleExploration: () => { state.explorationDeck = shuffle(state.explorationDeck || [], () => randomValue(state)) },
    // 04060 检查补给品：查看/取走探索牌库顶、弃掉诡计、其余洗回。
    takeExplorationTop: (count = 1) => {
      const deck = state.explorationDeck || []
      const n = Math.min(Math.max(0, Math.floor(count)), deck.length)
      return n ? deck.splice(deck.length - n, n) : []
    },
    addExplorationTop: code => {
      state.explorationDeck ||= []
      state.explorationDeck.push(code)
      return state.explorationDeck.length
    },
    discardExploration: code => {
      state.explorationDiscard ||= []
      state.explorationDiscard.push(code)
      return code
    },
    // 战役记录：卡文件不直写 state.campaign.records（05134 沉湎过去）。
    campaignRecord: key => state.campaign?.records?.[key] ?? null,
    setCampaignRecord: (key, value) => {
      state.campaign ||= {}
      state.campaign.records ||= {}
      if (value == null) delete state.campaign.records[key]
      else state.campaign.records[key] = value
      return state.campaign.records[key] ?? null
    },
    // 第 2 步 P2.2：第二遭遇牌堆（幽灵界）。建堆/加牌/抽牌/洗回/弃牌 + 公开读数；
    // 抽牌走与普通遭遇牌同一条显现管线；牌堆顺序不进入观察投影，只公开张数与弃牌堆。
    extraDeck: (id, codes) => setExtraEncounterDeck(state, id, codes, { shuffle: list => shuffle(list, () => randomValue(state)) }),
    extraDeckInfo: id => extraEncounterDeckInfo(state, id),
    extraDecks: () => extraEncounterDecksInfo(state),
    addExtra: (id, codes, options) => addToExtraEncounterDeck(state, id, codes, options),
    shuffleExtra: (id, codes) => shuffleIntoExtraEncounterDeck(state, id, codes, { shuffle: list => shuffle(list, () => randomValue(state)) }),
    drawExtra: (seat, id, options = {}) => drawExtraEncounter(state, state.investigators[seat], events, id, options),
    // 2026-10-25 本循环修复 05294/05312：遭遇弃牌堆就地结算显现（不经过抽牌/取消/涌动窗口）。
    replayEncounterRevelation: (seat, code) => replayEncounterRevelation(state, state.investigators[seat], events, code),
    discardExtra: (id, count) => discardTopOfExtraEncounterDeck(state, id, count),
    discardExtraCards: (id, codes) => discardFromExtraEncounterDeck(state, id, codes),
    explore: seat => doExplore(state, seat, events),
    // 04289 岌岌可危的悬崖：探索前的多检定链结算完后，继续同一次探索
    // （行动已支付、beforeExplore 已执行，不再重复扣费/重复拦截）。
    resumeExplore: seat => doExplore(state, seat, events, { resumed: true }),
    // 第 2 步 P2.4：塔罗牌组（22 张大阿卡纳，剧本级牌组，不是 05 卡）。
    // 随机只走 randomValue；正逆位、抽牌、N 选 1、洗回、弃置都在这里，状态是纯 JSON。
    // 第 2 步 P2.13：地点牌库（Cosmos / 未知地点）。面朝下抽 X 选 1 → 放置入场 →
    // 原地点上的调查员与敌人一起搬过去；未选中的放回牌库底；Void 地点可洗回。
    cosmos: (options = {}) => {
      const id = options.id || 'cosmos'
      if (options.build) return buildScenarioLocationDeck(state, id, options.build, { shuffle })
      if (options.shuffle) return shuffleScenarioLocationIntoDeck(state, id, options.shuffle, { shuffle: list => shuffle(list, () => randomValue(state)) })
      if (options.discard) return discardScenarioLocation(state, id, options.discard)
      if (options.draw) return drawScenarioLocationDeck(state, id, options.draw)
      if (options.take) {
        const placeId = chooseScenarioLocationDeck(state, id, options.take, {
          requestChoice, seat: options.seat ?? state.currentSeat, source: 'cosmos', prompt: options.prompt,
        })
        if (!placeId) return null
        const from = options.from || null
        const placed = placeLocation(state, placeId, events)
        if (placed && from) {
          for (const inv of aliveInvestigators(state).filter(item => item.location === from)) relocateInvestigator(state, inv.seat, placeId, events)
          for (const enemy of state.enemies.filter(item => item.location === from)) relocateEnemy(state, enemy, placeId, events)
        }
        return placeId
      }
      return scenarioLocationDeckInfo(state, id)
    },
    locationDeck: id => scenarioLocationDeckInfo(state, id || 'cosmos'),
    tarot: {
      build: (options = {}) => buildTarotDeck(state, { ...options, shuffle: list => shuffle(list, () => randomValue(state)) }),
      draw: (seat, options = {}) => drawTarot(state, { ...options, random: () => randomValue(state) }),
      choose: (seat, options = {}) => chooseTarot(state, { ...options, seat, requestChoice, random: () => randomValue(state) }),
      shuffleInto: (options = {}) => shuffleTarotIntoDeck(state, { ...options, shuffle: list => shuffle(list, () => randomValue(state)) }),
      discard: arcana => discardDrawnTarot(state, arcana),
      remaining: () => tarotRemaining(state),
      info: () => tarotInfo(state),
    },
    tarotRemaining: () => tarotRemaining(state),
    tarotInfo: () => tarotInfo(state),
    tarotOrientation: raw => tarotOrientation(raw),
    drawCards: (seat, n) => drawCards(state, state.investigators[seat], n, events),
    // 2026-10-25 本循环修复 testOtherInvestigatorTrigger（05246/05248）：剧本钩子在检定中
    // 替非检定者降难度（与 api-test.js 同一份状态字段口径）。
    reduceTestDifficulty: (amount = 1) => {
      if (!state.skillTest) return 0
      state.skillTest.difficultyReduction = (state.skillTest.difficultyReduction || 0) + amount
      state.skillTest.difficulty = Math.max(0, (state.skillTest.difficulty || 0) - amount)
      return state.skillTest.difficulty
    },
    drawMadnessWeakness: seat => drawMadnessWeakness(state, state.investigators[seat], events),
    // 04165 穿越界限：从收藏里随机获得一张基础[[疯狂]]或[[损伤]]弱点并洗入牌库。
    addBasicWeakness: (seat, traits = ['madness', 'injury']) =>
      addBasicWeakness(state, state.investigators[seat], events, traits),
    // 2026-10-25 第五轮修复（05200/05201）：剧情资产附属到敌人（复用 attachCardTo 的实例结构）。
    attachStoryAssetToEnemy: (code, enemyId, extra = {}) => {
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (!enemy || !code) return null
      return attachCardTo(state, null, code, enemy, extra)
    },
    // 2026-10-28 P1：剧本/遭遇卡附属到地点（疯狂生长 04076 / 屋中无人 04145 / 怨灵作祟 03094 …）。
    // 走 location-attachments.js 的唯一写入口（location.attachments），卡文件不再直接 push。
    attachToLocation: (locationId, fields = {}) => attachLocationCard(state, locationId, { scope: 'location', ...fields }),
    // 「附属到地点，帷幕 +N」的雾/阴影诡计（01168 朦胧之雾）：与 api-clue 的同一实现。
    attachShroud: (locationId, amount = 2, code = null) => addLocationShroud(state, locationId, amount, code),
    // 地点帷幕临时修正（03262 地下深坑「附属地点隐藏值 +1」）：与 api-misc 的同一实现。
    setShroudMod: (location, amount) => setLocationShroudMod(location, amount),
    // 调查员获得特性（04085 伊格的诅咒）：与 api-misc 的同一实现。
    addInvestigatorTrait: (seat, trait) => {
      const owner = state.investigators[seat]
      if (!owner || !trait) return false
      owner.traits = [...new Set([...(owner.traits || []), String(trait)])]
      return true
    },
    detachEnemyAttachment: (enemyId, attachmentId) => {
      const enemy = state.enemies.find(item => item.id === enemyId)
      if (!enemy?.attachments) return null
      const index = enemy.attachments.findIndex(item => item.id === attachmentId)
      if (index < 0) return null
      return enemy.attachments.splice(index, 1)[0]
    },
    // 2026-10-25 第五轮修复（05239/05241/05242）：通用「资源标记」载体（记在敌人/地点/卡实例上）。
    addMarker: (target, label = 'resource') => {
      if (!target) return null
      target.markers ||= []
      target.markers.push(label)
      return target.markers.length
    },
    removeMarker: (target, label = 'resource') => {
      if (!target?.markers) return 0
      const index = target.markers.indexOf(label)
      if (index >= 0) target.markers.splice(index, 1)
      return target.markers.length
    },
    markers: target => (target?.markers ? [...target.markers] : []),
    // 2026-10-25 第五轮修复（05110）：地点当前帷幕的完整读点（含剧本/地点修正与雾）。
    locationShroud: locationId => {
      const location = state.locations.find(loc => loc.id === locationId)
      if (!location) return null
      const inv = state.investigators[state.currentSeat]
      const scenarioShroud = (scenarioBehavior(state).locationShroudModifier?.(state, location, inv) || 0)
        + entityModifierTotal(state, location, 'locationShroud')
      return location.shroud + (location.shroudMod || 0)
        + (state.fogMod || 0) + scenarioShroud
    },
    gainClues: (seat, n) => { const inv = state.investigators[seat]; inv.clues += n; syncClues(state); scenarioBehavior(state).cluesGained?.(state, inv, n, scenarioRuntime(state, events)) },
    // 02224「发现任意地点的 1 个线索」：按目标地点走 canDiscoverClues（02213 学校只能靠调查）。
    discoverClue: (seat, amount = 1, locationId = null) =>
      discoverClueAt(state, state.investigators[seat], amount, events, { locationId: locationId ?? undefined }),
    canDiscoverClueAt: (seat, locationId) =>
      canDiscoverClueAt(state, state.investigators[seat], state.locations.find(loc => loc.id === locationId)),
    damageEnemy: (enemyId, amount, seat, source = null) => {
      const enemy = state.enemies.find(item => item.id === enemyId)
      return damageEnemy(state, enemy, amount, seat, events, source)
    },
    enemyFight: (enemy, seat) => enemyFightValue(state, enemy, state.investigators[seat]),
    engage: (enemy, seat) => engageEnemy(state, enemy, seat, events),
    evadeEnemy: enemy => autoEvadeEnemy(state, enemy, events),
    revealToken: (seat = state.currentSeat) => {
      beginChaosTest(state)
      const token = drawChaosToken(state)
      endChaosTest(state, [token])
      const inv = state.investigators[seat]
      const replacement = scenarioBehavior(state).chaosTokenRevealed?.(state, inv, token, scenarioRuntime(state, events))
      return replacement ?? token
    },
    choose: request => requestChoice(state, request),
    // 兼容别名（2026-10-28 收口）：与 `choose` 同一个 requestChoice；canonical 是 `choice`
    // （玩家侧一直用这个名），遭遇侧旧代码继续用 `choose`，新代码只用 `choice`。
    choice: request => requestChoice(state, request),
    // 第四循环P2.1：闹鬼。`haunted(seat, { locationId, times, kind })` 结算一次（可重复）；
    // `hauntedAt(id)` 读「这个地点是否闹鬼」；`grantHaunted/grantHauntedClear` 管理授予的能力
    // （05102「每个地点获得：闹鬼 - 受到 1 点恐惧」这类）。参数形状由 haunted.js 在登记期校验。
    haunted: (seat, options = {}) => resolveHaunted(state, seat, options, scenarioRuntime(state, events), events),
    hauntedAt: id => hauntedAbilitiesAt(state, id),
    hauntedIs: id => isLocationHaunted(state, id),
    grantHaunted: grant => grantHaunted(state, grant),
    clearHauntedGrants: predicate => clearHauntedGrants(state, predicate),
    privateInfo: (seat, text) => privateInfo(state, events, seat, text),
    // 揭示/翻面是把卡牌正面朝上摆到桌上给全桌看：即使发生在某人的个人检定结算内
    // （如「最后的王者」AI 完成会谈触发翻面），演出也不能按 privateSeat 只发给执行者，
    // 否则其他玩家看不到翻开的卡面。
    cardReveal: (code, title = '卡牌结算') => {
      const card = cardDef(code)
      const name = card?.nameZh || card?.name || cardName(code)
      const text = [
        card?.flavorZh || card?.flavor,
        card?.textZh || card?.text,
      ].filter(Boolean).join('\n\n') || '揭示卡牌并结算其效果。'
      info(state, events, `揭示「${name}」并结算其效果。`, {
        kind: 'story', title, code, face: 'front', name, text, flip: true,
      }, { public: true })
    },
    cardFlip: (code, title = '卡牌翻面') => {
      const front = cardDef(code)
      const reverseCode = front?.linkedCardCode || front?.linkedToCode
      const reverse = cardDef(reverseCode)
      const reverseName = reverse?.nameZh || reverse?.name || cardName(reverseCode || code)
      const reverseText = [
        reverse?.flavorZh || reverse?.flavor,
        reverse?.textZh || reverse?.text,
      ].filter(Boolean).join('\n\n') || '翻开卡牌并结算背面的效果。'
      info(state, events, `翻开「${cardName(code)}」并结算「${reverseName}」。`, {
        kind: 'story', title, code, face: 'back', name: reverseName, text: reverseText, flip: true,
      }, { public: true })
    },
    flipLocation: (id, seat) => flipScenarioLocation(state, id, seat, events),
    // 第 2 步 P2.12：异端者多面与放逐（面的代码/属性来自关卡数据与卡面定义）。
    flipEnemy: (enemy, nextCode) => flipEnemyFace(state, enemy, nextCode, { defOf: code => cardDef(code), newCardInstance, info, events }),
    enemyFace: enemy => enemyFace(enemy),
    banish: enemy => banishEnemyToVictory(state, enemy, { info, events }),
    // 第 2 步 P2.11：裂口与地点布尔状态（火盆）。
    breach: (id, amount = 1, options) => addBreach(state, id, amount, options),
    removeBreach: (id, amount = 1) => removeBreach(state, id, amount),
    breachOf: id => breachOf((state.locations || []).find(location => location.id === id)),
    breachTotal: () => breachTotal(state),
    skullValue: id => locationSkullValue(state, id),
    locationFlag: id => {
      const location = (state.locations || []).find(item => item.id === id)
      return LOCATION_FLAG_KEYS.reduce((out, flag) => { out[flag] = locationFlagOf(location, flag); return out }, {})
    },
    setLocationFlag: (id, flag, value = true) => setLocationFlag(state, id, flag, value),
    hasLocationFlag: (id, flag) => locationFlagOf((state.locations || []).find(location => location.id === id), flag),
    // 第 2 步 P2.3：幽灵地点。flipSpectral 按 definition 里声明的 back 面翻面（保留线索/毁灭），
    // isSpectral 是「这个地点是不是幽灵地点」的单一读点（幽灵敌人的目标限制读它）。
    flipSpectral: (id, seat, options) => flipLocationFace(state, id, seat, events, options),
    isSpectral: id => isSpectralLocation(state, id),
    spectralFace: id => spectralFaceOf((state.locations || []).find(location => location.id === id)),
    drawEncounter: seat => { const inv = state.investigators[seat]; if (!inv.defeated && !inv.resigned) drawEncounter(state, inv, events) },
    threat: (seat, code, extra = {}) =>
      state.investigators[seat].threat.push(newCardInstance(state, code, extra)),
    discardTop: (seat, n) => {
      const inv = state.investigators[seat]
      const discarded = []
      for (let i = 0; i < n && inv.deck.length; i++) {
        const card = inv.deck.pop()
        inv.discard.push(card)
        discarded.push(card)
        scenarioBehavior(state).deckEmptied?.(state, inv, scenarioRuntime(state, events))
        if (inv.defeated) break
      }
      return discarded
    },
    giveAsset: (seat, code, extra = {}) => {
      const inv = state.investigators[seat]
      if (scenarioBehavior(state).canPlaceAsset?.(state, inv, code) === false) {
        info(state, events, `⛔ 「${cardName(code)}」当前不能放置入场。`)
        return null
      }
      const asset = newCardInstance(state, code, { exhausted: false, ...extra })
      inv.assets.push(asset); scenarioBehavior(state).assetEntered?.(state, inv, asset, scenarioRuntime(state, events))
      return asset
    },
    canPlayAsset: (seat, code) => !scenarioAssetPlayError(state, state.investigators[seat], code),
    playAsset: (seat, code) => {
      const inv = state.investigators[seat]
      const error = scenarioAssetPlayError(state, inv, code)
      if (error) throw new Error(error)
      inv.hand.push(code)
      doPlay(state, seat, code, events, false, true)
      return inv.assets.findLast(asset => asset.code === code)
    },
    // 击败/退场：`cause === 'killed'` 时把战役记录同步标记为 killed（「被击败后结算」的
    // 卡——如 04289 坠崖——只声明结果，账本字段由引擎统一写，卡条目不再直写 campaign 记录）。
    defeat: (inv, cause = null) => {
      if (!inv) return
      inv.defeated = true
      inv.defeatCause = cause
      eliminateInvestigator(state, inv, events)
      if (cause === 'killed') {
        const record = state.campaign?.investigators?.[inv.seat]
        if (record) record.status = 'killed'
      }
    },
    drawEncounterLocation: seat => {
      if (!scenarioBehavior(state).drawEncounterLocation) throw new Error('当前剧本没有遭遇地点处理器')
      return scenarioBehavior(state).drawEncounterLocation(state, seat, scenarioRuntime(state, events))
    },
    placeEncounterLocation: code => {
      const def = Object.values(state.scenario.locations).find(l => l.originalCode === code)
      if (!def) throw new Error(`未知遭遇地点：${code}`)
      state.scenarioZones.locationSeq = (state.scenarioZones.locationSeq || 0) + 1
      const loc = { ...structuredClone(def), id: `${def.id}-${state.scenarioZones.locationSeq}`, revealed: true,
        clues: def.cluesFixed ?? def.cluesPerInvestigator * state.numInvestigators }
      state.locations.push(loc)
      // Refresh the symbol graph additively instead of rebuilding every list:
      // drop ids that no longer exist, then re-add the printed symbol edges for
      // all symbol locations. Keeps hand-made links (e.g. 02214 hidden chamber)
      // that the old overwrite used to wipe.
      for (const here of state.locations) {
        if (!here.symbols || !Array.isArray(here.connections)) continue
        here.connections = here.connections.filter(id => state.locations.some(other => other.id === id))
      }
      for (const here of state.locations) linkLocationBySymbols(state, here)
      return loc
    },
    discardRandom: (seat, n) => discardRandomFromHand(state, state.investigators[seat], n, events),
    discardChosen: (seat, n, source = 'encounter') => {
      const inv = state.investigators[seat]
      for (let i = 0; i < n; i++) {
        const options = inv.hand.flatMap((code, index) => canDiscardFromHand(inv, code)
          ? [{ id: String(index), label: cardName(code) }] : [])
        if (!options.length) break
        const index = Number(requestChoice(state, {
          kind: 'discard', source, seat, prompt: `选择弃掉一张手牌（${i + 1}/${n}）。`, options,
        }))
        inv.discard.push(inv.hand.splice(index, 1)[0])
      }
    },
    drawDiscard: (seat, index) => {
      const inv = state.investigators[seat], code = inv.discard.splice(index, 1)[0]
      inv.deck.push(code); drawCards(state, inv, 1, events)
    },
    drawEncounterDiscard: (seat, index) => { state.encounterDeck.push(state.encounterDiscard.splice(index, 1)[0]); drawEncounter(state, state.investigators[seat], events) },
    shuffleDiscard: () => {
      state.encounterDeck = shuffle([...state.encounterDeck, ...state.encounterDiscard], () => randomValue(state))
      state.encounterDiscard = []
    },
    shuffleEncounterDeck: () => { state.encounterDeck = shuffle(state.encounterDeck, () => randomValue(state)) },
    discardEnemy: enemy => discardEnemyCard(state, enemy),
    removeEnemyFromGame: enemy => {
      if (!state.enemies.includes(enemy)) return false
      disengageEnemy(state, enemy)
      removeOne(state.enemies, enemy)
      state.removedFromGame ||= []
      state.removedFromGame.push(enemy.originalCode || enemy.code)
      return true
    },
    checkEnemyDefeat: (enemy, source = null, seat = null) => {
      if (state.enemies.includes(enemy) && enemy.damageTaken >= enemyHealth(state, enemy)
        && enemyCanBeDefeated(state, enemy, source, seat)) {
        defeatEnemy(state, enemy, events)
        return true
      }
      return false
    },
    attackFromDiscard: (code, seat) => {
      if (!state.encounterDiscard.includes(code)) return false
      const inv = state.investigators[seat]
      const enemy = spawnEnemy(state, code, inv.location, seat, true, true)
      if (!enemy) return false
      enemyAttack(state, enemy, inv, events, `「${enemy.name}」从弃牌堆发动攻击。`, { kind: 'effect' })
      return true
    },
    devourLocation: id => {
      for (const inv of aliveInvestigators(state).filter(i => i.location === id)) {
        inv.defeated = true; inv.defeatCause = null; eliminateInvestigator(state, inv, events)
      }
      for (const enemy of state.enemies.filter(e => e.location === id)) discardEnemyCard(state, enemy)
      const lost = (state.storyAssets || []).filter(a => a.location === id)
      for (const asset of lost) removeOne(state.storyAssets, asset)
      // "Place it in the victory display instead if it has Victory X and no clues."
      const devoured = state.locations.find(loc => loc.id === id)
      if (devoured && devoured.victory && (devoured.clues || 0) === 0
        && !state.victoryDisplay.some(card => card.id === devoured.id)) {
        state.victoryDisplay.push({ id: devoured.id, code: devoured.originalCode || devoured.code,
          originalCode: devoured.originalCode || devoured.code, victory: devoured.victory })
        info(state, events, `💎 「${devoured.name}」无线索且带胜利点，被放入胜利展示区。`)
      }
      removeLocation(state, id, events)
      for (const asset of lost) scenarioBehavior(state).storyAssetLeftPlay?.(state, asset, scenarioRuntime(state, events))
    },
    // P3 批次 2：6 个纯数据原语（counters / swarming / swarm / veiled / tokenBag / verticalChain）。
    // 只读函数不建字段，既有循环不会因这行扩展产生行为或字节变化。
    ...scenarioRuntimeExtras(state),
  }
}

  return scenarioRuntime
}
