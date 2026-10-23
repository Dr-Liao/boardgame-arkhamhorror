// 剧本运行时（scenarioRuntime）从 engine.js 拆出的模块（Phase 6 · 6d-13）。
//
// 剧本内容（遭遇卡、地点、密谋、议程）拿不到引擎内部，只能拿到这个窄接口：
// 放置地点、生成敌人、造成伤害、抽遭遇、推进密谋…… 它本质是「内容层 ↔ 引擎」的边界对象。
// 拆成独立模块后，这个边界从 90 个依赖一眼可见，也方便后续战役插件化时按战役切分。
//
// 依赖注入同前几批；被多个 api 依赖表引用的 doPlay / performTest 用惰性 thunk。

import { linkLocationBySymbols } from './locations.js'

export function createScenarioRuntime(deps) {
  const {
    EFFECTS,
    addBasicWeakness,
    addDoom,
    addToExplorationDeck,
    addTrauma,
    addYigsFury,
    advanceAct,
    advanceAgenda,
    aliveInvestigators,
    applyDamage,
    applyHarm,
    applyHorror,
    autoEngageAll,
    autoEvadeEnemy,
    beginChaosTest,
    basicWeaknessPool,
    buildExplorationDeck,
    campaignCardChange,
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
    finishScenario,
    flipScenarioLocation,
    grantSupplies,
    groupPayment,
    hasSupply,
    hunterStep,
    info,
    investigateTest,
    isPoisoned,
    isWeaknessCode,
    leaveAsset,
    leadDecisionSeat,
    locName,
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
    recordVengeance,
    registeredEntry,
    relicOfAges,
    relicOfAgesLocation,
    relocateEnemy,
    relocateInvestigator,
    removeLocation,
    removeOne,
    requestChoice,
    revealLocation,
    ruleCodeForOriginal,
    scenarioAssetPlayError,
    scenarioBehavior,
    setExpeditionLeader,
    shuffle,
    spawnEnemy,
    spawnStoryAsset,
    spawnStoryEnemy,
    spendAction,
    spendClues,
    stepToward,
    suppliesAtLocation,
    suppliesFor,
    syncClues,
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
    shuffle: list => shuffle(list, () => randomValue(state)),
    defeatAll: () => defeatAll(state, events),
    discardUntilEnemyTrait: trait => discardUntilEnemyTrait(state, trait, events),
    decideSeat: () => leadDecisionSeat(state),
    preyTarget: (rule, seats) => preyTarget(state, rule, seats),
    ruleCode: original => ruleCodeForOriginal(original),
    basicWeaknesses: trait => basicWeaknessPool().filter(code =>
      (cardDef(code)?.traits || []).some(value => String(value).toLowerCase() === String(trait).toLowerCase())),
    isWeaknessCode: code => isWeaknessCode(code),
    spendAction: seat => spendAction(state, state.investigators[seat]),
    campaignCardChange: (...args) => campaignCardChange(...args),
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
    autoEngageAll: () => autoEngageAll(state, events),
    place: id => placeLocation(state, id, events),
    reveal: id => revealLocation(state, id, events),
    remove: id => removeLocation(state, id, events),
    spawn: (code, location) => spawnEnemy(state, code, location, null, true),
    spawnEngaged: (code, location, seat) => spawnEnemy(state, code, location, seat),
    // 从玩家牌/无目录数据生成的敌人（04331 飞天水螅：把牌库顶的牌视为敌人）。
    spawnStoryEnemy: (code, location, stats = {}, extra = {}) => spawnStoryEnemy(state, code, location, stats, extra, events),
    attack: (enemy, inv) => enemyAttack(state, enemy, inv, events, '剧本效果', { kind: 'effect' }),
    // 「无视卡牌效果」通用开关（失落时代 P2）：共享解析器与章节 behavior 在
    // 自己的攻击循环里也能用同一份判定。Phase 3（D1）起，敌人自己的卡面声明优先。
    cannotAttack: enemy => enemyCannotAttack(state, enemy),
    cannotBeAttacked: enemy => enemyCannotBeAttacked(state, enemy),
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
      if (state.phase === 'investigation') inv.actionsLeft = Math.max(0, inv.actionsLeft - n)
      else {
        inv.pendingActionLoss ||= {}
        inv.pendingActionLoss[state.round] = (inv.pendingActionLoss[state.round] || 0) + n
      }
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
        if (!asset.removedFromGame) inv.discard.push(asset.code)
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
        if (!asset.removedFromGame) inv.discard.push(asset.code)
        if (registeredEntry(asset.code)?.defeatedDamage) defeatedAssetRetaliation(state, inv, registeredEntry(asset.code).defeatedDamage, events)
      }
    },
    discardAsset: (seat, assetId) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return null
      leaveAsset(state, inv, asset, events)
      if (!asset.removedFromGame) inv.discard.push(asset.code)
      return asset.code
    },
    shuffleAssetIntoDeck: (seat, assetId) => {
      const inv = state.investigators[seat], asset = inv.assets.find(item => item.id === assetId)
      if (!asset) return null
      leaveAsset(state, inv, asset, events)
      if (!asset.removedFromGame) inv.deck.push(asset.code)
      inv.deck = shuffle(inv.deck, () => randomValue(state))
      return asset.code
    },
    test: (seat, skill, difficulty, resolve, skillBonus = 0, source = null, options = {}) =>
      performTest(state, seat, skill, difficulty, { ...options, resolve, skillBonus, source: source || testSource }),
    investigate: (seat, options = {}) => doInvestigate(state, seat, options, events, true),
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
    finish: key => finishScenario(state, key, events),
    resign: seat => doResign(state, seat, events),
    advanceAct: () => advanceAct(state, events),
    advanceAgenda: () => advanceAgenda(state, events),
    clearDoom: () => {
      state.doom = 0
      for (const card of doomCards(state)) card.doom = 0
      scenarioBehavior(state).doomCleared?.(state, scenarioRuntime(state, events))
    },
    addDoom: n => addDoom(state, n, events),
    // 在「某一张卡」上放毁灭的统一入口（敌人在内）：走 doomPlaced 钩子与 04265 手铐拦截。
    doomOn: (card, amount = 1) => placeDoomOnCard(state, card, amount, events, { silent: true }),
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
    explore: seat => doExplore(state, seat, events),
    drawCards: (seat, n) => drawCards(state, state.investigators[seat], n, events),
    drawMadnessWeakness: seat => drawMadnessWeakness(state, state.investigators[seat], events),
    // 04165 穿越界限：从收藏里随机获得一张基础[[疯狂]]或[[损伤]]弱点并洗入牌库。
    addBasicWeakness: (seat, traits = ['madness', 'injury']) =>
      addBasicWeakness(state, state.investigators[seat], events, traits),
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
    privateInfo: (seat, text) => privateInfo(state, events, seat, text),
    cardReveal: (code, title = '卡牌结算') => {
      const card = cardDef(code)
      const name = card?.nameZh || card?.name || cardName(code)
      const text = [
        card?.flavorZh || card?.flavor,
        card?.textZh || card?.text,
      ].filter(Boolean).join('\n\n') || '揭示卡牌并结算其效果。'
      info(state, events, `揭示「${name}」并结算其效果。`, {
        kind: 'story', title, code, face: 'front', name, text, flip: true,
      })
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
      })
    },
    flipLocation: (id, seat) => flipScenarioLocation(state, id, seat, events),
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
    defeat: (inv, cause = null) => { inv.defeated = true; inv.defeatCause = cause; eliminateInvestigator(state, inv, events) },
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
  }
}

  return scenarioRuntime
}
