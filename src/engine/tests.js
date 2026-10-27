import { enemyRuleFlags, investigatorRule } from '../cards/card-rules.js'
import { SKILL_NAMES } from './presentation-constants.js'
import { handCommitBlocker } from './tarot-slot.js'
// 技能检定主流程（performTest）从 engine.js 拆出的最大模块（Phase 6 · 6d-12）。
//
// 一次检定跨 ST.1–ST.8 八个阶段：投入 → 揭示标记 → 结算修正 → 结果回调 → 收尾。
// 它调用几乎所有子系统（卡牌投入、混乱标记、隐藏卡、反应窗口、暴露弱点），
// 因此依赖表有 61 项——这是拆分过程中依赖最多的一块，也是「engine.js 仍然是编排层」的关键证据：
// 主流程本身搬走后，engine.js 只剩各域动作与阶段机的调度。
//
// 依赖注入同前；resolve 回调不可序列化，仍然挂在 WeakMap（见 engine.js 的 testResolvers）。

// 第 2 步 P2.5：技能可以是单个技能名，也可以是 2–4 个技能的数组（阵法）。
// 规范化在进入检定流程前完成，单技能调用得到 ['<skill>']，后续求和与单值完全一致。
// 技能名表与引擎其它日志同源（presentation-constants），不复制中文。
const TEST_SKILL_NAMES = Object.freeze({ ...SKILL_NAMES, wild: '万能' })

export function normalizeTestSkills(skill) {
  const list = Array.isArray(skill) ? skill : [skill]
  if (!list.length) throw new Error('技能检定至少需要一个技能')
  for (const name of list) {
    if (typeof name !== 'string' || !TEST_SKILL_NAMES[name]) throw new Error(`未知技能：${JSON.stringify(name)}`)
  }
  if (list.length > 4) throw new Error(`一次检定最多使用 4 项技能（收到 ${list.length} 项）`)
  return [...list]
}

// 单技能时返回与旧实现逐字一致的标签（'智识'），多技能用 '+' 连接（'意志+智识'）。
export function testSkillLabel(skill) {
  const list = Array.isArray(skill) ? skill : [skill]
  return list.map(name => TEST_SKILL_NAMES[name] || name).join('+')
}

export function createPerformTest(deps) {
  const {
    campaignState,
    capabilityBlocked,
    EFFECTS,
    SKILL_NAMES,
    ScenarioEnded,
    activeHiddenRules,
    aliveInvestigators,
    applyFreeTriggers,
    applySkillOnSuccess,
    applyTokenFx,
    beginChaosTest,
    canDiscardFromHand,
    cardDef,
    cardName,
    codexSealedElderSign,
    commitIcons,
    commitProfile,
    discoverClueAt,
    drawCards,
    drawChaosToken,
    elderSignEffect,
    endChaosTest,
    enemiesEngagedWith,
    enemyTextBlanked,
    exilePlayerCard,
    expireEffects,
    getMaxSanity,
    getStat,
    getThreatEffect,
    hasHiddenCard,
    hiddenDefinition,
    hiddenRule,
    info,
    investigatorMoveDestinations,
    investigatorTextBlanked,
    isChargeAsset,
    isWeaknessCode,
    leaveAsset,
    locName,
    lolaCanUseCard,
    makeRuntime,
    minhCommitWildBonus,
    pendingTestResult,
    playerWindow,
    randomValue,
    reactionWindow,
    registeredEntry,
    relocateInvestigator,
    removeHiddenMarker,
    removeOne,
    requestChoice,
    resolveEffect,
    resolveSpecialToken,
    returnChaosToken,
    runtimeCardAvailable,
    scenarioBehavior,
    scenarioRuntime,
    shuffle,
    summarizeTestResult,
    campaignBeforeChaosReveal,
    campaignFailedTestWindow,
    tokenLabel,
    triggerReaction,
  } = deps

// 第 59 轮：地点卡自己的「检定失败」规则（02133/02135/02136、02056 等）由条目声明。
// 引擎在内容层 afterTest 之后统一派发，避免每个章节 behavior 手写一遍。
function runLocationTestFail(state, inv, result, events) {
  if (result.success) return
  const loc = state.locations.find(item => item.id === inv.location)
  if (!loc) return
  registeredEntry(loc.originalCode || loc.code)?.locationRule?.onTestFail?.(
    state, loc, scenarioRuntime(state, events), inv, result)
}

function performTest(state, seat, skill, difficulty, options = {}) {
  beginChaosTest(state)
  // P2.5：多技能合成检定。单技能时 skillList=[skill]，所有求和退化为原值，行为逐字不变。
  let skillList = normalizeTestSkills(skill)
  let skillContext = skillList.length === 1 ? skillList[0] : [...skillList]
  const skillLabel = testSkillLabel(skillList)
  const skillTotal = () => skillList.reduce((sum, name) => sum + getStat(state, inv, name), 0)
  const previousTest = state.skillTest || null
  state.skillTest = { seat, skill: skillContext, difficulty: Math.max(0, difficulty), stage: 'ST.1', committed: [], publicLog: [...state.log],
    ...(options.actionKind ? { actionKind: String(options.actionKind) } : {}),
    source: options.source || { type: 'effect', label: '卡牌效果检定', name: skillLabel + '检定' } }
  const inv = state.investigators[seat]
  const events = []
  difficulty = Math.max(0, difficulty)
  // 全局难度修正（03288 北部塔楼：a 密谋毁灭多于 c 时所有技能检定 -1）。
  const globalDifficulty = scenarioBehavior(state).testDifficultyModifier?.(state, inv, skillContext, difficulty, options.source) || 0
  if (globalDifficulty) {
    difficulty = Math.max(0, difficulty + globalDifficulty)
    state.skillTest.difficulty = difficulty
  }
  // 「纳克特手稿」：本回合下一场检定不揭示混乱标记。
  if (inv.nextTestNoTokens?.round === state.round) {
    delete inv.nextTestNoTokens
    state.skillTest.skipTokens = true
  }
  // 2026-10-25 第七轮修复 05029：资源技能检定——以当前资源数作为基值。
  let statReference = options.resourceSkill === true ? Math.floor((inv.resources || 0) / 2) : skillTotal()
  const startingStat = options.baseValue ?? statReference
  // Phase 5（5a-8）：「谈判」检定难度降低由条目级 negotiationDifficultyReduction 声明。
  const negotiationReduction = inv.assets.reduce((sum, asset) => sum + (registeredEntry(asset.code)?.negotiationDifficultyReduction || 0), 0)
  if (negotiationReduction && options.source?.label?.includes('谈判')) {
    difficulty = Math.max(0, difficulty - negotiationReduction)
    state.skillTest.difficulty = difficulty
  }
  const initialBonus = typeof options.skillBonus === 'function' ? options.skillBonus() : options.skillBonus || 0
  let value = startingStat + initialBonus
  if (inv.fieldwork?.round === state.round && inv.fieldwork.phase === state.phase) {
    value += inv.fieldwork.amount || 2
    delete inv.fieldwork
  }
  if (inv.narrowEscape?.round === state.round && inv.narrowEscape.turnSeat === state.currentSeat) {
    value += inv.narrowEscape.amount || 2
    delete inv.narrowEscape
  }

  if (inv.testBonus) {
    value += inv.testBonus
    info(state, null, `${inv.name} 的检定加成 +${inv.testBonus} 生效。`)
    inv.testBonus = 0
  }

  state.skillTest.printedValue = options.baseValue ?? (options.resourceSkill === true ? Math.floor((inv.resources || 0) / 2) : skillList.reduce((sum, name) => sum + (inv[name] || 0), 0))
  state.skillTest.baseValue = startingStat
  state.skillTest.value = value

  // 「追忆未来」等：技能检定开始（投入之前）的反应窗口。
  {
    const context = { when: 'testBegins', seat, location: inv.location, skill: skillContext, difficulty, baseValue: statReference,
      ...(options.actionKind ? { actionKind: String(options.actionKind) } : {}) }
    triggerReaction(state, seat, 'testBegins', events, context)
    reactionWindow(state, 'testBegins', { ...context, prompt: `${inv.name} 的${skillLabel}检定开始` }, events)
  }
  // 2026-10-25 第七轮修复 05029：testBegins 窗口里把检定改成资源技能检定后，
  // 重新同步 performTest 的局部变量（投入候选/最终值/成功判定都读它们）。
  if (state.skillTest.resourceSkill) {
    skillList = []
    skillContext = []
    statReference = 0
    value = state.skillTest.value
    state.skillTest.value = value
  }
  // 「手稿」等：显现效果期间的检定可以提前取消混乱标记。
  if (state._treacheryResolving) {
    const context = { when: 'revelationTest', seat, location: inv.location, skill: skillContext, difficulty }
    triggerReaction(state, seat, 'revelationTest', events, context)
    for (const other of aliveInvestigators(state).filter(owner => owner.location === inv.location)) {
      if (other.seat !== seat) triggerReaction(state, other.seat, 'revelationTestAlly', events, context)
    }
  }

  // 2026-10-25 本循环修复 testOtherInvestigatorTrigger（05246/05248）：在揭示混乱标记前，
  // 让同地点的「非检定者」各自决定是否花自己的线索降低本次检定难度（peril 检定不开放）。
  // 钩子内可用 api.choose({ seat: other.seat }) 单独询问、api.spendClues / api.reduceTestDifficulty 结算。
  if (!options.peril) {
    const otherRuntime = scenarioRuntime(state, events)
    for (const other of aliveInvestigators(state)) {
      if (other.seat === seat || other.defeated || other.resigned) continue
      scenarioBehavior(state).testOtherInvestigatorTrigger?.(state, other, inv, {
        skill: skillContext, difficulty, source: options.source || null,
        actionKind: options.actionKind ? String(options.actionKind) : null,
      }, otherRuntime)
    }
  }

  // A personal test stays with its owner until they explicitly ask for help.
  playerWindow(state, 'test.beforeCommit', events, seat)
  value += state.skillTest.pendingBonus || 0
  state.skillTest.pendingBonus = 0
  value += applyFreeTriggers(state, inv, skillContext, events)
  state.skillTest.stage = 'ST.2'

  const committed = []
  const committedCodes = new Set()
  const commitments = []
  // Phase 5（5a-5）：远程投入的判据是「控制着带 remoteCommit 标记的支援」
  // （原来是两张卡的卡号组合判断）。卡面本来就是「缜密分析」授予、且只能出现在潘明的牌库里，
  // 因此行为等价；引擎不再认这两张卡的卡号（连注释里也不再写，便于 cards:workorder 收缩）。
  const grantsRemoteCommit = person => person.assets.some(asset => registeredEntry(asset.code)?.passive?.remoteCommit)
  const remoteMinhs = options.peril ? [] : aliveInvestigators(state).filter(other => other.seat !== seat
    && grantsRemoteCommit(other))
  const helpers = options.peril ? [] : aliveInvestigators(state).filter(other => other.seat !== seat
    && other.location === inv.location && !remoteMinhs.includes(other))
  // 2026-10-25：剧本级「跨地点投入」钩子（05062 女巫作祟之林：其他女巫作祟之林的调查员
  // 可以对本地点的技能检定各投入 1 张牌，反之亦然）。返回 true 的调查员加入投入方列表。
  const crossCommitOwners = options.peril ? [] : aliveInvestigators(state).filter(other => other.seat !== seat
    && !remoteMinhs.includes(other) && !helpers.includes(other)
    && scenarioBehavior(state).crossLocationCommit?.(state, other, inv, skillContext) === true)
  const testOwners = [inv, ...remoteMinhs, ...crossCommitOwners]
  // Phase 2（C1）：capability:commit —— 不能投入卡牌（队友投入不受影响）。
  const cannotCommit = capabilityBlocked(state, inv, 'commit')
  for (const owner of testOwners) {
    let count = 0
    while (true) {
      state.skillTest.value = value + skillTotal() - statReference
      // 2026-10-25 第四轮修复 commit-extra-cost-hook（05104 被困的灵魂）：
      // 「在闹鬼地点投入手牌」的额外费用由剧本钩子结算（内容自行保证每场/每次只结算一次）。
      scenarioBehavior(state).beforeCommitCard?.(state, owner, {
        skill: skillContext, difficulty, committed: state.skillTest.committed || [],
      }, scenarioRuntime(state, events))
      const candidates = owner.hand.map((code, index) => ({ code, index }))
        .filter(() => !(cannotCommit && owner === inv))
        // 第 2 步 P2.9：手牌里有「不能投入」的卡（高塔）时，本人不能投入任何卡牌。
        // 2026-10-25 本循环修复 05042：按「手牌所有者」判定，而不是只查检定发起者——
        // 卡面「你不能在技能检定投入卡牌」不区分是谁的检定（本人/协助/远程投入都受限）。
        .filter(() => !handCommitBlocker(owner, registeredEntry))
        .filter(item => {
          const rule = hiddenRule(state, item.code)
          if (hasHiddenCard(owner, item.code)) return rule?.allowCommit === true
          return runtimeCardAvailable(state, owner, item.code) && !isWeaknessCode(item.code)
            && (commitIcons(state, owner, item.code, skillList) > 0 || commitProfile(item.code)?.anySkill === true)
        })
        .filter(item => lolaCanUseCard(owner, item.code))
        .filter(item => !activeHiddenRules(state, owner).some(hidden =>
          hidden.rule.cannotCommitTypes?.includes(cardDef(item.code)?.type)))
        .filter(item => scenarioBehavior(state).canCommitCard?.(state, owner, item.code) !== false)
        .filter(item => owner === inv || !commitProfile(item.code)?.selfTestOnly)
        .filter(item => !commitProfile(item.code)?.requireClueAtLocation || (state.locations.find(loc => loc.id === owner.location)?.clues || 0) > 0)
        .filter(item => !commitProfile(item.code)?.requireDifficultyAboveBase
          || difficulty - skillTotal() >= commitProfile(item.code).requireDifficultyAboveBase)
        .filter(item => commitProfile(item.code)?.remainingSanityAtMost == null
          || getMaxSanity(owner) - owner.horror <= commitProfile(item.code).remainingSanityAtMost)
        .filter(item => !commitProfile(item.code)?.requireEngagedEnemy || enemiesEngagedWith(state, owner).length > 0)
        .filter(item => !commitProfile(item.code)?.maxPerTest
          || commitments.filter(committed => committed.code === item.code).length < commitProfile(item.code).maxPerTest)
        // 「重拾信念」等：可投入任意类型检定（不要求匹配图标）。
        .filter(item => hasHiddenCard(owner, item.code) || commitProfile(item.code)?.anySkill || commitIcons(state, owner, item.code, skillList) > 0 || committedCodes.has(item.code))
        // 「殊死一搏」：只能单独投入。
        .filter(item => hasHiddenCard(owner, item.code) || !commitProfile(item.code)?.noOtherCommits || commitments.length === 0)
        // 已投入「殊死一搏」时不能再投入其他牌。
        .filter(item => !commitments.some(committed => commitProfile(committed.code)?.noOtherCommits)
          || item.code === commitments[0]?.code)
        // 「参透真谛」：只能投入冒险卡印刷能力的检定。
        .filter(item => hasHiddenCard(owner, item.code) || !commitProfile(item.code)?.scenarioAbilityOnly
          || options.source?.scenarioAbility === true || options.source?.ability === true
          || options.ability === true || options.scenarioAbility === true)
        .filter(item => !committedCodes.has(item.code) || !String(cardDef(item.code)?.textZh || '').includes('最多投入1张'))
      // 2026-10-25 第七轮修复 05013：beneath 通道也能投入事件/技能（额外费用：横置通道支援）。
      {
        const beneathChannel = (owner.assets || []).find(asset =>
          registeredEntry(asset.code)?.beneathPlayAsIfInHand === true && !asset.exhausted)
        if (beneathChannel) {
          for (const code of (owner.beneath || [])) {
            const def = cardDef(code)
            if (!def || !['event', 'skill'].includes(def.type)) continue
            if (!runtimeCardAvailable(state, owner, code) || isWeaknessCode(code) || hasHiddenCard(owner, code)) continue
            if (!commitProfile(code)?.anySkill && commitIcons(state, owner, code, skillList) === 0) continue
            candidates.push({ code, index: null, beneath: true })
          }
        }
      }
      const kingInYellow = investigatorRule(owner.code)?.wildCommitCompanionBonus
        && owner.threat.some(card => registeredEntry(card.code)?.kingInYellowThreat)
      if (kingInYellow && count === 0 && candidates.length < 3) candidates.length = 0
      if (owner !== inv && (!candidates.length || (!kingInYellow && count >= 1))) break
      const canFinish = !kingInYellow || count === 0 || count >= 3
      const answer = requestChoice(state, { kind: 'commit', source: `test:${seat}:${skillList.join(',')}`, seat: owner.seat,
        prompt: owner === inv ? `${inv.name} 的${skillLabel}检定：投入手牌后，可直接检定或求助队友。`
          : `${inv.name} 请求协助${skillLabel}检定；你可以投入一张牌，或放弃协助。`, canSkip: true,
        options: [...(canFinish ? [{ id: 'done', label: owner === inv ? '开始检定' : '放弃协助' }] : []),
          ...(owner === inv && helpers.length ? [{ id: 'help', label: '求助' }] : []),
          // 2026-10-27 修复 05013：beneath 候选也带 cardCode，界面据此把选项画成卡面，
          // 并让牌桌「下方」的牌成为可点的投入入口（web/card-interactions.js 的 choicePresentation）。
          ...candidates.map(item => (item.beneath
            ? { id: `beneath:${item.code}`, cardCode: item.code, label: '投入（底下）：' + cardName(item.code) }
            : { id: String(item.index), label: '投入：' + cardName(item.code) }))] })
      if (answer === 'done') break
      if (answer === 'help') {
        state.skillTest.helpRequested = true
        testOwners.push(...helpers)
        info(state, null, `${inv.name} 请求同地点队友协助投入。`)
        break
      }
      const chosenCandidate = candidates.find(item => item.beneath ? `beneath:${item.code}` === answer : Number(item.index) === Number(answer))
      let code = null
      if (chosenCandidate?.beneath) {
        const at = (owner.beneath || []).indexOf(chosenCandidate.code)
        code = at >= 0 ? owner.beneath.splice(at, 1)[0] : null
        const channel = (owner.assets || []).find(asset =>
          registeredEntry(asset.code)?.beneathPlayAsIfInHand === true && !asset.exhausted)
        if (channel) channel.exhausted = true
      } else code = owner.hand.splice(Number(answer), 1)[0]
      if (!code) break
      if (hasHiddenCard(owner, code)) removeHiddenMarker(owner, code)
      let icons = commitIcons(state, owner, code, skillList)
      // 「殊死一搏」：手牌越多失去越多万能图标；「占据先机」：本阶段每个行动减少 1 个万能图标。
      const skillRules = commitProfile(code)
      if (skillRules?.wildLosesPerHandCard) icons = Math.max(0, icons - owner.hand.length)
      if (skillRules?.wildLosesPerActionsThisPhase) {
        const performed = state.phaseActionCount || 0
        icons = Math.max(0, icons - performed)
      }
      const skillEffect = commitProfile(code)
      if (skillEffect?.wagerResources) {
        const maximum = Math.min(skillEffect.wagerResources, owner.resources)
        const wager = maximum ? Number(requestChoice(state, { kind: 'resource', source: code, seat: owner.seat,
          prompt: '选择为本次检定押注的资源。', options: Array.from({ length: maximum + 1 }, (_, amount) => ({ id: String(amount), label: `${amount}资源` })) })) : 0
        owner.resources -= wager
        campaignState.addWager(owner, code, wager)
      }
      if (skillEffect?.spendChargesForIcons) {
        const chargeAssets = owner.assets.filter(asset => isChargeAsset(asset) && (asset.uses || 0) > 0)
        const maximum = Math.min(skillEffect.spendChargesForIcons, chargeAssets.reduce((sum, asset) => sum + asset.uses, 0))
        const spend = maximum ? Number(requestChoice(state, { kind: 'amount', source: code, seat: owner.seat,
          prompt: '选择为力量洪流花费的充能。', options: Array.from({ length: maximum + 1 }, (_, amount) => ({ id: String(amount), label: `${amount}充能` })) })) : 0
        let remaining = spend
        for (const charged of chargeAssets) {
          const used = Math.min(remaining, charged.uses); charged.uses -= used; remaining -= used
          if (!remaining) break
        }
        icons += spend * (skillList.includes('willpower') ? 2 : 1)
      }
      if (skillList.some(name => skillEffect?.iconsPerEngagedEnemy?.includes(name))) icons += enemiesEngagedWith(state, owner).length
      if (owner !== inv && commitProfile(code)?.leadership) icons += skillList.includes('willpower') ? 2 : 1
      icons += minhCommitWildBonus(state, owner, events)
      const commitLocation = state.locations.find(location => location.id === owner.location)
      const hookMultiplier = scenarioBehavior(state).commitIconMultiplier?.(state, owner, commitLocation)
        || commitLocation?.commitIconMultiplier
      let multiplier = hookMultiplier
      // 04244 伊斯人身体：翻倍是可选反应，由玩家决定是否对刚投入的这张牌生效。
      if (hookMultiplier && typeof hookMultiplier === 'object' && hookMultiplier.multiplier) {
        const answer = requestChoice(state, {
          kind: 'reaction', source: hookMultiplier.source || 'commitIconMultiplier', seat: owner.seat, canSkip: true,
          prompt: hookMultiplier.prompt || '是否翻倍刚投入卡牌的技能图标？',
          options: [{ id: 'use', label: '翻倍' }, { id: 'skip', label: '不翻倍' }],
        })
        multiplier = answer === 'use' ? hookMultiplier.multiplier : 1
        if (answer === 'use' && hookMultiplier.once) state.skillTest[hookMultiplier.once] = true
      }
      const investigateOnly = commitLocation?.commitIconMultiplierInvestigateOnly
      if (multiplier && multiplier !== 1 && (!investigateOnly || state.skillTest.source?.label === '调查')) icons *= multiplier
      value += icons
      state.skillTest.committed.push({ seat: owner.seat, code, icons })
      committed.push(code)
      committedCodes.add(code)
      commitments.push({ seat: owner.seat, code, icons })
      count++
      // 2026-10-25 第六轮修复 05119：卡牌进入投入区后的窗口（可追加本次检定图标）。
      {
        const commitContext = { when: 'committedCard', seat: owner.seat, location: owner.location, cardCode: code, card: code, icons }
        triggerReaction(state, owner.seat, 'committedCard', events, commitContext)
        reactionWindow(state, 'committedCard', { ...commitContext, prompt: `${owner.name} 投入「${cardName(code)}」后` }, events)
      }
      info(state, null, `${owner.name} 投入「${cardName(code)}」。`, null, { public: true })
    }
    const analyticalMind = owner.assets.find(asset => !asset.exhausted
      && registeredEntry(asset.code)?.passive?.analyticalMind)
    if (count === 1 && analyticalMind) {
      const answer = requestChoice(state, { kind: 'reaction', source: analyticalMind.code, seat: owner.seat, canSkip: true,
        prompt: '是否横置「分析性思维」并抽1张牌？',
        options: [{ id: 'skip', label: '不触发' }, { id: 'trigger', label: '横置并抽1张牌' }] })
      if (answer === 'trigger') {
        analyticalMind.exhausted = true
        for (const line of drawCards(state, owner, 1, events)) info(state, events, line)
      }
    }
  }

  state.skillTest.value = value + skillTotal() - statReference + (state.skillTest.extraCommittedIcons || 0)
  const doubleOrNothing = commitments.some(item => commitProfile(item.code)?.doubleDifficultyAndRewards)
  if (doubleOrNothing) {
    difficulty *= 2
    state.skillTest.difficulty = difficulty
    info(state, events, `「孤注一掷」使本次检定难度翻倍至 ${difficulty}；成功效果将结算两次。`)
  }
  let defiedToken = null
  const defied = commitments.find(item => commitProfile(item.code)?.defiance)
  if (defied) {
    defiedToken = requestChoice(state, { kind: 'token', source: defied.code, seat, prompt: '蔑视：选择本次检定要忽略的混乱符号。',
      options: ['skull', 'cultist', 'tablet', 'elderthing'].map(id => ({ id, label: tokenLabel(id) })) })
  }
  playerWindow(state, 'test.afterCommit', events, options.peril || !state.skillTest.helpRequested ? seat : null)
  value += state.skillTest.pendingBonus || 0
  state.skillTest.pendingBonus = 0
  value += applyFreeTriggers(state, inv, skillContext, events)
  value += skillTotal() - statReference
  state.skillTest.stage = 'ST.3'
  const sealElderSign = commitments.some(item => commitProfile(item.code)?.elderSignInsteadOfChaos)
  const closeTest = resolved => {
    state.skillTest.stage = 'ST.8'
    for (const item of state.skillTest.committed) {
      if (commitProfile(item.code)?.exileAfterTest) {
        state.removedFromGame ||= []
        state.removedFromGame.push(item.code)
      } else if (hiddenDefinition(state, item.code)) {
        state.encounterDiscard.push(item.code)
      } else state.investigators[item.seat].discard.push(item.code)
    }
    if (strokeOfLuckExiled && exilableCode) {
      const owner = state.investigators[seat]
      const index = owner.discard.lastIndexOf(exilableCode)
      if (index >= 0) owner.discard.splice(index, 1)
      exilePlayerCard(state, owner, exilableCode, events)
    }
    endChaosTest(state, resolved)
    state.skillTest = previousTest
  }

  let summary = null
  const resolveResult = result => {
    // 「第七印记的封印」（04311）：任何技能检定期间每揭示一个符号标记后移除 1 充能
    // （一次检定揭示多个符号时按符号个数各触发一次）；充能耗尽时移出游戏（离场时移出由 leaveAsset 处理）。
    const symbols = ['skull', 'cultist', 'tablet', 'elderthing']
    const symbolCount = (result.drawn || []).filter(token => symbols.includes(token)).length
    if (symbolCount > 0) {
      for (const owner of state.investigators) {
        for (const asset of owner.assets.slice()) {
          const amount = registeredEntry(asset.code)?.chargesOnSymbolReveal ?? 0
          if (!amount) continue
          const removed = amount * symbolCount
          asset.uses = Math.max(0, (asset.uses || 0) - removed)
          info(state, events, `🔮 「${cardName(asset.code)}」移除 ${removed} 点充能（剩余 ${asset.uses}）。`)
          const removeWhenEmpty = registeredEntry(asset.code)?.removeFromGameWhenEmpty
    if ((asset.uses || 0) === 0 && removeWhenEmpty) {
            leaveAsset(state, owner, asset, events)
            info(state, events, `「${cardName(asset.code)}」没有充能，被移出游戏。`)
          }
        }
      }
    }
    // Public, confirmed result for the UI. Transaction replay already deduplicates
    // emitted events across choice pauses; no random draw happens in the client.
    state._resolution?.events.push({ type: 'presentation', kind: 'test', seat, name: inv.name,
      skill: skillContext, value: result.value, difficulty: result.difficulty, success: result.success,
      autoFail: !!result.autoFail, drawn: [...result.drawn], source: state.skillTest.source })
    // Phase 2（B3）：标准化结果。三处共用一份：options.resolve 的入参、窗口的 ctx.result、
    // state.lastTestResult（结算后仍可读，随存档往返），以及 api.test() 的返回值。
    summary = summarizeTestResult(state.skillTest, { ...result, seat, skill: skillContext })
    state.lastTestResult = summary
    // 就地写入：调用方（performTest 的返回值、afterTest、窗口条件）拿到的是同一个对象。
    result.summary = summary
    try { options.resolve?.(result) }
    catch (error) {
      if (error instanceof ScenarioEnded) closeTest(result.drawn)
      throw error
    }
    closeTest(result.drawn)
    if (!result.success) for (const fx of pendingOnFail.filter(fx=>fx.type==='drawEnemyTrait')) applyTokenFx(state,seat,inv,fx,events)
  }

  const necronomiconInPlay = inv.threat.some((t) => {
    const th = getThreatEffect(t)
    return th && th.eldersignToAutofail
  })

  let delta = 0
  let lastTokenDelta = 0
  let autoFail = commitments.some(item => hiddenRule(state, item.code)?.autoFailOnCommit)
  let committedCancelled = false
  let elderSign = false
  let elderAutoSuccess = false
  let elderOnSuccess = null
  let elderOnSuccessAlways = false
  let elderReturnCommittedSkill = false
  let elderMayMoveAfterTest = false
  let elderMayMoveAfterTestAlways = false
  let elderClueOnSuccessBy = 0
  let elderChosenReward = false
  let elderOptionalDraw = 0
  const drawn = []
  const cancelledTokens = []
  const pendingOnFail = []
  let wendyRedrawUsed = false
  let strokeOfLuckExiled = false
  let exilableCode = null
  let extraChaosUsed = false
  const pendingTokens = []
  let guard = 0
  while (guard++ < 100) {
    if (inv.ignoreChaosThisTurn) { drawn.push('0'); break }
    // 「手稿」等：本次检定不揭示混乱标记。
    if (state.skillTest?.skipTokens && !state.skillTest.skipTokensUsed) {
      state.skillTest.skipTokensUsed = true
      info(state, events, `${inv.name} 本次检定不揭示混乱标记。`)
      drawn.push('0')
      break
    }
    let token = sealElderSign ? 'eldersign' : null
    if (token == null && pendingTokens.length) token = pendingTokens.shift()
    const extraChoices = Math.max(options.extraChaosChoices || 0, state.skillTest?.extraChaosChoices || 0)
    if (token == null && !extraChaosUsed && extraChoices > 0) {
      extraChaosUsed = true
      const pool = Array.from({ length: 1 + extraChoices }, () => drawChaosToken(state))
      const chosen = requestChoice(state, { kind: 'token', source: state.skillTest?.extraChaosSource || options.extraChaosSource || null, seat,
        prompt: `额外揭示了 ${pool.length} 个混乱标记，选择 1 个结算。`,
        options: pool.map((face, index) => ({ id: String(index), label: tokenLabel(face) })) })
      for (let index = 0; index < pool.length; index++) {
        if (index !== Number(chosen)) returnChaosToken(state, pool[index])
      }
      token = pool[Number(chosen)]
      info(state, events, `${inv.name} 结算额外混乱标记 ${tokenLabel(token)}，其余标记归还。`)
    }
    // Phase 5（5a-10）：「花 1 充能改揭示 2 枚标记」由条目级 chaosTokenExtraReveal 声明。
    const statue = token == null && inv.assets.find(asset => registeredEntry(asset.code)?.chaosTokenExtraReveal && (asset.uses || 0) > 0)
    if (statue) {
      const answer = requestChoice(state, { kind: 'reaction', source: statue.id, seat, canSkip: true, prompt: '是否花费 1 充能，改为揭示 2 个混乱标记并选择 1 个？', options: [{ id: 'skip', label: '不花费充能' }, { id: 'trigger', label: '花费 1 充能' }] })
      if (answer === 'trigger') {
        statue.uses -= 1
        const first = drawChaosToken(state)
        const second = state.chaosBag.length ? drawChaosToken(state) : null
        const chosen = requestChoice(state, { kind: 'token', source: statue.id, seat, prompt: '选择要结算的混乱标记。', options: [{ id: '0', label: tokenLabel(first) }, ...(second == null ? [] : [{ id: '1', label: tokenLabel(second) }])] })
        token = chosen === '0' ? first : second
        info(state, events, inv.name + ' 使用「诡秘石像」：揭示 ' + tokenLabel(first) + ' 与 ' + tokenLabel(second) + '，选择 ' + tokenLabel(token) + '。')
        if ((statue.uses || 0) <= 0) {
          leaveAsset(state, inv, statue)
          inv.discard.push(statue.code)
          info(state, events, '「诡秘石像」充能耗尽，弃掉。')
        }
      }
    }
    // 失落时代：揭示前的替代与额外揭示（危险预感 / 奥利芙 / 黑暗预言）。
    if (token == null) {
      const plan = campaignBeforeChaosReveal(state, seat, inv, events)
      if (plan?.token) token = plan.token
      else if (plan?.count > 1) {
        const pool = Array.from({ length: plan.count }, () => drawChaosToken(state))
        const keep = Math.max(1, Math.min(pool.length, plan.choose || 1))
        const options = plan.symbolOnly
          ? pool.map((face, index) => ({ face, index })).filter(item => ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(item.face))
          : pool.map((face, index) => ({ face, index }))
        const usable = options.length ? options : pool.map((face, index) => ({ face, index }))
        const picked = []
        const remaining = [...usable]
        for (let pick = 0; pick < keep && remaining.length; pick++) {
          const answer = remaining.length === 1 ? '0' : requestChoice(state, {
            kind: 'token', source: plan.source || 'campaignReveal', seat,
            prompt: `${usable.length === pool.length ? `揭示 ${pool.length} 个混乱标记` : `揭示 ${pool.length} 个混乱标记，其中只有 ${usable.length} 个带有符号`}，选择第 ${pick + 1} 个要结算的标记。`,
            options: remaining.map((item, index) => ({ id: String(index), label: tokenLabel(item.face) })),
          })
          const chosen = remaining.splice(Number(answer) || 0, 1)[0]
          picked.push(chosen.index)
        }
        for (let index = 0; index < pool.length; index++) {
          if (!picked.includes(index)) returnChaosToken(state, pool[index])
        }
        token = pool[picked[0]]
        for (const extra of picked.slice(1)) pendingTokens.push(pool[extra])
        info(state, events, `${inv.name} 揭示了 ${pool.length} 个混乱标记（${pool.map(face => tokenLabel(face)).join('、')}），结算 ${picked.map(index => tokenLabel(pool[index])).join('、')}。`)
      }
    }
    if (token == null) token = codexSealedElderSign(state, inv, seat, events)
    if (token == null) token = drawChaosToken(state)
    if (investigatorRule(inv.code)?.chaosTokenRedraw && !wendyRedrawUsed && !investigatorTextBlanked(state, inv)) {
      const candidates = inv.hand.map((code, index) => ({ code, index }))
        .filter(item => !isWeaknessCode(item.code) && canDiscardFromHand(inv, item.code))
      if (candidates.length) {
        const answer = requestChoice(state, { kind: 'reaction', source: 'wendyRedraw', seat,
          prompt: `已揭示混乱标记 ${tokenLabel(token)}，是否弃掉 1 张非弱点手牌取消并归还该标记，然后重抽？`, canSkip: true,
          options: [{ id: 'skip', label: '保留该标记' }, { id: 'trigger', label: '弃牌并重抽（每次检定限一次）' }] })
        if (answer === 'trigger') {
          const index = requestChoice(state, { kind: 'discard-hand', source: 'wendyRedraw', seat,
            prompt: '选择弃掉的非弱点手牌。',
            options: candidates.map(item => ({ id: String(item.index), label: cardName(item.code) })) })
          const code = inv.hand.splice(Number(index), 1)[0]
          inv.discard.push(code)
          wendyRedrawUsed = true
          cancelledTokens.push(token)
          info(state, events, `${inv.name} 弃掉「${cardName(code)}」，取消并归还混乱标记 ${tokenLabel(token)}，重新抽取。`)
          returnChaosToken(state, token)
          token = drawChaosToken(state)
        }
      }
    }
    // Phase 5（5a-21）：幸运骰由条目级 rerollTokenCost 声明（花 N 资源重抽）。
    let luckyDice = inv.assets.find(asset => registeredEntry(asset.code)?.rerollTokenCost)
    let luckyGuard = 0
    // 卡面：只能对「非 auto_fail」的标记使用。
    while (luckyDice && token !== 'autofail' && inv.resources >= 2 && luckyGuard++ < 20) {
      const answer = requestChoice(state, { kind: 'reaction', source: luckyDice.id, seat, canSkip: true,
        prompt: `幸运骰：是否支付 2 资源，取消并归还 ${tokenLabel(token)}，然后重新揭示？`,
        options: [{ id: 'skip', label: '保留该标记' }, { id: 'trigger', label: '支付 2 资源并重抽' }] })
      if (answer !== 'trigger') break
      inv.resources -= 2
      cancelledTokens.push(token)
      returnChaosToken(state, token)
      token = drawChaosToken(state)
      info(state, events, `${inv.name} 使用「幸运骰」归还混乱标记并重新揭示 ${tokenLabel(token)}。`)
      if (token === 'autofail') {
        // 新标记为 auto_fail：把幸运骰子移出游戏（不是弃置）。
        luckyDice.removedFromGame = true
        state.removedFromGame ||= []
        if (!state.removedFromGame.includes(luckyDice.code)) state.removedFromGame.push(luckyDice.code)
        leaveAsset(state, inv, luckyDice, events)
        info(state, events, `「幸运骰」重新揭示自动失败，从游戏中移除。`)
        luckyDice = null
      }
    }
    state.skillTest.stage = 'ST.4'
    // 「逆反」：忽略本次检定所有符号标记的效果（含修正值）。
    const ignoreSymbolEffects = commitments.some(item => commitProfile(item.code)?.ignoreSymbolEffects)
    token = ignoreSymbolEffects ? token
      : scenarioBehavior(state).chaosTokenRevealed?.(state, inv, token, scenarioRuntime(state, events)) || token
    // 马泰奥神父：任何调查员揭示 autofail 时，改为 elder_sign（每局一次）。
    if (token === 'autofail') {
      const mateo = aliveInvestigators(state).find(owner =>
        investigatorRule(owner.code)?.autofailToElderSign && !owner.mateoSignUsed
        && !investigatorTextBlanked(state, owner))
      if (mateo) {
        const answer = requestChoice(state, { kind: 'reaction', source: mateo.code, seat: mateo.seat, canSkip: true,
          prompt: `揭示了 ${tokenLabel(token)}，是否取消它并改为 ${tokenLabel('eldersign')}（每局一次）？`,
          options: [{ id: 'skip', label: '保留自动失败' }, { id: 'trigger', label: '改为旧印' }] })
        if (answer === 'trigger') {
          mateo.mateoSignUsed = true
          returnChaosToken(state, token)
          token = 'eldersign'
          info(state, events, `✨ ${mateo.name} 取消了自动失败标记，改为结算 ${tokenLabel('eldersign')}（本局一次已用）。`)
        }
      }
    }
    drawn.push(token)
    state.skillTest.currentToken = token
    state.skillTest.cancelledSymbol = null
    // 「没有剩余神智值的调查员攻击或躲避哈斯塔时，把 +1/0/-1/旧印视为自动失败」（03334）。
    const sourceEnemy = options.source?.enemyId != null
      ? state.enemies.find(enemy => enemy.id === options.source.enemyId) : null
    if (sourceEnemy && !enemyTextBlanked(state, sourceEnemy)
      && enemyRuleFlags(sourceEnemy.code).noSanityAutoFailTokens === true
      && ['攻击', '躲避'].includes(options.source?.label)
      && getMaxSanity(inv) - (inv.horror || 0) <= 0
      && ['eldersign', '+1', '0', '-1'].includes(token)) {
      info(state, events, `☠️ ${inv.name} 没有剩余神智：${tokenLabel(token)} 被视作${tokenLabel('autofail')}。`)
      autoFail = true
      break
    }
    // 「追忆未来」：揭示了指定的混乱标记时横置支援并 +2。
    const named = state.skillTest.namedToken
    if (named && named.token === token) {
      const recall = inv.assets.find(asset => asset.id === named.assetId)
      if (recall) {
        recall.exhausted = true
        value += 2
        info(state, events, `「${cardName(recall.code)}」命中了指定的 ${tokenLabel(token)}，本次检定 +2。`)
      }
      delete state.skillTest.namedToken
    }
    // 「反击法术」：在符号标记结算前取消它（不揭示替代标记）。
    if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token) && !ignoreSymbolEffects) {
      reactionWindow(state, 'symbolRevealed', { when: 'symbolRevealed', seat, location: inv.location, token,
        sourceCard: state.skillTest?.source?.code ?? null,
        prompt: `${inv.name} 的检定揭示了 ${tokenLabel(token)}` }, events)
      // 2026-10-25 第七轮修复 05158：符号窗口里重定向调查目标后，难度以 skillTest.difficulty 为准。
      if (Number.isFinite(state.skillTest.difficulty)) difficulty = state.skillTest.difficulty
    }
    if (state.skillTest.cancelledSymbol === token) {
      info(state, events, `「${cardName(state.skillTest.cancelledSymbolSource)}」取消了 ${tokenLabel(token)}。`)
      lastTokenDelta = 0
      break
    }
    if (['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(token) && !ignoreSymbolEffects) {
      const symbolContext = { seat, token, location: inv.location, testBonus: 0 }
      for (const owner of aliveInvestigators(state).filter(owner => owner.location === inv.location))
        triggerReaction(state, owner.seat, 'symbolRevealed', events, symbolContext)
      value += symbolContext.testBonus || 0
    }
    if (token === defiedToken) {
      info(state, events, `「蔑视」忽略了 ${tokenLabel(token)} 的修正值与效果。`)
      lastTokenDelta = 0
      break
    }
    if (token === 'skull') for (const owner of aliveInvestigators(state)) triggerReaction(state, owner.seat, 'skullRevealed', events, { seat, token })
    if (token === 'autofail') {
      autoFail = true
      const stone = inv.assets.find(asset => registeredEntry(asset.code)?.returnToHandOnAutoFail)
      if (stone) {
        leaveAsset(state, inv, stone, events)
        inv.hand.push(stone.code)
        info(state, events, `「${cardName(stone.code)}」在揭示自动失败后返回手牌。`)
      }
      break
    }
    if (token === 'bless' || token === 'curse') { delta += token === 'bless' ? 2 : -2; continue }
    if (token === 'frost') {
      delta -= 1
      if (drawn.filter(t => t === 'frost').length > 1) { autoFail = true; break }
      continue
    }
    if (token === 'eldersign') {
      elderSign = true
      if (necronomiconInPlay) { autoFail = true; info(state, null, `☠️ 死灵之书使 ${inv.name} 的 elder_sign 变为自动失败！`) }
      else {
        const es = elderSignEffect(state, inv, events)
        if (es.autoFail) autoFail = true
        if (es.draw) drawCards(state, inv, es.draw, events)
        if (es.asSkull) {
          const res = resolveSpecialToken(state, seat, inv, 'skull', events)
          for (const fx of res.onDraw) applyTokenFx(state, seat, inv, fx, events)
          pendingOnFail.push(...res.onFail)
          drawn[drawn.length - 1] = 'skull'
        }
        delta += es.delta
        lastTokenDelta = es.delta
        elderAutoSuccess = !!es.autoSuccess
        elderOnSuccess = es.onSuccess || null
        elderOnSuccessAlways = !!es.onSuccessAlways
        elderReturnCommittedSkill = !!es.returnCommittedSkill
        elderMayMoveAfterTest = !!es.mayMoveAfterTest
        elderMayMoveAfterTestAlways = !!es.mayMoveAfterTestAlways
        elderClueOnSuccessBy = es.clueOnSuccessBy || 0
        elderChosenReward = !!es.chosenReward
        // 黛西的「如果你检定成功」要等成败判定后结算，不能在这里提前抽牌。
        elderOptionalDraw = Number(es.optionalDraw) || 0
        if (elderAutoSuccess) info(state, null, `✨ ${inv.name} 的 elder_sign 效果触发自动成功！`)
      }
      break
    }
    if (/^[+-]?\d+$/.test(token)) {
      let numeric = Number(token)
      if (numeric < 0) {
        const context = { when: 'negativeTokenRevealed', seat, location: inv.location, token, testValue: value + numeric, prompt: '揭示了带有负值修正的混乱标记' }
        reactionWindow(state, 'negativeTokenRevealed', context, events)
        if (context.flipTokenSign) numeric = -numeric
      }
      if (options.doubleNegative && numeric < 0) numeric *= 2
      delta += numeric
      lastTokenDelta = numeric
      if (pendingTokens.length) continue
      break
    }
    const res = ignoreSymbolEffects && ['skull', 'cultist', 'tablet', 'elderthing'].includes(token)
      ? { delta: 0, onDraw: [], onFail: [] }
      : resolveSpecialToken(state, seat, inv, token, events)
    if (res.autoFail) autoFail = true
    if (res.cancelCommitted && !committedCancelled) {
      const cancelled = commitments.filter(item => cardDef(item.code)?.type === 'skill')
      value -= cancelled.reduce((sum, item) => sum + commitIcons(state, state.investigators[item.seat], item.code, skillList), 0)
      for (const item of cancelled) commitments.splice(commitments.indexOf(item), 1)
      state.skillTest.cancelledCommitments = cancelled.map(item => ({ ...item }))
      committedCancelled = true
    }
    let tokenDelta = !investigatorTextBlanked(state, inv) && investigatorRule(inv.code)?.tokenModifiers?.[token] != null
      ? investigatorRule(inv.code).tokenModifiers[token] : res.delta
    if (tokenDelta < 0) {
      const context = { when: 'negativeTokenRevealed', seat, location: inv.location, token, testValue: value + delta, prompt: '揭示了带有负值修正的混乱标记' }
      reactionWindow(state, 'negativeTokenRevealed', context, events)
      if (context.flipTokenSign) tokenDelta = -tokenDelta
    }
    lastTokenDelta = options.doubleNegative && tokenDelta < 0 ? tokenDelta * 2 : tokenDelta
    delta += lastTokenDelta
    for (const fx of res.onDraw) applyTokenFx(state, seat, inv, fx, events)
    for (const fx of res.onFail) pendingOnFail.push(fx)
    if (res.drawAnother) continue
    if (pendingTokens.length) continue
    break
  }

  state.skillTest.stage = 'ST.5'
  // 「本次攻击期间揭示了 X 则自动失败」（04273 陈旧猎枪的卡膛）：在成算之前把检定改为自动失败。
  // 与 autofail 标记同一条失败路径，因此不会产生伤害、不会被「成功」类反应误读。
  if (Array.isArray(options.autoFailOnTokens)
    && options.autoFailOnTokens.some(token => drawn.includes(token))) {
    autoFail = true
  }
  if (typeof options.skillBonus === 'function') value += options.skillBonus() - initialBonus
  const rexCurse = inv.threat.find(item => registeredEntry(item.code)?.rerollRevealedTokenOnSuccess)
  if (rexCurse && !autoFail && (elderAutoSuccess || value + delta >= difficulty) && drawn.length) {
    const oldToken = drawn.pop()
    returnChaosToken(state, state.chaos.revealed.includes(oldToken) ? oldToken : state.chaos.revealed.at(-1))
    delta -= lastTokenDelta
    elderAutoSuccess = false
    elderOnSuccess = null
    elderOnSuccessAlways = false
    elderSign = false
    const replacement = drawChaosToken(state)
    drawn.push(replacement)
    if (replacement === 'skull') for (const owner of aliveInvestigators(state)) triggerReaction(state, owner.seat, 'skullRevealed', events, { seat, token: replacement })
    if (replacement === 'autofail') autoFail = true
    else if (replacement === 'eldersign') {
      elderSign = true
      const es = elderSignEffect(state, inv, events)
      delta += es.delta
      elderAutoSuccess = !!es.autoSuccess
      elderReturnCommittedSkill = !!es.returnCommittedSkill
      elderMayMoveAfterTest = !!es.mayMoveAfterTest
      elderMayMoveAfterTestAlways = !!es.mayMoveAfterTestAlways
      elderClueOnSuccessBy = es.clueOnSuccessBy || 0
      elderOnSuccess = es.onSuccess || null
      elderOnSuccessAlways = !!es.onSuccessAlways
      elderChosenReward = !!es.chosenReward
      if (es.autoFail) autoFail = true
    } else if (/^[+-]?\d+$/.test(replacement)) delta += Number(replacement)
    else {
      const res = resolveSpecialToken(state, seat, inv, replacement, events)
      delta += investigatorRule(inv.code)?.tokenModifiers?.[replacement] ?? res.delta
      autoFail ||= !!res.autoFail
      for (const fx of res.onDraw) applyTokenFx(state, seat, inv, fx, events)
      pendingOnFail.push(...res.onFail)
    }
    if (autoFail || (!elderAutoSuccess && value + delta < difficulty)) {
      removeOne(inv.threat, rexCurse)
      // Phase 5（5a-9）：卡号来自正在结算的那张威胁卡本身。
      inv.deck = shuffle([...inv.deck, rexCurse.code], () => randomValue(state))
      info(state, events, `「雷克斯的诅咒」令检定失败，洗回 ${inv.name} 的牌库。`)
    } else info(state, events, `「雷克斯的诅咒」归还 ${tokenLabel(oldToken)} 并揭示 ${tokenLabel(replacement)}；检定仍然成功。`)
  }
  state.skillTest.value = autoFail ? 0 : Math.max(0, value + delta)
  if (autoFail) {
    state.skillTest.stage = 'ST.6'
    for (const fx of pendingOnFail.filter(fx=>fx.type!=='drawEnemyTrait')) applyTokenFx(state, seat, inv, fx, events)
    const failContext = { skill: skillContext, difficulty, failedBy: Math.max(0, difficulty),
      committed: commitments.map(item => ({ ...item })) }
    triggerReaction(state, seat, 'skillTestFail', events, failContext)
    // 04159 反复尝试等「投入了技能牌的其他调查员」也会获得自己的 skillTestFail 窗口。
    for (const otherSeat of [...new Set(commitments.map(item => item.seat))]) {
      if (otherSeat !== seat) triggerReaction(state, otherSeat, 'skillTestFail', events, failContext)
    }
    const result = { success: false, value: 0, difficulty, skill: skillContext, token: 'autofail', committed, autoFail: true, drawn, cancelledTokens, source: options.source || null, damageBonus: 0, clueBonus: 0 }
    state.skillTest.stage = 'ST.7'
    resolveResult(result)
    scenarioBehavior(state).afterTest?.(state, inv, result, scenarioRuntime(state, events))
    runLocationTestFail(state, inv, result, events)
    campaignFailedTestWindow(state, seat, { skill: skillContext, difficulty, baseValue: statReference, source: options.source,
      peril: options.peril, resolve: options.resolve, failedBy: difficulty }, events)
    return result
  }
  value += delta
  // Phase 5（5a-21）：「天赐良机」这类「投入后可以流放换自动成功」由条目级 exileForAutoSuccess 声明。
  const strokeOfLuck = commitments.find(item => item.seat === seat && registeredEntry(item.code)?.exileForAutoSuccess)
  if (!autoFail && strokeOfLuck) {
    const answer = requestChoice(state, { kind: 'reaction', source: strokeOfLuck.code, seat, canSkip: true,
      prompt: '是否流放「' + cardName(strokeOfLuck.code) + '」，使本次检定自动成功？',
      options: [{ id: 'skip', label: '保留卡牌，正常结算' }, { id: 'exile', label: '流放并自动成功' }] })
    if (answer === 'exile') { strokeOfLuckExiled = true; exilableCode = strokeOfLuck.code; elderAutoSuccess = true }
  }
  if (!elderAutoSuccess && value < difficulty) {
    // Phase 2（B3）：窗口上下文带上标准化的当前结果（ctx.result），
    // 内容层不需要再从 testValue/difficulty 自己算差额。
    const context = { when: 'testWouldFail', seat, location: inv.location, skill: skillContext, difficulty, testValue: value,
      testBonus: 0, prompt: '技能检定将要失败', result: pendingTestResult(state.skillTest) }
    reactionWindow(state, 'testWouldFail', context, events)
    if (context.testBonus) {
      value += context.testBonus
      info(state, events, `⚡ 检定值 +${context.testBonus}（当前 ${value} vs ${difficulty}）。`)
    }
  }
  value = Math.max(0, value)
  if (!elderAutoSuccess && value >= difficulty) {
    const context = { when: 'wouldSucceedTest', seat, location: inv.location, skill: skillContext, difficulty, testValue: value,
      testBonus: 0, prompt: '技能检定将要成功', result: pendingTestResult(state.skillTest) }
    reactionWindow(state, 'wouldSucceedTest', context, events)
    if (context.testBonus) {
      value += context.testBonus
      info(state, events, `⚡ 检定值 +${context.testBonus}（当前 ${value} vs ${difficulty}）。`)
    }
  }
  state.skillTest.value = value
  state.skillTest.stage = 'ST.6'
  // 第 5 步 P6：（故事）调查员可以在检定期内直接降低本次难度（`api.reduceTestDifficulty`）。
  // 与「技能 +N」分开记：判定用扣减后的难度，展示与结果摘要也读同一份。
  if (state.skillTest.difficultyReduction) {
    difficulty = Math.max(0, difficulty - state.skillTest.difficultyReduction)
    state.skillTest.difficulty = difficulty
  }
  // 2026-10-25 第六轮修复 05119：「投入卡后」窗口追加的图标进入最终检定值。
  if (state.skillTest.extraCommittedIcons) {
    value += state.skillTest.extraCommittedIcons
    state.skillTest.value = value
  }
  // 2026-10-25 第四轮修复 failTies（05041 第十三幻象）：检定值恰好等于难度时按失败结算。
  // 除本次检定的 options.failTies 外，同地点威胁区里声明 failTies 的光环条目也生效。
  const failTiesAura = state.investigators.some(owner => owner.location === inv.location
    && (owner.threat || []).some(card => registeredEntry(card.code)?.failTies === true))
  const failTies = (options.failTies === true || failTiesAura) && !elderAutoSuccess
  const success = elderAutoSuccess || (value > difficulty || (value === difficulty && !failTies))
  // 任意技能检定成功的统一反应窗口（04107 幸运烟盒等）。
  if (success) triggerReaction(state, seat, 'skillTestSuccess', events,
    { skill: skillContext, successBy: value - difficulty, difficulty, value })
  // 「埃兹特里之牙」：结算诡计卡上的能力时检定成功后可以横置抽牌。
  if (success && state._treacheryResolving) {
    triggerReaction(state, seat, 'treacheryTestSuccess', events, { location: inv.location, skill: skillContext, cardCode: state._treacheryResolving })
  }
  if (!success) {
    for (const fx of pendingOnFail.filter(fx=>fx.type!=='drawEnemyTrait')) applyTokenFx(state, seat, inv, fx, events)
  }

  const skillFx = { damageBonus: 0, clueBonus: 0, evadeDisengage: false, mayMoveAfterEvade: false, homeFrontDamage: 0 }
  for (let pass = 0; pass < (doubleOrNothing && success ? 2 : 1); pass++) {
    for (const commitment of commitments) {
      const result = applySkillOnSuccess(state, state.investigators[commitment.seat], [commitment.code], success, value - difficulty, events)
      // 04153 参透真谛：任意冒险能力检定成功后由投入者发现 1 个线索。
      if (success && result.discoverClue) {
        discoverClueAt(state, state.investigators[commitment.seat], result.discoverClue, events)
      }
      skillFx.damageBonus += result.damageBonus
      skillFx.clueBonus += result.clueBonus
      skillFx.evadeDisengage ||= result.evadeDisengage
      skillFx.mayMoveAfterEvade ||= result.mayMoveAfterEvade
      skillFx.homeFrontDamage += result.homeFrontDamage
    if (result.homeFrontCode) skillFx.homeFrontCode = result.homeFrontCode
    }
  }
  if (elderOnSuccess && (success || elderOnSuccessAlways)) {
    resolveEffect(state, seat, elderOnSuccess, makeRuntime(state, []))
  }
  // 黛西·沃克：旧印 +0，如果本次检定成功，每控制一个[[书籍]]抽取 1 张（可选）。
  if (success && elderOptionalDraw > 0) {
    const answer = requestChoice(state, { kind: 'reaction', source: 'daisyElderSign', seat, canSkip: true,
      prompt: `旧印：是否为控制的书籍抽取 ${elderOptionalDraw} 张牌？`,
      options: [{ id: 'skip', label: '不抽牌' }, { id: 'trigger', label: `抽取 ${elderOptionalDraw} 张牌` }] })
    if (answer === 'trigger') {
      for (const text of drawCards(state, inv, elderOptionalDraw, events)) info(state, events, text)
    }
  }
  // 「挥金如土」等：检定成功后的额外结算。
  if (success && state.skillTest?.extraOnSuccess?.length) {
    const extras = state.skillTest.extraOnSuccess
    state.skillTest.extraOnSuccess = []
    for (const fx of extras) resolveEffect(state, seat, fx, makeRuntime(state, events))
  }
  // 失落的时代旧印的后续结算（芬恩线索 / 厄休拉移动 / 马泰奥二选一）。
  if (success && elderClueOnSuccessBy && value - difficulty >= elderClueOnSuccessBy) {
    const answer = requestChoice(state, { kind: 'reaction', source: 'finnElderSign', seat, canSkip: true,
      prompt: '旧印：是否发现你所在地点的 1 个线索？',
      options: [{ id: 'skip', label: '不发现' }, { id: 'trigger', label: '发现 1 个线索' }] })
    if (answer === 'trigger') discoverClueAt(state, inv, 1, events)
  }
  if ((success || elderMayMoveAfterTestAlways) && elderMayMoveAfterTest) {
    const destinations = investigatorMoveDestinations(state, seat, {})
    if (destinations.length) {
      const answer = requestChoice(state, { kind: 'move', source: 'ursulaElderSign', seat, canSkip: true,
        prompt: '旧印：是否移动到连接地点？',
        options: [{ id: 'skip', label: '留在原地' },
          ...destinations.map(id => ({ id, label: locName(state, id) }))] })
      if (answer !== 'skip') relocateInvestigator(state, seat, answer, events)
    }
  }
  if (elderChosenReward && success) {
    const options = [{ id: 'draw', label: '抽取 1 张牌并获得 1 资源' }]
    // 04004 马泰奥神父：「如果此时是你的回合」——只有调查阶段且轮到自己且回合未结束时
    // 才提供「额外 1 次行动」；神话/遭遇阶段即使 currentSeat 仍指向该座位也不提供。
    if (state.phase === 'investigation' && state.currentSeat === seat && !inv.turnEnded) {
      options.push({ id: 'action', label: '本回合额外 1 次行动' })
    }
    const answer = requestChoice(state, { kind: 'effect', source: 'mateoElderSign', seat,
      prompt: '旧印：选择一项结算。', options })
    if (answer === 'action') { inv.actionsLeft += 1; info(state, events, `${inv.name} 获得 1 次额外行动。`) }
    else {
      for (const line of drawCards(state, inv, 1, events)) info(state, events, line)
      inv.resources += 1
      info(state, events, `${inv.name} 抽取 1 张牌并获得 1 资源。`)
    }
  }
  if (success && elderReturnCommittedSkill) {
    const candidates = state.skillTest.committed.filter(item => cardDef(item.code)?.type === 'skill')
    if (candidates.length) {
      const choice = requestChoice(state, { kind: 'reaction', source: 'minhElderSign', seat, canSkip: true,
        prompt: '旧印：可以将本次投入的一张技能牌返回其所有者手牌。',
        options: [{ id: 'skip', label: '不返回' },
          ...candidates.map((item, index) => ({ id: String(index), cardCode: item.code,
            label: `${cardName(item.code)}（${state.investigators[item.seat].name}）` }))] })
      if (choice !== 'skip') {
        const chosen = candidates[Number(choice)]
        removeOne(state.skillTest.committed, chosen)
        state.investigators[chosen.seat].hand.push(chosen.code)
      }
    }
  }
  if (success) for (const minh of state.investigators.filter(owner => investigatorRule(owner.code)?.wildCommitCompanionBonus)) {
    const king = minh.threat.find(card => registeredEntry(card.code)?.kingInYellowThreat)
    const matchingIcons = commitments.filter(item => item.seat === minh.seat).reduce((sum, item) => sum + item.icons, 0)
    if (king && matchingIcons >= 6) {
      removeOne(minh.threat, king)
      minh.discard.push(king.code)
      info(state, events, `${minh.name} 投入了至少6个匹配图标，弃置「${cardName(king.code)}」。`)
    }
  }
  if (!success) {
    const failContext = { skill: skillContext, difficulty, failedBy: Math.max(0, difficulty - value),
      committed: commitments.map(item => ({ ...item })) }
    triggerReaction(state, seat, 'skillTestFail', events, failContext)
    // 04159 反复尝试：投入技能牌的其他调查员也获得自己的 skillTestFail 窗口。
    for (const otherSeat of [...new Set(commitments.map(item => item.seat))]) {
      if (otherSeat !== seat) triggerReaction(state, otherSeat, 'skillTestFail', events, failContext)
    }
  }
  // 技能牌失败奖励（如「重拾信念」）：奖励给执行检定的调查员，而不是投入者。
  const failRewardSeat = state.skillTest?.seat ?? seat
  if (!success) {
    for (const item of commitments) {
      const fail = commitProfile(item.code)?.onFail
      if (!fail) continue
      const owner = state.investigators[failRewardSeat]
      if (fail.draw) for (const line of drawCards(state, owner, fail.draw, events)) info(state, events, line)
      if (fail.resources) owner.resources += fail.resources
      info(state, events, `${owner.name} 的「${cardName(item.code)}」检定失败奖励已结算。`)
    }
  }
  const result = { success, value, difficulty, skill: skillContext, token: drawn.at(-1), committed, autoFail, drawn, elderSign, cancelledTokens,
    rewardMultiplier: doubleOrNothing && success ? 2 : 1, source: options.source || null, ...skillFx }
  if (success && elderSign && !investigatorTextBlanked(state, inv)) result.damageBonus += investigatorRule(inv.code)?.elderSign?.attackDamageBonus || 0
  state.skillTest.stage = 'ST.7'
  resolveResult(result)
  scenarioBehavior(state).afterTest?.(state, inv, result, scenarioRuntime(state, events))
  runLocationTestFail(state, inv, result, events)
  if (success) {
    const successBy = value - difficulty
    for (const commitment of commitments) {
      const threshold = commitProfile(commitment.code)?.returnOnSuccessBy
      if (threshold != null && successBy >= threshold) {
        const owner = state.investigators[commitment.seat]
        const idx = owner.discard.lastIndexOf(commitment.code)
        if (idx >= 0) {
          owner.discard.splice(idx, 1)
          owner.hand.push(commitment.code)
          info(state, events, `${owner.name} 的「${cardName(commitment.code)}」因超过难度 ${threshold} 点返回手牌。`)
        }
      }
    }
  }
  // 「学无止境」：检定失败并结算完后重新尝试该检定。
  if (!success) {
    campaignFailedTestWindow(state, seat, { skill: skillContext, difficulty, baseValue: statReference, source: options.source,
      peril: options.peril, resolve: options.resolve, failedBy: Math.max(0, difficulty - value) }, events)
  }
  // 检定结束：本次检定内的效果到期（A1）。
  for (const effect of expireEffects(state, 'endOfTest')) {
    if (effect.label) info(state, events, `⌛ 「${effect.label}」到期（本次检定结束）。`)
  }
  return {
    success, value, difficulty,
    token: drawn[drawn.length - 1],
    committed, autoFail, drawn, elderSign, cancelledTokens,
    damageBonus: skillFx.damageBonus,
    clueBonus: skillFx.clueBonus,
    evadeDisengage: skillFx.evadeDisengage,
    mayMoveAfterEvade: skillFx.mayMoveAfterEvade,
    // 2026-10-25 本循环修复 attack-resolution-context：攻击/躲避等 resolve 回调可把结构化结果
    // （如 r.attackResult={defeated,...}）写在 result 上，供 api.fight 的返回值读取。
    ...(result.attackResult ? { attackResult: result.attackResult } : {}),
    // Phase 2（B3）：标准化结果（同步结算时直接可用；异步/多次选择的检定读 state.lastTestResult）。
    summary,
  }
}

  return performTest
}
