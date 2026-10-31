// 食梦者（第五循环）M2 玩家卡 · M2-2 分片逐卡验收 —— P7。
//
// 本文件覆盖 `artifacts/migration/tde/shards.json` 的 M2-2 分片（22 张，06111–06195）。
// 每张卡至少一条真实行为测试，测试名以 `TDE <code> <中文名>` 开头；纯数据通道的卡
// 也至少有一条可执行断言（见 P7-WORKER-BRIEF §3）。
//
// 约定：
//   · 每次 applyMove 后引擎替换调查员对象，断言前重新从 state 读取；
//   · 需要直接发起检定/伤害（不走 action 入口）时用 runTest 在规则事务里执行，
//     与 tests/card-lifecycle.test.mjs / tests/tcu-player-m2-1.test.mjs 的骨架一致。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, asset, enemy, settle, use, decisionSeat, legalMoves, validateMove } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry, descriptorsInEntry } from '../src/engine/ability.js'
import {
  commitIcons, getStat, performTest, drawCards, getHandSize, applyHarm, drawEncounter,
} from '../src/engine/engine.js'
import { capabilityBlocked } from '../src/engine/modifiers.js'
import { playConditionError } from '../src/engine/play-condition.js'
import { resolveTransaction } from '../src/engine/resolution.js'

const codes = [
  '06111', '06112', '06113', '06114', '06115', '06116', '06117', '06118', '06155', '06156', '06157',
  '06158', '06159', '06160', '06161', '06162', '06163', '06164', '06165', '06166', '06167', '06195',
]
assert.equal(codes.length, 22, 'M2-2 分片固定 22 张')

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

// 在规则事务里执行一段直接调用引擎的代码，并把待决选择走完。
function runTest(state, execute, choose = () => null) {
  resolveTransaction(state, decisionSeat(state) ?? 0, { action: 'lifecycleProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 150; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}

// 把待决选择逐个点掉（可自定义选择）。
function resolveChoices(state, choose = () => null, limit = 150) {
  for (let index = 0; state.pendingChoice && index < limit; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
}

// 投入第一张手牌，然后触发所有反应窗口里的第一项（测试用：不挑具体 option id）。
function commitFirstThenTrigger(pending) {
  if (pending.kind === 'commit') {
    const option = pending.options.find(item => String(item.label).startsWith('投入：'))
    return option ? option.id : (pending.options.find(item => item.id === 'done')?.id ?? null)
  }
  if (pending.kind === 'reaction' || pending.kind === 'effect' || pending.kind === 'target') {
    const trigger = pending.options.find(item => !['skip', 'done'].includes(String(item.id)))
    return trigger?.id ?? 'skip'
  }
  return null
}

// 用一张技能卡做一次真实投入，返回检定结果（用于 commit 档案类的卡）。
function commitCardOnce(code, skill, { difficulty = 0, hand = [], preState = null } = {}) {
  const state = fixture('01001')
  state.investigators[0].hand = [code, ...hand]
  state.chaosBag = ['0']
  let result = null
  runTest(state, draft => { result = performTest(draft, 0, skill, difficulty, {}) }, commitFirstThenTrigger)
  return { state, result }
}

// study（默认地点）+ 阁楼。
function twoLocations(state) {
  state.locations[0].connections = ['attic']
  state.locations.push({ id: 'attic', name: '阁楼', clues: 0, shroud: 1, connections: ['study'], revealed: true })
  return [state.locations[0], state.locations.find(location => location.id === 'attic')]
}

// ---------------------------------------------------------------------------
// 06111 浑身是胆
// ---------------------------------------------------------------------------

test('TDE 06111 浑身是胆 3 万能图标；与敌人交战时才能投入，投入后检定值 +3', () => {
  // 数据通道：3 个万能图标对任意技能都计 3。
  const probe = fixture('01001')
  const probeInv = probe.investigators[0]
  for (const skill of ['willpower', 'intellect', 'combat', 'agility']) {
    assert.equal(commitIcons(probe, probeInv, '06111', skill), 3, `${skill} 检定吃 3 个万能图标`)
  }
  const profile = registeredEntry('06111').abilities.find(item => item.kind === 'commit').skill
  assert.equal(profile.requireEngagedEnemy, true, '卡面「只能投入到攻击/躲避敌人期间」落到 requireEngagedEnemy')

  // 没有交战敌人时不能投入：投入窗口不提供这张卡。
  {
    const state = fixture('01001')
    state.investigators[0].hand = ['06111']
    enemy(state, { location: 'attic', engagedSeat: null })
    let offered = false
    runTest(state, draft => { performTest(draft, 0, 'combat', 1, {}) }, pending => {
      if (pending.kind === 'commit' && pending.options.some(item => String(item.label).includes('浑身是胆'))) offered = true
      return commitFirstThenTrigger(pending)
    })
    assert.equal(offered, false, '未与敌人交战时「浑身是胆」不能被投入')
  }

  // 与敌人交战时投入：检定值 = 战斗 4 + 3 个万能图标 = 7。
  {
    const state = fixture('01001')
    state.investigators[0].hand = ['06111']
    enemy(state, { engagedSeat: 0 })
    let result = null
    runTest(state, draft => { result = performTest(draft, 0, 'combat', 0, {}) }, pending => {
      if (pending.kind === 'commit') {
        const option = pending.options.find(item => String(item.label).includes('浑身是胆'))
        return option ? option.id : (pending.options.find(item => item.id === 'done')?.id ?? null)
      }
      return commitFirstThenTrigger(pending)
    })
    assert.equal(result?.value, 7, '战斗 4 + 3 万能图标')
    assert.equal(result?.success, true)
  }
})

// ---------------------------------------------------------------------------
// 06112 梦境日记
// ---------------------------------------------------------------------------

test('TDE 06112 梦境日记 [action]从绑定集合取回梦的本质；投入它的检定成功 3 点后记录梦境', () => {
  const state = fixture('01001')
  const diary = asset(state, '06112')
  assert.equal(diary.code, '06112')
  use(state, diary)
  const inv = state.investigators[0]
  assert.ok(inv.hand.includes('06113'), '[action]：把绑定副本「梦的本质」加入手牌')
  assert.equal(ALL_CARDS['06113'].bondedTo, 'Dream Diary', 'Bonded 关系来自卡面数据')

  // [reaction]：投入 06113 的检定成功且超过难度 ≥3 → 记录「你洞悉了梦境」。
  inv.hand = ['06113']
  state.chaosBag = ['+2']
  let result = null
  runTest(state, draft => { result = performTest(draft, 0, 'willpower', 2, {}) }, pending => {
    if (pending.kind === 'commit') {
      const option = pending.options.find(item => String(item.label).startsWith('投入：'))
      return option ? option.id : 'done'
    }
    if (pending.kind === 'reaction') {
      const trigger = pending.options.find(item => item.id === 'trigger')
      return trigger ? trigger.id : 'skip'
    }
    return null
  })
  assert.equal(result?.success, true, '意志 3 + 2 万能图标 ≥ 难度 2')
  assert.ok((result?.value ?? 0) - 2 >= 3, '成功且超过难度至少 3 点')
  assert.equal(state.campaign.records.youHaveInterpretedTheDreams, true, '剧本日志记录「你洞悉了梦境」')
})

// ---------------------------------------------------------------------------
// 06116 预言卷轴
// ---------------------------------------------------------------------------

test('TDE 06116 预言卷轴 使用(4秘密)；花 1 秘密让目标调查员抽 3 弃 1', () => {
  const state = fixture('01001')
  const scroll = asset(state, '06116')
  assert.equal(scroll.uses, 4, '使用(4秘密)')
  state.investigators[0].damage = 0
  move(state, { action: 'ability', assetId: scroll.id, abilityIndex: 0, targetId: '0' })
  resolveChoices(state, pending => (pending.kind === 'discard' ? pending.options[0]?.id : null))
  const inv = state.investigators[0]
  assert.equal(inv.hand.length, 2, '抽 3 张后弃 1 张，净 +2')
  assert.equal(inv.assets.find(item => item.code === '06116').uses, 3, '花费 1 秘密')
})

// ---------------------------------------------------------------------------
// 06163 治愈真言
// ---------------------------------------------------------------------------

test('TDE 06163 治愈真言 使用(3充能)；花 1 充能治愈同地点调查员 1 点伤害', () => {
  const state = fixture('01001')
  const words = asset(state, '06163')
  assert.equal(words.uses, 3, '使用(3充能)')
  state.investigators[0].damage = 2
  move(state, { action: 'ability', assetId: words.id, abilityIndex: 0, targetId: '0' })
  assert.equal(state.investigators[0].damage, 1, '治愈 1 点伤害')
  assert.equal(state.investigators[0].assets.find(item => item.code === '06163').uses, 2, '花费 1 充能')
  // 充能耗尽后弃置。
  state.investigators[0].assets.find(item => item.code === '06163').uses = 1
  state.investigators[0].damage = 1
  move(state, { action: 'ability', assetId: words.id, abilityIndex: 0, targetId: '0' })
  assert.equal(state.investigators[0].damage, 0)
  assert.equal(state.investigators[0].assets.some(item => item.code === '06163'), false, '充能耗尽后弃置')
  assert.ok(state.investigators[0].discard.includes('06163'))
})

// ---------------------------------------------------------------------------
// 06113 梦的本质
// ---------------------------------------------------------------------------

test('TDE 06113 梦的本质 2 个万能图标 + Bonded(梦境日记)；投入检定真实加 2 点', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  for (const skill of ['willpower', 'intellect', 'combat', 'agility']) {
    assert.equal(commitIcons(state, inv, '06113', skill), 2, `${skill} 检定吃 2 个万能图标`)
  }
  assert.equal(ALL_CARDS['06113'].bondedTo, 'Dream Diary', 'Bonded 关系来自卡面数据')
  const { result } = commitCardOnce('06113', 'willpower')
  assert.equal(result?.value, 5, '意志 3 + 2 万能图标')
  assert.equal(result?.success, true)
})

// ---------------------------------------------------------------------------
// 06114 跟踪
// ---------------------------------------------------------------------------

test('TDE 06114 跟踪 调查：所选敌人每 1 点伤害 +1 智识；成功额外发现 1 个线索', () => {
  const state = fixture('01001')
  const study = state.locations[0]
  study.clues = 3
  study.shroud = 3
  const foe = enemy(state, { engagedSeat: 0, damageTaken: 2, fight: 1, evade: 1, health: 30 })
  state.investigators[0].hand = ['06114']
  state.chaosBag = ['0']
  const playMoves = legalMoves(state).filter(item => item.action === 'play' && item.cardId === '06114')
  assert.equal(playMoves.length, 1, '有敌人时可打出「跟踪」')
  move(state, { action: 'play', cardId: '06114' })
  resolveChoices(state)
  const inv = state.investigators[0]
  assert.equal(state.lastTestResult?.difficulty, 3, '调查难度 = 地点帷幕')
  assert.equal(state.lastTestResult?.success, true, '智识 3 + 敌人 2 点伤害 = 5 ≥ 3')
  assert.equal(state.locations.find(location => location.id === 'study').clues, 1, '成功发现 1 + 额外 1 = 2 个线索')
  assert.equal(inv.clues, 2)
  // 没有同地点敌人时不能打出。
  const bare = fixture('01001')
  bare.investigators[0].hand = ['06114']
  assert.match(String(playConditionError(bare, bare.investigators[0], '06114')), /没有敌人/,
    '同地点没有敌人时打出被拒绝')
})

// ---------------------------------------------------------------------------
// 06115 势不可挡
// ---------------------------------------------------------------------------

test('TDE 06115 势不可挡 1 个万能图标；投入后检定值 +1（下一次检定降难为显式简化）', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  assert.equal(commitIcons(state, inv, '06115', 'agility'), 1)
  assert.equal(commitIcons(state, inv, '06115', 'combat'), 1)
  const entry = registeredEntry('06115')
  assert.equal(entry.simplified, true, '「下一次检定难度 -X」是显式简化')
  assert.match(entry.note, /下一次技能检定难度/)
  const { result } = commitCardOnce('06115', 'agility')
  assert.equal(result?.value, 3, '敏捷 2 + 1 万能图标')
})

// ---------------------------------------------------------------------------
// 06117 解读秘符
// ---------------------------------------------------------------------------

test('TDE 06117 解读秘符 调查：加入意志值，成功额外发现 1 个线索', () => {
  const state = fixture('01001')
  state.locations[0].clues = 3
  state.locations[0].shroud = 4
  state.investigators[0].hand = ['06117']
  state.chaosBag = ['0']
  assert.equal(legalMoves(state).some(item => item.action === 'play' && item.cardId === '06117'), true)
  move(state, { action: 'play', cardId: '06117' })
  resolveChoices(state)
  const inv = state.investigators[0]
  assert.equal(state.lastTestResult?.value, 6, '智识 3 + 意志 3')
  assert.equal(state.lastTestResult?.success, true, '6 ≥ 帷幕 4')
  assert.equal(inv.clues, 2, '成功发现 1 + 额外 1')
  assert.equal(registeredEntry('06117').simplified, true, '忽略地点效果是显式简化')
})

// ---------------------------------------------------------------------------
// 06118 洁西卡·海德
// ---------------------------------------------------------------------------

test('TDE 06118 洁西卡·海德 你得到 +1[combat]（入场伤害/回合结束自愈为显式简化）', () => {
  const state = fixture('01001')
  const before = getStat(state, state.investigators[0], 'combat')
  asset(state, '06118')
  assert.equal(getStat(state, state.investigators[0], 'combat'), before + 1, '卡面：你得到 +1[combat]')
  const entry = registeredEntry('06118')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /入场时其上带有 2 点伤害/)
  assert.match(entry.note, /回合结束后/)
})

// ---------------------------------------------------------------------------
// 06155 森哲夫
// ---------------------------------------------------------------------------

test('TDE 06155 森哲夫 被击败时：目标调查员从弃牌堆找一张[[道具]]支援加入手牌', () => {
  const state = fixture('01001')
  asset(state, '06155')
  const inv = state.investigators[0]
  inv.discard = ['01020'] // 砍刀 [[道具]]支援
  inv.deck = [...Array(20).fill('01088'), '01016'] // 牌库顶 .45 自动手枪 [[道具]]支援
  state.investigators[0].damage = 0
  const stateRef = state
  // 用 assetsFirst 分配 2 点伤害：森哲夫（生命 2）被击败，开 assetDefeated 窗口。
  runTest(stateRef, draft => applyHarm(draft, draft.investigators[0], 2, 0, [], false, null, true), pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => String(item.label).includes('森哲夫'))
      return option ? option.id : 'skip'
    }
    if (pending.kind === 'card') return pending.options[0]?.id ?? null
    return null
  })
  const after = stateRef.investigators[0]
  assert.ok(after.hand.includes('01020'), '从弃牌堆找出的[[道具]]支援加入手牌')
  assert.equal(after.discard.includes('01020'), false, '弃牌堆里的卡被取走')
  assert.ok(after.discard.includes('06155'), '森哲夫被击败后进弃牌堆')
  assert.equal(after.damage, 0, '伤害由森哲夫吸收，调查员本人不受伤害')
  const entry = registeredEntry('06155')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /其他调查员/)
})

test('TDE 06155 森哲夫 被击败时也能从牌库顶 9 张找[[道具]]支援并混洗牌库', () => {
  const state = fixture('01001')
  asset(state, '06155')
  state.investigators[0].discard = []
  state.investigators[0].deck = ['01020', ...Array(18).fill('01088'), '01016'] // .45 手枪在牌库顶 9 张内
  const beforeDeck = [...state.investigators[0].deck]
  runTest(state, draft => applyHarm(draft, draft.investigators[0], 2, 0, [], false, null, true), pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => String(item.label).includes('森哲夫'))
      return option ? option.id : 'skip'
    }
    if (pending.kind === 'card') {
      const option = pending.options.find(item => String(item.label).includes('01016') || String(item.label).includes('.45'))
      return option ? option.id : pending.options[0]?.id ?? null
    }
    return null
  })
  const inv = state.investigators[0]
  assert.ok(inv.hand.includes('01016'), '从牌库顶 9 张找出的[[道具]]支援加入手牌')
  assert.equal(inv.deck.length, beforeDeck.length - 1, '该卡离开牌库（其余混洗）')
  assert.equal(inv.deck.includes('01016'), false)
})

// ---------------------------------------------------------------------------
// 06157 自我牺牲
// ---------------------------------------------------------------------------

test('TDE 06157 自我牺牲 协助队友检定：检定失败时执行者抽 2 张（失败效果重定向为显式简化）', () => {
  const state = fixture('01001', 2)
  const performer = state.investigators[0]
  const helper = state.investigators[1]
  performer.hand = []
  helper.hand = ['06157']
  state.chaosBag = ['-5']
  let result = null
  runTest(state, draft => { result = performTest(draft, 0, 'willpower', 6, {}) }, pending => {
    if (pending.kind === 'commit') {
      if (pending.seat === 0) {
        const help = pending.options.find(item => item.id === 'help')
        return help ? help.id : 'done'
      }
      const option = pending.options.find(item => String(item.label).startsWith('投入：'))
      return option ? option.id : 'skip'
    }
    return null
  })
  assert.equal(result?.success, false, '必定失败')
  assert.equal(state.investigators[0].hand.length, 2, '执行检定的调查员抽 2 张')
  const entry = registeredEntry('06157')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /失败效果改由投入者结算/)
})

// ---------------------------------------------------------------------------
// 06158 异界手稿
// ---------------------------------------------------------------------------

test('TDE 06158 异界手稿 花 1 秘密横置：查找遭遇牌库顶 9 张，弃掉场上一张同名非[[精英]]卡并洗回', () => {
  const state = fixture('01001')
  const codex = asset(state, '06158')
  assert.equal(codex.uses, 3, '使用(3秘密)')
  const foe = enemy(state, { code: 'ghoulMinion', name: '食尸鬼爪牙', health: 2, fight: 2, evade: 2 })
  state.encounterDeck = ['01165', 'ghoulPriest', '01165', '01165', 'ghoulMinion', '01165', '01165', '01165', '01165', '01165']
  const deckBefore = state.encounterDeck.length
  move(state, { action: 'ability', assetId: codex.id, abilityIndex: 0 })
  resolveChoices(state, pending => {
    if (pending.kind === 'card') {
      const option = pending.options.find(item => String(item.label).includes('食尸鬼爪牙'))
      return option ? option.id : pending.options[0]?.id ?? null
    }
    return null
  })
  const inv = state.investigators[0]
  assert.equal(state.enemies.some(item => item.id === foe.id), false, '场上的同名非[[精英]]敌人被弃掉')
  assert.equal(inv.assets.find(item => item.code === '06158').uses, 2, '花费 1 秘密')
  assert.equal(inv.assets.find(item => item.code === '06158').exhausted, true, '横置异界手稿')
  assert.equal(state.encounterDeck.length, deckBefore, '查找的卡牌混洗回遭遇牌库（数量不变）')
})

// ---------------------------------------------------------------------------
// 06159 强梦血清
// ---------------------------------------------------------------------------

test('TDE 06159 强梦血清 抽到与手牌同名的牌后横置血清抽 1 张', () => {
  const state = fixture('01001')
  const serum = asset(state, '06159')
  state.investigators[0].hand = ['01088']
  state.investigators[0].deck = Array(20).fill('01088')
  runTest(state, draft => { drawCards(draft, draft.investigators[0], 1, []) }, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => String(item.label).includes('强梦血清'))
      if (option) return option.id
      const trigger = pending.options.find(item => !['skip', 'done'].includes(String(item.id)))
      return trigger?.id ?? 'skip'
    }
    if (pending.kind === 'card' || pending.kind === 'discard') return pending.options[0]?.id ?? 'skip'
    return null
  })
  const inv = state.investigators[0]
  assert.equal(inv.assets.find(item => item.code === '06159').exhausted, true, '横置强梦血清')
  assert.equal(inv.hand.length, 3, '手牌 1 + 抽到同名 1 + 血清额外抽 1')
  const entry = registeredEntry('06159')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /手牌上限/)
})

// ---------------------------------------------------------------------------
// 06160 “让上帝分辨去吧……”
// ---------------------------------------------------------------------------

test('TDE 06160 “让上帝分辨去吧……” 只能在你的回合打出；加入胜利区并立即结束回合', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['06160']
  state.investigators[0].resources = 0
  assert.equal(legalMoves(state).some(item => item.action === 'play' && item.cardId === '06160'), true,
    '自己回合可以打出')
  move(state, { action: 'play', cardId: '06160' })
  assert.ok(state.victoryDisplay?.some(item => item.code === '06160'), '加入胜利展示区')
  assert.equal(state.investigators[0].hand.includes('06160'), false, '离开手牌')
  const entry = registeredEntry('06160')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /总计生命值/)
  // 不是自己的回合（其它座位的回合）不能打出。
  const other = fixture('01001', 2)
  other.currentSeat = 1
  assert.match(String(playConditionError(other, other.investigators[0], '06160')), /打出条件/,
    '不是自己的回合时打出被拒绝')
})

// ---------------------------------------------------------------------------
// 06161 快速装填
// ---------------------------------------------------------------------------

test('TDE 06161 快速装填 快速：把[[枪械]]支援的子弹补到使用(X)值', () => {
  const state = fixture('01001')
  const gun = asset(state, '07025') // .25 自动手枪，使用(4子弹)
  state.investigators[0].assets.find(item => item.code === '07025').uses = 1
  state.investigators[0].hand = ['06161']
  state.investigators[0].resources = 10
  const playMoves = legalMoves(state).filter(item => item.action === 'play' && item.cardId === '06161')
  assert.equal(playMoves.length, 1, '有可装填的[[枪械]]时可打出')
  move(state, { action: 'play', cardId: '06161' })
  resolveChoices(state)
  const inv = state.investigators[0]
  assert.equal(inv.assets.find(item => item.code === '07025').uses, 4, '补到使用(X)=4 子弹')
  assert.equal(inv.resources, 7, '打出费用 3 资源')
  assert.equal(registeredEntry('06161').playCondition?.length, 1, '只能在你回合打出落到 playCondition')
  // 子弹已满的枪不是候选：仍可打出事件，但 resolve 会提示没有可装填的[[枪械]]。
  const full = fixture('01001')
  asset(full, '07025')
  full.investigators[0].hand = ['06161']
  move(full, { action: 'play', cardId: '06161' })
  resolveChoices(full)
  assert.ok(full.log.some(line => String(line).includes('没有可装填')), '子弹已满时没有可装填目标')
})

// ---------------------------------------------------------------------------
// 06162 格雷戈里·葛利
// ---------------------------------------------------------------------------

test('TDE 06162 格雷戈里·葛利 使用(9资源)；检定开始时押注，成功后返还等量资源', () => {
  const state = fixture('01001')
  const gry = asset(state, '06162')
  assert.equal(gry.uses, 9, '使用(9资源)')
  state.chaosBag = ['0']
  let result = null
  runTest(state, draft => { result = performTest(draft, 0, 'willpower', 0, {}) }, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => String(item.label).includes('格雷戈里'))
      return option ? option.id : 'skip'
    }
    if (pending.kind === 'amount' || pending.kind === 'effect') {
      return pending.options.find(item => item.id === '2')?.id ?? pending.options[0]?.id ?? 'skip'
    }
    return null
  })
  assert.equal(result?.success, true)
  const inv = state.investigators[0]
  assert.equal(inv.assets.find(item => item.code === '06162').uses, 7, '押注花费 2 资源')
  assert.equal(inv.resources, 32, '检定成功返还 2 资源（30 + 2）')
  assert.equal(registeredEntry('06162').simplified, true, '差额门槛是显式简化')
})

// ---------------------------------------------------------------------------
// 06164 飘渺灵体
// ---------------------------------------------------------------------------

test('TDE 06164 飘渺灵体 意志躲避：成功后解除所有交战，本轮不能攻击', () => {
  const state = fixture('01001')
  const foe1 = enemy(state, { engagedSeat: 0, evade: 1, fight: 1, health: 30 })
  const foe2 = enemy(state, { engagedSeat: 0, evade: 1, fight: 1, health: 30 })
  state.investigators[0].hand = ['06164']
  state.chaosBag = ['0']
  const playMoves = legalMoves(state).filter(item => item.action === 'play' && item.cardId === '06164')
  assert.ok(playMoves.length >= 1, '有交战敌人时可打出')
  move(state, { action: 'play', cardId: '06164' })
  resolveChoices(state)
  const inv = state.investigators[0]
  assert.equal(state.enemies.filter(item => item.engagedSeat === 0).length, 0, '成功躲避后与所有敌人解除交战')
  assert.ok((inv.engaged || []).length === 0, '调查员不再处于交战')
  assert.ok(state.effects.some(item => item.sourceCode === '06164'), '「无形」作为本轮持续效果记录')
  assert.equal(capabilityBlocked(state, inv, 'fight'), true, '无形：不能攻击敌人')
  assert.equal(registeredEntry('06164').simplified, true, '交战/伤害限制为显式简化')
})

// ---------------------------------------------------------------------------
// 06165 搜刮补给
// ---------------------------------------------------------------------------

test('TDE 06165 搜刮补给 从弃牌堆选择一张等级 0 卡牌加入手牌', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['06165']
  state.investigators[0].discard = ['01088'] // 应急物品（等级 0）
  assert.equal(legalMoves(state).some(item => item.action === 'play' && item.cardId === '06165'), true)
  move(state, { action: 'play', cardId: '06165' })
  resolveChoices(state, pending => (pending.kind === 'card' ? pending.options[0]?.id : null))
  const inv = state.investigators[0]
  assert.ok(inv.hand.includes('01088'), '取回等级 0 卡牌')
  assert.equal(inv.discard.includes('01088'), false, '弃牌堆里的卡被取走')
  assert.ok(inv.discard.includes('06165'), '事件打出后进入弃牌堆')
  // 弃牌堆里没有等级 0 卡牌时只提示，不报错。
  const bare = fixture('01001')
  bare.investigators[0].hand = ['06165']
  bare.investigators[0].discard = ['01001']
  move(bare, { action: 'play', cardId: '06165' })
})

// ---------------------------------------------------------------------------
// 06166 蛮力
// ---------------------------------------------------------------------------

test('TDE 06166 蛮力 每次检定最多投入 1 张；成功超出难度 ≥2 时本次攻击 +2 伤害', () => {
  const state = fixture('01001')
  const foe = enemy(state, { engagedSeat: 0, fight: 1, health: 30 })
  state.investigators[0].hand = ['06166']
  state.chaosBag = ['+2']
  let result = null
  runTest(state, draft => { result = performTest(draft, 0, 'combat', 1, { source: { label: '攻击', enemyId: foe.id } }) },
    commitFirstThenTrigger)
  assert.equal(result?.success, true)
  assert.ok((result?.value ?? 0) - 1 >= 2, '成功超出难度 ≥2')
  assert.equal(result?.damageBonus, 2, '本次攻击 +2 伤害（read 点 applySkillOnSuccess → doFight）')
  assert.equal(commitIcons(state, state.investigators[0], '06166', 'combat'), 1, '印刷 1 个[combat]图标')
  const profile = registeredEntry('06166').abilities.find(item => item.kind === 'commit').skill
  assert.equal(profile.maxPerTest, 1, '每次技能检定最多投入 1 张')
  assert.equal(profile.successBy?.threshold, 2)
  assert.equal(registeredEntry('06166').simplified, true)
})

// ---------------------------------------------------------------------------
// 06167 多才多艺
// ---------------------------------------------------------------------------

test('TDE 06167 多才多艺 永久卡：+5 牌库张数与构筑选项属构筑层（数据通道）', () => {
  const card = ALL_CARDS['06167']
  assert.equal(card.permanent, true, '永久')
  assert.equal(card.type, 'asset')
  assert.equal(card.cost ?? null, null, '永久卡无费用')
  assert.equal(card.klass, 'neutral')
  assert.equal(card.xp, 2)
  const entry = registeredEntry('06167')
  assert.ok(entry, '条目注册')
  assert.equal(entry.abilities.length, 0, '对局内无行为')
  assert.equal(entry.simplified, true)
  assert.match(entry.note, /构筑/)
})

// ---------------------------------------------------------------------------
// 06195 .35温彻斯特步枪
// ---------------------------------------------------------------------------

test('TDE 06195 .35温彻斯特步枪 使用(5子弹)；花 1 子弹攻击、本次攻击 +2[combat]', () => {
  const state = fixture('01001')
  const rifle = asset(state, '06195')
  assert.equal(rifle.uses, 5, '使用(5子弹)')
  const foe = enemy(state, { engagedSeat: 0, fight: 6, evade: 1, health: 60 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: rifle.id, abilityIndex: 0 })
  resolveChoices(state)
  const inv = state.investigators[0]
  assert.equal(state.lastTestResult?.value, 6, '战斗 4 + 卡面 +2 = 6')
  assert.equal(state.lastTestResult?.success, true, '6 ≥ 敌人攻击值 6')
  assert.equal(state.enemies.find(item => item.id === foe.id)?.damageTaken, 1, '命中造成 1 点伤害')
  assert.equal(inv.assets.find(item => item.code === '06195').uses, 4, '花费 1 子弹')
  assert.equal(registeredEntry('06195').simplified, true, '标记 +2 伤害为显式简化')
})

// ---------------------------------------------------------------------------
// 06156 “吃一堑……”（近似：在 encounterDrawn 窗口取消当前诡计的显现）
// ---------------------------------------------------------------------------

test('TDE 06156 “吃一堑……” 快速：在遭遇抽牌窗口打出，取消该诡计的显现效果（近似卡面）', () => {
  const state = fixture('01001')
  state.investigators[0].hand = ['06156']
  state.investigators[0].threat = []
  state.encounterDeck = ['dissonantVoices', 'dissonantVoices', 'dissonantVoices']
  state.encounterDiscard = []
  runTest(state, draft => { drawEncounter(draft, draft.investigators[0], []) }, pending => {
    if (pending.kind === 'reaction') {
      const option = pending.options.find(item => String(item.label).includes('吃一堑'))
      return option ? option.id : 'skip'
    }
    if (['target', 'effect', 'card'].includes(pending.kind)) return pending.options[0]?.id ?? 'skip'
    return null
  })
  const inv = state.investigators[0]
  assert.ok(state.encounterDiscard.includes('dissonantVoices'), '被取消的遭遇诡计进入遭遇弃牌堆')
  assert.equal(inv.threat.length, 0, '显现效果被取消：诡计没有进入威胁区')
  assert.equal(inv.hand.includes('06156'), false, '快速事件离手')
  assert.ok(inv.discard.includes('06156'), '结算后进入弃牌堆')
  assert.equal(inv.resources, 29, '打出费用 1 资源')
  const entry = registeredEntry('06156')
  assert.equal(entry.simplified, true, '「结算后弃置时点 + 同名副本」为显式简化')
  assert.match(entry.note, /同名副本/)
})
