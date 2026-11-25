// 验收 05-a · 万象无终 · 分片 1（pack=tcu，卡号 ≤ 05055）的逐卡证据测试。
//
// 覆盖本分片「既有证据标题不含卡号 / 现有用例只是身份断言」的 7 张卡：
//   05005 丽塔·杨（反应 + 每轮一次 + 旧印解除限制，真实引擎）
//   05016 “我不会再逃了！”（真实引擎：重整并交战、躲避改为伤害）
//   05017 兜帽人（真实引擎：被躲避后强制攻击）
//   05044 审判·XX（真实引擎：放置毁灭后每位调查员伤害/恐惧；被击败推进议程但保留毁灭）
//   05045 失踪事件（真实引擎：调查员退场时线索放到幕上）
//   05051 节制·XIV（章节分派 + 条目 agendaRule.onReveal）
//   05055 通向曙光（条目 actRule.onReveal：放置并揭示女巫圆环）
//
// 说明：05051/05055 是「关卡专用非玩家卡」，规则入口由 `content/.../behavior.js` 的
// agendaReveal/actReveal 通用分派调用条目，因此这里用与 tests/tcu-witching-hour.test.mjs
// 相同的口径：真实条目 + 同语义 api 替身（不复制章节规则）。
//
// 本文件不修改既有 tests/、src/、content/；登记进 tests/suites.mjs 由主进程合并时完成。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, move, enemy } from './core-fixture.mjs'
import {
  createGameState, applyMove, legalMoves, placeDoomOnCard, eliminateInvestigator,
} from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registeredEntry } from '../src/engine/ability.js'
import { ignoreLimitForRound, limitIgnored } from '../src/engine/limits.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import agenda05051 from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05051.js'
import act05055 from '../src/cards/encounter-entries/theCircleUndone/theWitchingHour/05055.js'

const live = state => state.investigators[0]

function asInvestigator (state, code) {
  const inv = live(state)
  const card = ALL_CARDS[code]
  Object.assign(inv, {
    code,
    name: card.nameZh,
    nameEn: card.name,
    klass: card.klass,
    willpower: card.willpower,
    intellect: card.intellect,
    combat: card.combat,
    agility: card.agility,
    baseHealth: card.health,
    baseSanity: card.sanity,
    health: card.health,
    sanity: card.sanity,
    maxHealth: card.health,
    maxSanity: card.sanity,
    beneath: [],
    assets: [],
    threat: [],
    damage: 0,
    horror: 0,
  })
  return state
}

// 依次回答待决选择；每个选项由 pick 决定（返回 null 时取第一个可退出项）。
function settleChoose (state, pick, guardMax = 60) {
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < guardMax, `选择循环未收敛：${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const id = pick(pending, state)
      ?? ['done', 'skip', 'self', 'no'].map(candidate => pending.options.find(option => option.id === candidate)).find(Boolean)?.id
      ?? pending.options[0]?.id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: id })
  }
}

// ---------------------------------------------------------------------------
// 05005 丽塔·杨：躲避后反应「造成 1 伤害或移动」，每轮一次；旧印解除本轮限制。
// ---------------------------------------------------------------------------
test('05-a1 05005 丽塔：躲避后反应造成 1 点伤害（每轮一次），旧印解除本轮限制', () => {
  const state = asInvestigator(fixture('01001'), '05005')
  state.chaosBag = ['+2']
  const offers = () => {
    let count = 0
    settleChoose(state, pending => {
      const descriptor = pending.options.find(option => String(option.id).startsWith('desc:ritaEvadeReaction'))
      if (descriptor) { count += 1; return descriptor.id }
      const damage = pending.options.find(option => option.id === 'damage')
      if (damage) return damage.id
      return null
    })
    return count
  }
  const first = enemy(state, { fight: 1, evade: 1, health: 4, engagedSeat: 0 })
  move(state, { action: 'evade', enemyId: first.id })
  assert.equal(offers(), 1, '躲避成功后应提供一次丽塔反应')
  assert.equal(state.enemies[0].damageTaken, 1, '选择伤害后敌人受到 1 点伤害')
  assert.equal(state.enemies[0].exhausted, true, '选择伤害分支时敌人仍照常横置')
  assert.equal(state.enemies[0].engagedSeat, null, '选择伤害分支时敌人仍照常解除交战')

  const second = enemy(state, { fight: 1, evade: 1, health: 4, engagedSeat: 0 })
  move(state, { action: 'evade', enemyId: second.id })
  assert.equal(offers(), 0, '每轮仅限一次：同一轮第二次躲避不再提供反应')

  const sign = registeredEntry('05005').elderSign
  const result = sign.resolve({
    state,
    inv: live(state),
    api: { info () {}, ignoreLimitForRound: id => ignoreLimitForRound(state, id) },
  })
  assert.equal(result?.delta, 2, '旧印给 +2')
  assert.equal(limitIgnored(state, { id: 'ritaEvadeReaction' }), true, '旧印忽略本轮反应上限')
  const third = enemy(state, { fight: 1, evade: 1, health: 4, engagedSeat: 0 })
  move(state, { action: 'evade', enemyId: third.id })
  assert.equal(offers(), 1, '旧印后本轮可再次触发反应')
})

// ---------------------------------------------------------------------------
// 05016 “我不会再逃了！”：重整并交战所在地点所有敌人；本回合躲避可改为造成伤害。
// ---------------------------------------------------------------------------
test('05-a1 05016 “我不会再逃了！”：重整并交战所有敌人，躲避可改为造成 1 伤害', () => {
  const state = fixture('01001')
  state.chaosBag = ['+2']
  live(state).hand = ['05016']
  const distant = enemy(state, { fight: 1, evade: 1, health: 4, engagedSeat: null, exhausted: true })
  assert.equal(distant.exhausted, true, '前置：敌人已横置')
  assert.equal(distant.engagedSeat, null, '前置：敌人未交战')

  move(state, { action: 'play', cardId: '05016' })
  settleChoose(state, () => null)
  const readied = state.enemies.find(item => item.id === distant.id)
  assert.equal(readied.exhausted, false, '打出的第一段：所在地点敌人重整')
  assert.equal(readied.engagedSeat, 0, '打出的第一段：所在地点敌人与调查员交战')
  assert.equal(live(state).evadeDamageInsteadRound, state.round, '打出后本回合躲避可改为伤害')

  move(state, { action: 'evade', enemyId: readied.id })
  let offered = false
  settleChoose(state, pending => {
    const damage = pending.options.find(option => option.id === 'damage')
    if (damage) { offered = true; return damage.id }
    return null
  })
  assert.equal(offered, true, '引擎应询问是否改为造成伤害')
  assert.equal(state.enemies[0].damageTaken, 1, '改为对敌人造成 1 点伤害')
  assert.equal(state.enemies[0].exhausted, false, '改为伤害时不横置敌人')
  assert.equal(state.enemies[0].engagedSeat, 0, '改为伤害时不解除交战')
})

// ---------------------------------------------------------------------------
// 05017 兜帽人：警戒、猎手、仅对丽塔；强制——被你躲避后攻击你。
// ---------------------------------------------------------------------------
test('05-a1 05017 兜帽人：被躲避后强制攻击躲避它的调查员', () => {
  const state = fixture('01001', 1, {})
  state.chaosBag = ['+2']
  const hoods = enemy(state, {
    code: '05017', name: '兜帽人', fight: 2, evade: 2, health: 3, damage: 1, horror: 1, engagedSeat: 0,
  })
  const before = { damage: live(state).damage, horror: live(state).horror }
  move(state, { action: 'evade', enemyId: hoods.id })
  settleChoose(state, () => null)
  const after = live(state)
  assert.equal(after.damage, before.damage + 1, '强制攻击造成 1 点伤害')
  assert.equal(after.horror, before.horror + 1, '强制攻击造成 1 点恐惧')
})

// ---------------------------------------------------------------------------
// 真实引擎：大厅流程进入序章（05043）。05044/05045 是序章专属议程/幕。
// ---------------------------------------------------------------------------
const SAFE_CHOICES = ['done', 'skip', 'no', 'avoid', 'decline', 'cancel', 'none', 'leave', 'safe', 'continue']

function settle (state, guardMax = 800) {
  for (let guard = 0; state.pendingChoice && guard < guardMax; guard++) {
    const pending = state.pendingChoice
    const options = pending.options || []
    if (!options.length) break
    const optionId = SAFE_CHOICES.map(id => options.find(option => String(option.id).toLowerCase() === id)).find(Boolean)?.id
      ?? options[0].id
    try {
      applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
    } catch {
      try { resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, current => current) } catch { break }
    }
  }
}

function driveHub (state, guardMax = 200) {
  const lead = () => state.campaign?.leadSeat ?? 0
  const seatFor = action => ['hubBeginScenario', 'hubContinue', 'hubSetLeader', 'hubSelectScenario', 'hubSetDifficulty', 'hubGoSetup'].includes(action)
    ? lead() : (state.currentSeat ?? 0)
  for (let guard = 0; guard < guardMax; guard++) {
    if (state.uiState === 'inScenario' && state.scenario?.id) return true
    if (state.status !== 'playing') return false
    settle(state)
    const moves = legalMoves(state)
    if (!moves.length) return false
    const priority = ['hubBeginScenario', 'hubContinue', 'hubDoneSeat', 'hubConfirmDeck', 'hubAutoDeck', 'hubConfirmUpgrades',
      'hubAutoUpgrade', 'hubGoSetup', 'hubSelectInvestigator', 'hubSelectScenario', 'hubSetDifficulty', 'hubSetLeader']
    const candidates = priority.map(action => moves.find(item => item.action === action)).filter(Boolean)
    let applied = false
    for (const candidate of candidates) {
      for (const seat of [...new Set([seatFor(candidate.action), 0, state.currentSeat ?? 0])]) {
        try { applyMove(state, seat, candidate); applied = true; break } catch { /* 换下一个座位 */ }
      }
      if (applied) break
    }
    if (!applied) return false
  }
  return false
}

function startPrologue () {
  const state = createGameState(
    { campaignId: 'theCircleUndone', campaignHub: true, seed: '05a1-acceptance-prologue' },
    [{ seat: 0, role: 'human' }],
  )
  assert.equal(driveHub(state), true, '真实大厅流程应能进入序章')
  settle(state)
  assert.equal(state.scenario?.id, 'disappearanceAtTheTwilightEstate', '当前应为序章')
  return state
}

function runTransaction (state, execute, choose) {
  resolveTransaction(state, 0, { action: 'acceptance05a1' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 100, `事务选择循环未收敛：${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending) ?? pending.options[0]?.id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

// ---------------------------------------------------------------------------
// 05044 审判·XX：放毁灭→每位调查员伤害/恐惧；被击败→推进议程且不移除毁灭。
// ---------------------------------------------------------------------------
test('05-a1 05044 审判·XX：放置毁灭后每位调查员受伤/恐惧，被击败推进议程且保留毁灭', () => {
  const state = startPrologue()
  assert.equal(state.agendas[0]?.code, '05044', '序章议程应为 05044')
  const harmKinds = []
  runTransaction(state, current => placeDoomOnCard(current, current.agendas[0], 1, []), pending => {
    harmKinds.push(pending.kind)
    return pending.options.find(option => option.id === 'horror')?.id
  })
  assert.deepEqual(harmKinds, ['harm'], '放置毁灭后必须让每位调查员选择伤害或恐惧')
  assert.equal(state.investigators[0].horror, 1, '选择恐惧：受到 1 点恐惧')
  assert.equal(state.investigators[0].damage, 0, '选择恐惧：不受到伤害')
  assert.equal(state.agendas[0].doom, 1, '毁灭标记放在议程上')

  // 强制②：调查员被击败时推进此议程（原地翻到 1b 记录命运后翻回），不移除毁灭。
  eliminateInvestigator(state, state.investigators[0], [])
  settle(state)
  assert.equal(state.agendaIndex, 0, '「推进」为原地翻面，不推进议程编号')
  assert.equal(state.agendas[0].doom, 1, '推进时不移除议程上的毁灭标记')
  const records = state.campaign?.records || {}
  for (const key of ['wasTakenByTheWatcher', 'wasClaimedBySpecters', 'disappearedIntoTheMist', 'wasPulledIntoTheSpectralRealm']) {
    assert.ok(Array.isArray(records[key]), `1b 的命运记录「${key}」应被初始化`)
  }
})

// ---------------------------------------------------------------------------
// 05045 失踪事件：有调查员退场时，其线索放在幕上而不是所在地点。
// ---------------------------------------------------------------------------
test('05-a1 05045 失踪事件：调查员退场时其线索放到幕上', () => {
  const state = startPrologue()
  assert.equal(state.acts[0]?.code, '05045', '序章幕应为 05045')
  const inv = state.investigators[0]
  inv.clues = 2
  const actCluesBefore = Number(state.acts[0].clues || 0)
  eliminateInvestigator(state, inv, [])
  settle(state)
  assert.equal(Number(state.acts[0].clues || 0), actCluesBefore + 2, '退场调查员的 2 个线索放到幕上')
  assert.equal(state.investigators[0].clues, 0, '线索不再留在调查员身上')
})

// ---------------------------------------------------------------------------
// 05051 节制·XIV（议程背面）：遭遇牌库弃到剩 5；游戏区域卡牌最多的调查员
// 从遭遇弃牌堆顶抽取 1 张[[女巫]]敌人。
// ---------------------------------------------------------------------------
test('05-a1 05051 节制·XIV：弃遭遇牌库至 5 张，场上卡最多的调查员抽女巫敌人', () => {
  const deck = Array.from({ length: 12 }, (_, index) => `deck-${index}`)
  const discard = ['nonWitchTreachery', '05090', '05091'] // 最后一项 = 弃牌堆顶
  const spawned = []
  const state = {
    scenario: {},
    investigators: [
      { seat: 0, name: '甲', location: 'loc-a', assets: [], defeated: false, resigned: false },
      { seat: 1, name: '乙', location: 'loc-b', assets: [{ id: 'a1' }, { id: 'a2' }], defeated: false, resigned: false },
    ],
    encounterDeck: [...deck],
    encounterDiscard: [...discard],
    campaign: { leadSeat: 0 },
  }
  const api = {
    info () {},
    encounterDeckCards: () => state.encounterDeck,
    encounterDiscardCards: () => state.encounterDiscard,
    discardEncounterTop: amount => {
      for (let index = 0; index < amount; index++) {
        const top = state.encounterDeck.shift()
        if (top != null) state.encounterDiscard.push(top)
      }
    },
    drawEncounterDiscard: (seat, index) => {
      const [code] = state.encounterDiscard.splice(index, 1)
      spawned.push({ seat, code })
    },
    choose: () => null,
  }
  const handled = agenda05051.agendaRule.onReveal(state, { code: '05051' }, api)
  assert.equal(handled, true, '议程背面规则应声明已处理')
  assert.equal(state.encounterDeck.length, 5, '遭遇牌库弃到剩 5 张')
  assert.equal(spawned.length, 1, '应抽出 1 张女巫敌人')
  assert.equal(spawned[0].seat, 1, '由游戏区域卡牌最多的调查员（乙，2 张）抽取')
  assert.equal(ALL_CARDS[spawned[0].code]?.type, 'enemy', '抽到的应是一张敌人')
  assert.ok((ALL_CARDS[spawned[0].code]?.traits || []).some(trait => String(trait).toLowerCase() === 'witch'),
    '抽到的敌人必须带[[女巫]]特性（05091）')
  assert.ok(!state.encounterDiscard.includes(spawned[0].code), '抽出的敌人从遭遇弃牌堆取走')
})

// ---------------------------------------------------------------------------
// 05055 通向曙光（幕 3a）：背面把女巫圆环（05055b）放进游戏区域中央并结算显现。
// ---------------------------------------------------------------------------
test('05-a1 05055 通向曙光：揭示女巫圆环并放入游戏区域中央', () => {
  const calls = []
  const state = {
    scenario: {},
    investigators: [{ seat: 0, name: '甲', location: 'loc-a', assets: [], defeated: false, resigned: false }],
    locations: [],
    campaign: { leadSeat: 0 },
  }
  const api = {
    place: (id, seat) => { calls.push(['place', id, seat]); state.locations.push({ id, revealed: false }) },
    reveal: (id, seat) => { calls.push(['reveal', id, seat]); const location = state.locations.find(item => item.id === id); if (location) location.revealed = true },
    info () {},
  }
  assert.equal(act05055.code, '05055')
  const handled = act05055.actRule.onReveal(state, { code: '05055' }, api)
  assert.equal(handled, true, '幕背面规则应声明已处理')
  assert.deepEqual(calls.map(call => call.slice(0, 2)), [['place', 'witchesCircle'], ['reveal', 'witchesCircle']],
    '必须把女巫圆环放入游戏区域中央并结算其显现')
  assert.equal(state.locations.find(location => location.id === 'witchesCircle')?.revealed, true, '女巫圆环被揭示')
})
