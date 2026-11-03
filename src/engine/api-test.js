import { replacePlayerZoneCards } from './player-zones.js'
// 能力 API · 检定与投入（Phase 6 · 6d-10，abilityApi 第四批）。
//
// 这一组方法覆盖「一次技能检定期间」的读取与修正：加值、重试、投入技能牌、
// 查看/检索牌堆、描述限制与检定结果、成功后结算、阶段/待决加值。
// 与前三批相同的工厂形状（createXxxApi(state, events, deps)）。

import { canCommitToTest, payCommitResourceCost } from './commit-rules.js'

export function createTestApi(state, events, deps) {
  const {
    applyHarm,
    cardDef,
    registeredEntry,
    randomValue,
    shuffle,
    cardName,
    commitIcons,
    describeLimit,
    describeLook,
    describeSearch,
    describeTestResult,
    info,
    lookAt,
    moveCardTo,
    performTest,
    searchDeck,
    testStage,
  } = deps

  return {
    captureTreacheryWithSkill: (item, options = {}) => {
      const test = state.skillTest
      const code = test?.source?.code || state._treacheryResolving
      if (!test?.committed.includes(item) || cardDef(code)?.type !== 'treachery') return false
      state.victoryDisplay ||= []
      let capture = state.victoryDisplay.find(card => card.id === test.capturedTreacheryId)
      if (!capture) {
        const sourceId = test.source?.instanceId || test.source?.id
        const collections = state.investigators.flatMap(inv => [inv.threat, ...inv.assets.map(asset => asset.attachments || [])])
          .concat(state.locations.map(location => location.attachments || []),
            (state.acts || []).map(act => act.attachments || []), (state.agendas || []).map(agenda => agenda.attachments || []))
        const matches = collections.flatMap(list => list.filter(card => (card.originalCode || card.code) === code
          && (!sourceId || card.id === sourceId)).map(card => ({ list, card })))
        const physical = matches.length > 1 ? matches[Number(deps.requestChoice(state, { kind: 'card', seat: test.seat,
          source: code, prompt: '选择本次检定的诡计实体。', options: matches.map(({card},index) => ({id:String(index),label:card.id,cardCode:code})) }))] : matches[0]
        if (physical) physical.list.splice(physical.list.indexOf(physical.card), 1)
        capture = { id: `captured:${state.round}:${state.moveCount}:${state.victoryDisplay.length}`, code,
          name: cardDef(code).name, victory: 0, attachments: [] }
        state.victoryDisplay.push(capture)
        test.capturedTreacheryId = capture.id
      }
      capture.attachments.push({ code: item.code, ownerSeat: item.seat, contributesIconsToSameNameTests: options.icons === true })
      item.destination = 'attached'
      return true
    },
    addTestValue: amount => { if (state.skillTest) state.skillTest.value = (state.skillTest.value || 0) + amount },
    replaceTokenEffect: (context, replacement) => {
      if (!state.skillTest || context?.when !== 'tokenEffectWouldResolve' || !Number.isFinite(replacement?.delta)) return false
      context.replacementEffect = { ...replacement }
      return true
    },
    replaceTestSkill: skill => {
      if (!state.skillTest || !['willpower','intellect','combat','agility'].includes(skill)
        || !['ST.1','ST.2'].includes(state.skillTest.stage)) return false
      state.skillTest.skill = skill
      return true
    },
    cancelCurrentSymbol: (context, options = {}) => {
      if (!state.skillTest || context?.when !== 'symbolRevealed'
        || state.skillTest.currentToken !== context.token) return false
      state.skillTest.cancelledSymbol = context.token
      state.skillTest.cancelledSymbolSource = options.sourceCode || null
      return true
    },
    // 第 5 步 P6：「本次检定难度 -N」（序章故事调查员瓦伦蒂诺）。与 addTestValue 分开，
    // 因为「降低难度」与「提高技能值」在结算与展示上是两件事。读点：tests.js 在判定前
    // 统一扣减 state.skillTest.difficultyReduction。
    reduceTestDifficulty: (amount = 1) => {
      if (!state.skillTest) return 0
      state.skillTest.difficultyReduction = (state.skillTest.difficultyReduction || 0) + amount
      state.skillTest.difficulty = Math.max(0, (state.skillTest.difficulty || 0) - amount)
      return state.skillTest.difficulty
    },
    // Phase 2（B2）：伤害/恐惧的统一入口，可以指定分配策略。
    //   strategy: 'distribute'（默认，逐点询问）| 'self' | 'assetsFirst' | 'assetsOnly'
    harm: (seat, spec = {}) => {
      const target = state.investigators[seat] || state.investigators[state.currentSeat]
      if (!target) return null
      applyHarm(state, target, spec.damage || 0, spec.horror || 0, events,
        spec.direct === true, spec.attack || null, spec.assetsFirst === true, spec.strategy || null)
      return target
    },
    // Phase 2（B3）：检定结果契约。
    testResult: () => state.lastTestResult || null,
    describeTest: () => describeTestResult(state.lastTestResult),
    testStage: () => testStage(state.skillTest?.stage),
    canCommitCard: (seat, code, options) => canCommitToTest(state, state.investigators[seat], code, deps, options),
    revealAndCommitSkill: (seat, options = {}) => {
      const inv = state.investigators[seat]
      if (!inv || !state.skillTest) return null
      const revealed = []
      let found = null
      while (inv.deck.length) {
        const code = inv.deck.pop()
        const card = cardDef(code)
        info(state, events, `揭示「${cardName(code)}」。`, { kind: 'reveal', card: code })
        if (card?.type === 'skill' && (!options.class || card.klass === options.class)
          && canCommitToTest(state, inv, code, deps)) { found = code; break }
        revealed.push(code)
      }
      inv.deck = replacePlayerZoneCards(state, inv, shuffle([...inv.deck, ...revealed], () => randomValue(state)), 'shuffle')
      if (found) {
        const icons = commitIcons(state, inv, found, state.skillTest.skill)
        state.skillTest.committed.push({ seat, code: found, icons })
        state.skillTest.value = (state.skillTest.value || 0) + icons
      }
      return found
    },
    // 「失败后重试」：用同一份 skill / difficulty / source 重跑一次检定，可加值。
    retryTest: (seat, options = {}) => {
      const last = state.lastTestResult
      if (!last) return null
      return performTest(state, Number.isInteger(seat) ? seat : (last.seat ?? state.currentSeat),
        last.skill, last.difficulty, {
          source: last.source ? { ...last.source, label: `${last.source.label || '检定'}（重试）` } : null,
          skillBonus: options.bonus || 0,
          resolve: options.resolve,
        })
    },
    // 「强制投入」：不询问就把手牌放进本次检定（返回增加的点数）。
    commitCards: (seat, codes = [], options = {}) => {
      const owner = state.investigators[seat]
      if (!owner || !state.skillTest) return 0
      let added = 0
      for (const code of codes) {
        const index = owner.hand.indexOf(code)
        if (index < 0) continue
        if (!canCommitToTest(state, owner, code, deps, options)) continue
        if (!options.ignoreAdditionalCosts && !payCommitResourceCost(state, owner, code, deps)) continue
        owner.hand.splice(index, 1)
        const icons = commitIcons(state, owner, code, state.skillTest.skill)
        state.skillTest.value = (state.skillTest.value || 0) + icons
        state.skillTest.committed.push({ seat: owner.seat, code, icons,
          ...(options.source ? { sourceCode: options.source } : {}),
          ...(options.onSuccessDestination ? { onSuccessDestination: options.onSuccessDestination } : {}),
          ...(options.onFailDestination ? { onFailDestination: options.onFailDestination } : {}) })
        info(state, events, `${owner.name} 强制投入「${cardName(code)}」（${icons} 个图标）。`, null, { public: true })
        added += icons
      }
      return added
    },
    reduceNextTestDifficulty: (seat, amount) => {
      const inv = state.investigators[seat]
      if (!inv || !(amount > 0)) return false
      const phase = state.immediateAction?.returnPhase || state.phase
      const previous = inv.nextTestDifficultyReduction
      inv.nextTestDifficultyReduction = { amount: amount + (previous?.round === state.round && previous.phase === phase ? previous.amount : 0),
        round: state.round, phase }
      return true
    },
    setTestAutoSuccess: () => {
      if (!state.skillTest) return false
      state.skillTest.autoSuccess = true
      state.skillTest.skipTokens = true
      return true
    },
    // 2026-10-25 第七轮修复 05029：把进行中的检定改为「资源技能检定」。
    convertTestToResourceSkill: (seat) => {
      const test = state.skillTest
      if (!test) return null
      const inv = state.investigators[Number.isInteger(seat) ? seat : test.seat]
      if (!inv) return null
      const base = Math.floor((inv.resources || 0) / 2)
      const previousBase = Number(test.baseValue || 0)
      const kept = (Number(test.value || 0) - previousBase)
      test.baseValue = base
      test.printedValue = base
      test.value = base + kept
      test.resourceSkill = true
      test.skill = []
      return { base, value: test.value, kept }
    },
    // 2026-10-25 第六轮修复 05119：「投入卡后」的反应可以给本次检定追加图标。
    addCommittedCardIcons: (seat, count = 1) => {
      if (!state.skillTest) return 0
      const amount = Math.max(0, Number(count) || 0)
      state.skillTest.extraCommittedIcons = (state.skillTest.extraCommittedIcons || 0) + amount
      const owner = state.investigators[seat]
      if (owner && amount > 0) info(state, events, `${owner.name} 因投入卡牌获得 ${amount} 个检定图标。`)
      return state.skillTest.extraCommittedIcons
    },
    // Phase 2（B5）：看牌与检索。
    lookAt: (seat, options) => lookAt(state, seat, options, events),
    searchDeck: (seat, options) => searchDeck(state, seat, options, events),
    describeLook,
    describeSearch,
    // Phase 2（B6）：把一张牌搬到别处（默认按当前行动者）。
    moveCard: spec => moveCardTo(state, state.investigators[state.currentSeat], spec, events),
    // Phase 2（C4）：上限的描述文案（AI 上下文/图鉴用）。
    describeLimit: descriptor => describeLimit(descriptor),
    // Phase 2 收尾：迁移逃生卡时需要的几个薄包装（都只是已有引擎入口的别名，
    // 内容层仍然不直接改 state）。
    addPendingTestBonus: amount => {
      if (!state.skillTest) return 0
      state.skillTest.pendingBonus = (state.skillTest.pendingBonus || 0) + amount
      return state.skillTest.pendingBonus
    },
    // Phase 5（5c-18）：「田野调查」这类「本阶段下一次技能检定 +N」。读点仍在 performTest 里
    // （inv.fieldwork 的字段名沿用旧原语，避免改读点形状；行为与迁移前逐字一致）。
    phaseTestBonus: (seat, amount = 2) => {
      const owner = state.investigators[seat]
      if (!owner) return 0
      owner.fieldwork = { round: state.round, phase: state.phase, amount }
      return amount
    },
  }
}
