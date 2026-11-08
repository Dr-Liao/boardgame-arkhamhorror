// P0-9 玩家卡真实路径修复探针（player-cards 任务）。
//
// 目标：每张卡的「修复前失败 / 修复后通过」都用**真实引擎入口**复现，而不是 fire() 直执行描述子：
//   · createGameState/legalMoves/applyMove（tests/core-fixture.mjs 的真实 fixture + move）
//   · 真实的 fight/play 动作、真实的 performTest/runMythos 阶段函数、真实的 reactionWindow/
//     assetLeavesPlay/tokenReveal/turnBegins 窗口、真实的 healDamageFrom 治疗入口、
//     真实的 campaign 升级计价函数（replacementAnalysis/purchaseCard）。
//
// 运行（在 games/arkhamhorror 下）：
//   node docs/edgeOfTheEarth/eote-scan/player-b/_fix-player-cards.mjs
//
// 输出：逐卡 PASS/FAIL 行 + 末尾统计；退出码 1 表示有 FAIL。
import { fixture, move, asset, enemy, legalMoves } from '../../../../tests/core-fixture.mjs'
import { registerCardAbilities, registeredEntry } from '../../../../src/engine/ability.js'
import { resolveTransaction } from '../../../../src/engine/resolution.js'
import {
  drawCards, healDamageFrom, leaveAsset, performTest, reactionWindow, runMythos,
} from '../../../../src/engine/engine.js'
import { replacementAnalysis, purchaseCard, refreshArcaneResearch } from '../../../../src/campaign/campaign.js'
import { buildDeck } from '../../../../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../../../../src/cards/cards-data.js'

const E = c => import(`../../../../src/cards/entries/${c}.js`).then(m => m.default)
const CODES = ['08105', '08107', '08102', '08130', '08131', '08091', '08083', '08028', '08074', '08059', '08053', '08058']
for (const entry of await Promise.all(CODES.map(E))) {
  if (!registeredEntry(entry.code)) registerCardAbilities([entry])
}

const out = []
const check = (id, ok, detail) => { out.push({ id, ok: Boolean(ok), detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`) }
const labels = pending => (pending?.options || []).map(option => String(option.label || option.id))
const labelId = (pending, pattern) => pending.options.find(option => pattern.test(String(option.label || '')))?.id
const DEFAULTS = ['done', 'skip', 'self']

// 在规则事务里执行引擎入口，并收敛全部待决选择（可自定义选择）。
function run(state, execute, choose = () => null) {
  resolveTransaction(state, 0, { action: 'fixPlayerCardsProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 200; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? DEFAULTS.find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}

// 用真实 applyMove 收敛一次动作（fight/play/ability）产生的全部待决选择。
function act(state, command, choose = () => null) {
  move(state, command)
  for (let index = 0; state.pendingChoice && index < 200; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? DEFAULTS.find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
}

// ---------------------------------------------------------------------------
// 08105 / 08107：真实 fight 检定的 test.beforeCommit 窗口
// ---------------------------------------------------------------------------
function icePickFight({ code, select }) {
  const state = fixture('01001')
  state.investigators[0].assets = []
  asset(state, code)
  const foe = enemy(state, { engagedSeat: 0, fight: 0, evade: 0, health: 30 })
  state.chaosBag = ['0']
  state.investigators[0].hand = []
  let window = null
  let picked = false
  move(state, { action: 'fight', enemyId: foe.id })
  for (let index = 0; state.pendingChoice && index < 120; index++) {
    const pending = state.pendingChoice
    if (pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit') {
      window = { options: labels(pending), actionKind: state.skillTest?.actionKind ?? null }
    }
    let chosen = null
    if (pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit' && select) {
      chosen = select(pending, state)
      if (chosen != null) picked = true
    }
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen ?? DEFAULTS.find(id => pending.options.some(option => option.id === id)) ?? pending.options[0].id })
  }
  return { state, window, picked, result: state.lastTestResult, inv: state.investigators[0] }
}
try {
  const ice105 = icePickFight({ code: '08105', select: pending => labelId(pending, /破冰锥/) })
  const offered105 = ice105.window?.options?.some(label => /破冰锥/.test(label)) ?? false
  check('08105 real-fight-window', offered105,
    `test.beforeCommit options=${JSON.stringify(ice105.window?.options || [])} actionKind=${ice105.window?.actionKind} offered=${offered105}`)
  const valueOk = ice105.result && ice105.picked
    && ice105.result.value === ice105.state.investigators[0].combat + 1
  check('08105 fight-value+1', valueOk,
    `result.value=${ice105.result?.value} expected=${ice105.state.investigators[0].combat + 1} exhausted=${ice105.state.investigators[0].assets.find(a => a.code === '08105')?.exhausted}`)

  // 3 级破冰锥：先横置拿 +1（第一子句），再在同一窗口选择成功后弃卡换 +1 伤害（第二子句，仅一次）。
  let usedExhaust = false
  let usedDiscard = false
  const ice107 = icePickFight({ code: '08107', select: pending => {
    if (!usedExhaust && labelId(pending, /横置/)) { usedExhaust = true; return labelId(pending, /横置/) }
    if (usedExhaust && !usedDiscard && labelId(pending, /弃掉破冰锥/)) { usedDiscard = true; return labelId(pending, /弃掉破冰锥/) }
    return null
  } })
  const offered107 = ice107.window?.options?.some(label => /破冰锥/.test(label)) ?? false
  check('08107 real-fight-window', offered107,
    `test.beforeCommit options=${JSON.stringify(ice107.window?.options || [])} actionKind=${ice107.window?.actionKind}`)
  check('08107 discard-for-damage', usedExhaust && usedDiscard && ice107.result?.success === true
    && ice107.state.enemies[0]?.damageTaken === 2
    && !ice107.state.investigators[0].assets.some(card => card.code === '08107')
    && ice107.result?.value === ice107.state.investigators[0].combat + 1,
  `damageTaken=${ice107.state.enemies[0]?.damageTaken} expected=2 value=${ice107.result?.value} exhaustedUsed=${usedExhaust} discardUsed=${usedDiscard} discarded=${!ice107.state.investigators[0].assets.some(card => card.code === '08107')}`)
} catch (error) { check('08105/08107', false, `ERROR ${error?.stack || error}`) }

// ---------------------------------------------------------------------------
// 08102：真实 assetLeavesPlay 窗口（引擎 leaveAsset 的 context 形状）
// ---------------------------------------------------------------------------
function playReactionOnLeave({ branch }) {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['08102']
  state.investigators[0].resources = 10
  state.investigators[0].discard = []
  const ally = asset(state, '01032') // Research Librarian [[Ally]] health1/sanity1
  let offered = null
  run(state, draft => {
    leaveAsset(draft, draft.investigators[0], draft.investigators[0].assets.find(card => card.code === '01032'), [], { reason: 'effect' })
  }, pending => {
    if (pending.kind === 'reaction' && labels(pending).some(label => /保护魂灵/.test(label))) {
      offered = labels(pending)
      return labelId(pending, /保护魂灵/)
    }
    if (pending.options.some(option => option.id === branch)) return branch
    return null
  })
  const inv = state.investigators[0]
  // 引擎各 leaveAsset 调用点会在窗口返回后把未返回手牌的卡放进弃牌堆（assets.js 的调用方职责）；
  // 探针直接调 leaveAsset，这里按调用方口径补一次去向，模拟真实弃牌结算。
  if (!inv.hand.includes('01032') && !inv.discard.includes('01032')) inv.discard.push('01032')
  return {
    state, inv, offered,
    returned: inv.hand.includes('01032'),
    allyInDiscard: inv.discard.includes('01032'),
    eventInDiscard: inv.discard.includes('08102'),
    handSize: inv.hand.length,
  }
}
try {
  const ret = playReactionOnLeave({ branch: 'return' })
  check('08102 real-window-offered', Boolean(ret.offered), `reaction options=${JSON.stringify(ret.offered || [])}`)
  check('08102 return-to-hand', ret.returned && !ret.allyInDiscard && ret.eventInDiscard,
    `hand=${JSON.stringify(ret.inv.hand)} discard=${JSON.stringify(ret.inv.discard)}`)
  const drew = playReactionOnLeave({ branch: 'draw' })
  // 手牌：打出 08102 花掉 1 张，抽 3 张 → 净 +2；盟友留在弃牌堆。
  check('08102 owner-draws-3', drew.offered != null && drew.inv.discard.includes('01032') && !drew.inv.hand.includes('01032')
    && drew.handSize >= 3,
  `handSize=${drew.handSize} discard=${JSON.stringify(drew.inv.discard)}`)
} catch (error) { check('08102', false, `ERROR ${error?.stack || error}`) }

// ---------------------------------------------------------------------------
// 08130 / 08131：威胁区卡上的 1 点伤害（threatDamageSink）真实治疗
// ---------------------------------------------------------------------------
function threatDamageHeal(code) {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].threat = []
  state.investigators[0].deck = [code]
  run(state, draft => { drawCards(draft, draft.investigators[0], 1, []) })
  const threat = state.investigators[0].threat.find(card => card.code === code)
  const invDamageBefore = state.investigators[0].damage
  let healed = 0
  run(state, draft => { healed = healDamageFrom(draft, draft.investigators[0], 1, [], { log: false }) })
  const inv = state.investigators[0]
  return {
    state, threat, healed,
    stillInThreat: inv.threat.some(card => card.code === code),
    discardHas: inv.discard.includes(code),
    invDamageBefore, invDamageAfter: inv.damage,
  }
}
try {
  for (const code of ['08130', '08131']) {
    const result = threatDamageHeal(code)
    check(`${code} threatDamageSink-heal`, result.threat && result.healed === 1 && !result.stillInThreat && result.discardHas
      && result.invDamageBefore === result.invDamageAfter,
    `flags=${JSON.stringify(registeredEntry(code).flags)} healed=${result.healed} stillInThreat=${result.stillInThreat} discardHas=${result.discardHas} invDamage=${result.invDamageBefore}->${result.invDamageAfter}`)
  }
} catch (error) { check('08130/08131', false, `ERROR ${error?.stack || error}`) }

// ---------------------------------------------------------------------------
// 08091：真实 performTest 的 tokenReveal 窗口（符号 → 咒印替换）
// ---------------------------------------------------------------------------
try {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['08091']
  state.investigators[0].resources = 10
  state.chaosBag = ['cultist', 'skull']
  let sigilChoice = null
  move(state, { action: 'play', cardId: '08091' })
  for (let index = 0; state.pendingChoice && index < 20; index++) {
    const pending = state.pendingChoice
    const option = pending.options.find(item => ['skull', 'cultist'].includes(String(item.id))) || pending.options[0]
    sigilChoice = sigilChoice ?? option?.id
    move(state, { action: 'choose', choiceId: pending.id, optionId: option.id })
  }
  const sorcerer = state.investigators[0].assets.find(card => card.code === '08091')
  check('08091 enters-play-sigil', sigilChoice != null && sorcerer?.sigilToken === sigilChoice,
    `sigilChoice=${sigilChoice} sigilToken=${sorcerer?.sigilToken}`)

  let replaced = null
  let reactionOffered = null
  for (let attempt = 0; attempt < 6 && !replaced; attempt++) {
    run(state, draft => { performTest(draft, 0, 'willpower', 0, { source: { label: '探针检定' } }) },
      pending => {
        if (pending.kind === 'reaction' && labels(pending).some(label => /恩科西/.test(label))) {
          reactionOffered = labels(pending)
          return labelId(pending, /恩科西/)
        }
        return null
      })
    const drawn = state.lastTestResult?.drawn || []
    if (reactionOffered && drawn.includes(sorcerer.sigilToken) && !drawn.includes('cultist') && !drawn.includes('tablet') && !drawn.includes('elderthing')) {
      replaced = { drawn, exhausted: state.investigators[0].assets.find(card => card.code === '08091')?.exhausted }
    }
  }
  check('08091 tokenReveal-replacement', Boolean(replaced),
    `reactionOffered=${Boolean(reactionOffered)} sigil=${sorcerer.sigilToken} replaced=${JSON.stringify(replaced)}`)
} catch (error) { check('08091', false, `ERROR ${error?.stack || error}`) }

// ---------------------------------------------------------------------------
// 08083：真实打出（2 人局）后治疗同地点另一调查员的 [[盟友]]
// ---------------------------------------------------------------------------
function medicalStudent({ allyDamage, allyHorror }) {
  const state = fixture('01001', 2)
  for (const inv of state.investigators) { inv.assets = []; inv.hand = []; inv.threat = []; inv.discard = [] }
  state.investigators[1].location = state.investigators[0].location
  const ally = asset(state, '01032', { damage: allyDamage, horror: allyHorror }, 1)
  state.investigators[0].hand = ['08083']
  state.investigators[0].resources = 10
  state.currentSeat = 0
  let chosen = null
  move(state, { action: 'play', cardId: '08083' })
  for (let index = 0; state.pendingChoice && index < 30; index++) {
    const pending = state.pendingChoice
    const option = pending.options.find(item => String(item.id) === `asset:${ally.id}`) || pending.options.find(item => item.id === 'skip') || pending.options[0]
    chosen = option?.id
    move(state, { action: 'choose', choiceId: pending.id, optionId: option.id })
  }
  const after = state.investigators[1].assets.find(card => card.id === ally.id)
  return { state, chosen, damage: after?.damage, horror: after?.horror }
}
try {
  const healed = medicalStudent({ allyDamage: 1, allyHorror: 1 })
  check('08083 heal-ally', healed.chosen?.startsWith('asset:') && healed.damage === 0 && healed.horror === 0,
    `chosen=${healed.chosen} damage=${healed.damage} horror=${healed.horror}`)
  const floored = medicalStudent({ allyDamage: 1, allyHorror: 0 })
  check('08083 heal-ally-floor', floored.chosen?.startsWith('asset:') && floored.damage === 0 && floored.horror === 0,
    `chosen=${floored.chosen} damage=${floored.damage} horror=${floored.horror}（不得治成负数）`)
} catch (error) { check('08083', false, `ERROR ${error?.stack || error}`) }

// ---------------------------------------------------------------------------
// 08028：真实 runMythos 神话阶段（mythosEncounterStep 窗口 skip 替代遭遇抽取）
// ---------------------------------------------------------------------------
try {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['08028']
  state.investigators[0].resources = 10
  state.encounterDeck = ['ghoulMinion', 'dissonantVoices']
  state.encounterDiscard = []
  state.campaign.leadSeat = state.campaign.leadSeat ?? 0
  let played = false
  run(state, draft => { runMythos(draft) }, pending => {
    if (pending.kind === 'reaction' && labels(pending).some(label => /追猎行动/.test(label))) {
      played = true
      return labelId(pending, /追猎行动/)
    }
    if (pending.options.some(option => option.cardCode === 'ghoulMinion')) {
      return pending.options.find(option => option.cardCode === 'ghoulMinion').id
    }
    return null
  })
  const spawned = state.enemies.find(card => card.code === 'ghoulMinion')
  check('08028 mythos-skip-encounter', played && state.encounterDeck.length === 1 && state.encounterDeck[0] === 'dissonantVoices',
    `played=${played} deck=${JSON.stringify(state.encounterDeck)}（修复前 deck 被抽空）`)
  check('08028 spawn-engaged', Boolean(spawned) && spawned.engagedSeat === 0 && state.effects.some(effect => effect.sourceCode === '08028'),
    `spawned=${spawned?.code} engagedSeat=${spawned?.engagedSeat} effects=${state.effects.filter(effect => effect.sourceCode === '08028').length}`)
} catch (error) { check('08028', false, `ERROR ${error?.stack || error}`) }

// ---------------------------------------------------------------------------
// 08074：真实 play 打出后的声明式附属 + 宿主检定期间的 free 能力
// ---------------------------------------------------------------------------
function juryRigProbe({ activateAbility }) {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.investigators[0].hand = ['08074']
  state.investigators[0].resources = 10
  const shotgun = asset(state, '01029', { uses: 2 }) // Shotgun [[Item]]，[action] 攻击检定
  state.chaosBag = ['0']
  state.currentSeat = 0
  move(state, { action: 'play', cardId: '08074' })
  const host = state.investigators[0].assets.find(card => card.id === shotgun.id)
  const attachment = (host.attachments || []).find(item => item.code === '08074')
  const enemyCard = enemy(state, { engagedSeat: 0, fight: 0, evade: 0, health: 30 })
  let abilityWindow = null
  let picked = false
  move(state, { action: 'ability', assetId: host.id, abilityIndex: 0 })
  for (let index = 0; state.pendingChoice && index < 120; index++) {
    const pending = state.pendingChoice
    if (pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit') {
      abilityWindow = labels(pending)
    }
    let chosen = null
    if (activateAbility && !picked && pending.kind === 'playerWindow' && pending.source === 'test.beforeCommit') {
      chosen = labelId(pending, /应急装备/)
      if (chosen != null) picked = true
    }
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen ?? DEFAULTS.find(id => pending.options.some(option => option.id === id)) ?? pending.options[0].id })
  }
  const afterAttachment = (state.investigators[0].assets.find(card => card.id === host.id)?.attachments || []).find(item => item.code === '08074')
  return {
    state, host, attachment, abilityWindow, picked,
    discardHas: state.investigators[0].discard.includes('08074'),
    usesBefore: attachment?.uses, usesAfter: afterAttachment?.uses,
    result: state.lastTestResult, enemyCard,
  }
}
try {
  const baseline = juryRigProbe({ activateAbility: false })
  check('08074 attach-on-real-play', Boolean(baseline.attachment) && baseline.attachment.uses === 3 && !baseline.discardHas,
    `attachment=${JSON.stringify(baseline.attachment || null)} discard=${JSON.stringify(baseline.state.investigators[0].discard)}`)
  const used = juryRigProbe({ activateAbility: true })
  const offered = used.abilityWindow?.some(label => /应急装备/.test(label)) ?? false
  check('08074 attached-test-window', offered,
    `test.beforeCommit options=${JSON.stringify(used.abilityWindow || [])}`)
  check('08074 spend-durability+2', used.picked && used.usesAfter === used.usesBefore - 1
    && used.result?.value === baseline.result?.value + 2,
  `picked=${used.picked} uses=${used.usesBefore}->${used.usesAfter} value=${baseline.result?.value}->${used.result?.value}`)
} catch (error) { check('08074', false, `ERROR ${error?.stack || error}`) }

// ---------------------------------------------------------------------------
// 08059：真实战役关间计价（replacementAnalysis / purchaseCard / refresh）
// ---------------------------------------------------------------------------
try {
  const built = buildDeck(INVESTIGATORS['01001'], { seed: 'eote-08004' })
  const deck = ['08059', ...built.playerCards]
  const makeRecord = () => ({ id: 'inv0', seat: 0, code: '01001', name: 'Roland', deck: [...deck],
    currentScenarioIndex: 0, xp: 20, earnedXp: 20, spentXp: 0, trauma: { physical: 0, mental: 0 },
    status: 'active', purchases: [], removedCards: [] })
  const record = makeRecord()
  const campaign = { phase: 'interlude', scenarioIndex: 1, investigators: { 0: record },
    records: {}, trauma: { 0: { physical: 0, mental: 0 } }, xp: 20 }
  const flags = registeredEntry('08059').flags || {}
  const upgrade1 = replacementAnalysis(record, '01028').removals.find(option => option.code)
  const p1 = purchaseCard(campaign, 0, '01028', upgrade1.code, null)
  const upgrade2 = replacementAnalysis(record, '01029').removals.find(option => option.code)
  const p2 = purchaseCard(campaign, 0, '01029', upgrade2.code, null)
  const upgrade3 = replacementAnalysis(record, '01027').removals.find(option => option.code)
  record.deck.splice(record.deck.findIndex(code => code !== '08059'), 1)
  const noRemoval = replacementAnalysis(record, '01027').removals.find(option => option.code === null)
  const usedAfterTwo = record.upgradeDiscountUsed
  refreshArcaneResearch(campaign)
  const usedAfterRefresh = record.upgradeDiscountUsed
  const upgrade4 = replacementAnalysis(record, '01027').removals.find(option => option.code)
  check('08059 declarative-flags', flags.upgradeDiscount?.first === 2 && flags.purchaseCostDelta === 1,
    `flags=${JSON.stringify(flags)}`)
  check('08059 first-two-upgrades-minus-1', p1.cost === 1 && p2.cost === 3 && upgrade1.upgradeDiscount === 1 && upgrade2.upgradeDiscount === 1,
    `p1=${p1.cost} p2=${p2.cost} used=${usedAfterTwo}（01028=2xp/01029=4xp）`)
  check('08059 third-upgrade-no-discount', upgrade3 && upgrade3.cost === 2 && !upgrade3.upgradeDiscount,
    `third upgrade cost=${upgrade3?.cost} discount=${upgrade3?.upgradeDiscount}`)
  check('08059 new-purchase-plus-1', noRemoval && noRemoval.cost === 3 && noRemoval.purchaseCostDelta === 1,
    `new purchase option=${JSON.stringify(noRemoval && { cost: noRemoval.cost, delta: noRemoval.purchaseCostDelta })}`)
  check('08059 reset-per-interlude', usedAfterRefresh === 0 && upgrade4?.cost === 1 && upgrade4?.upgradeDiscount === 1,
    `usedAfterRefresh=${usedAfterRefresh} next upgrade cost=${upgrade4?.cost}`)
} catch (error) { check('08059', false, `ERROR ${error?.stack || error}`) }

// ---------------------------------------------------------------------------
// 08053 / 08058：真实 turnBegins 窗口里的多次移动（每次按当前位置重算连接）
// ---------------------------------------------------------------------------
function redClockMoves({ code, moveCount, connections }) {
  const state = fixture('01001')
  state.investigators[0].assets = []
  state.locations = connections
  state.investigators[0].location = 'a'
  const clock = asset(state, code)
  clock.uses = 1
  const offered = []
  run(state, draft => { reactionWindow(draft, 'turnBegins', { when: 'turnBegins', seat: 0 }, []) },
    pending => {
      if (pending.options.some(option => option.id === 'place')) return 'place'
      if (pending.kind === 'move') {
        offered.push(labels(pending))
        const current = state.investigators[0].location
        const connected = connections.find(location => location.id === current)?.connections || []
        // 沿链向前走：取与当前位置相连、且出现在选项里的最后一个（A 的邻居 B → B 的邻居 C → C 的邻居 D）。
        const candidates = connected.filter(id => pending.options.some(option => option.id === id))
        const next = candidates[candidates.length - 1]
        return next ? pending.options.find(option => option.id === next).id : 'skip'
      }
      return null
    })
  return { state, offered, location: state.investigators[0].location, uses: state.investigators[0].assets.find(card => card.code === code)?.uses }
}
try {
  const chain4 = [
    { id: 'a', name: 'A', revealed: true, connections: ['b'] },
    { id: 'b', name: 'B', revealed: true, connections: ['a', 'c'] },
    { id: 'c', name: 'C', revealed: true, connections: ['b', 'd'] },
    { id: 'd', name: 'D', revealed: true, connections: ['c'] },
    { id: 'e', name: 'E', revealed: true, connections: ['a'] },
  ]
  const c53 = redClockMoves({ code: '08053', moveCount: 2, connections: chain4 })
  check('08053 legal-chain-moves', c53.offered.length === 2
    && c53.offered[1].includes('C') && !c53.offered[1].includes('E')
    && c53.location === 'c' && c53.uses === 2,
  `moveOptions=${JSON.stringify(c53.offered)} final=${c53.location}（修复前第二次仍列 A 的邻居 B、可非法移动）`)
  const c58 = redClockMoves({ code: '08058', moveCount: 3, connections: chain4 })
  check('08058 legal-chain-moves', c58.offered.length === 3
    && c58.offered[1].includes('C') && !c58.offered[1].includes('E')
    && c58.offered[2].includes('D')
    && c58.location === 'd',
  `moveOptions=${JSON.stringify(c58.offered)} final=${c58.location}（修复前每步都列 A 的邻居 B）`)
} catch (error) { check('08053/08058', false, `ERROR ${error?.stack || error}`) }

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
const failed = out.filter(item => !item.ok)
console.log(`\n=== P0-9 player cards probe: ${out.length - failed.length}/${out.length} PASS ===`)
if (failed.length) {
  console.log('FAILED:', failed.map(item => item.id).join(', '))
  process.exitCode = 1
}
