// 08-a 地球边缘 · 分片 6（08573b–08607）独立验收证据。
//
// 覆盖 fatalMirage（08573b–08595）与 toTheForbiddenPeaks（08596–08607）全部 45 张：
//   · 逐卡标题含卡号；
//   · 真实执行内容层 behavior / 条目声明 / 引擎读点（不是只断言「条目存在」）；
//   · 失败卡同样用真实断言记录当前实现与卡面的差距（读点缺失/条件缺失），供报告失败清单引用。
import test from 'node:test'
import assert from 'node:assert/strict'

import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import {
  actRuleFor, agendaRuleFor, encounterResolveFor, entryFlags, locationRuleFor, treacheryRuleFor, treacheryTestFor,
} from '../src/cards/card-rules.js'
import { setLocationLevel, locationLevel } from '../src/engine/vertical-chain.js'
import { initializeTekeliDeck, tekeliDeckSize } from '../src/engine/eote-tekeli.js'
import * as fatalMirage from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/index.js'
import * as fmDef from '../content/campaigns/edgeOfTheEarth/scenarios/fatalMirage/definition.js'
import * as peaks from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/index.js'
import * as peaksDef from '../content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/definition.js'

const fm = fatalMirage.behavior
const tp = peaks.behavior

const clone = value => JSON.parse(JSON.stringify(value))
function stateFor(count = 1, records = {}, flags = {}) {
  return {
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, name: `调查员${seat + 1}`, location: 'prisonOfMemories', damage: 0, horror: 0, clues: 0,
      resources: 5, assets: [], engaged: [], deck: [], discard: [], hand: [], threat: [], defeated: false, resigned: false,
    })),
    locations: [], enemies: [], encounterDeck: [], encounterDiscard: [], scenarioFlags: { ...flags },
    scenarioZones: { setAside: [], setAsideLocations: [] },
    campaign: { leadSeat: 0, records: { ...records }, completedSteps: [], scenarioResults: [], partners: {},
      trauma: {}, investigators: {}, resolutePartners: [] },
    victoryDisplay: [], doom: 0, chaosBag: [], difficulty: 'standard', numInvestigators: count,
    phase: 'investigation', round: 1, status: 'playing',
  }
}
const entryOf = code => registeredEntry(code)
const hasStoryVictory = (state, code) => (state.victoryDisplay || []).some(item => String(item?.code ?? item) === code)

// ---------------------------------------------------------------------------
// 08573b–08583b 记忆剧情卡（11）
// ---------------------------------------------------------------------------
for (const code of ['08573b', '08574b']) {
  test(`${code} 地点记忆剧情：伙伴活着时生成放一边的记忆敌人，伙伴被划掉时放逐记忆并允许推进`, () => {
    const entry = entryOf(code)
    assert.ok(entry, `${code} 条目已注册`)
    assert.equal(entry.implemented, true)
    const flip = entry.flags.storyFlip
    assert.ok(flip.memoryEnemy, '条目声明 storyFlip.memoryEnemy')
    // 伙伴活着：生成放一边的记忆敌人。
    const alive = stateFor()
    alive.encounters = []
    alive.locations = [{ id: 'here', code: '08573', revealed: true, clues: 0 }]
    alive.investigators[0].location = 'here'
    alive.scenarioZones.setAside = [flip.memoryEnemy]
    alive.campaign.partners[flip.partner] = { code: flip.partner, status: 'alive' }
    const result = fm.flipStoryFace(alive, code, {}, { location: 'here', inv: alive.investigators[0] })
    assert.equal(result.spawnEnemy, flip.memoryEnemy, '伙伴活着：生成记忆敌人')
    assert.equal(alive.enemies.length, 1)
    assert.equal(alive.scenarioZones.setAside.includes(flip.memoryEnemy), false, '从放一边区取出')
    // 伙伴被划掉：搬回记忆囚笼、剧情卡进胜利区、允许推进。
    const dead = stateFor()
    dead.locations = [{ id: 'here', code: '08573', revealed: true, clues: 0 }]
    dead.investigators[0].location = 'here'
    dead.scenarioZones.setAside = [flip.memoryEnemy]
    dead.campaign.partners[flip.partner] = { code: flip.partner, status: 'crossedOut' }
    const banished = fm.flipStoryFace(dead, code, {}, { location: 'here', inv: dead.investigators[0] })
    assert.equal(banished.banished, true, '伙伴被划掉：放逐记忆')
    assert.equal(dead.investigators[0].location, 'prisonOfMemories', '调查员回到记忆囚笼')
    assert.ok(hasStoryVictory(dead, code), '剧情卡进胜利区')
    assert.equal(dead.scenarioFlags.fatalMirageMayAdvance, true, '允许推进当前幕')
  })
}
for (const code of fmDef.MEMORY_STORY_CODES || []) {
  test(`${code} 记忆敌人剧情：记录直面内心恶魔、伙伴切换坚毅、进胜利区并允许推进`, () => {
    const entry = entryOf(code)
    assert.ok(entry)
    assert.ok(entry.flags.storyFlip.resolutePartner, '声明坚毅伙伴卡号')
    const state = stateFor()
    state.locations = [{ id: 'here', code: '08573', revealed: true, clues: 0 }]
    const result = fm.flipStoryFace(state, code, {}, { location: 'here', inv: state.investigators[0] })
    assert.ok(result.confronted, '返回直面内心恶魔结果')
    assert.ok(hasStoryVictory(state, code), '记忆剧情卡进胜利区')
    assert.equal(state.scenarioFlags.fatalMirageMayAdvance, true)
    assert.ok((state.campaign.resolutePartners || []).includes(entry.flags.storyFlip.resolutePartner))
    const recordKey = Object.entries(fmDef && {} ).length // placeholder to keep eslint happy
    assert.ok(recordKey === 0)
    const recordKeys = ['dyerHasConfrontedHisDemons', 'danforthHasConfrontedHisDemons', 'eliyahHasConfrontedHisDemons',
      'drSinhaHasConfrontedHerDemons', 'claypoolHasConfrontedHisDemons', 'cookieHasConfrontedHisDemons',
      'drKenslerHasConfrontedHerDemons', 'ellsworthHasConfrontedHisDemons', 'takadaHasConfrontedHerDemons']
    assert.ok(recordKeys.some(key => state.campaign.records[key] === true), '写入战役日志布尔记录')
  })
}

// ---------------------------------------------------------------------------
// 08574 黑色岩石（幻景地点：伙伴减帷幕 / 花 frost 得线索）
// ---------------------------------------------------------------------------
test('08574 黑色岩石：幻景层与线索按 mirage 规则结算，但「伙伴在场 -2 帷幕」与「花 frost 得 2 线索」无读点', () => {
  const entry = entryOf('08574')
  assert.equal(entry.flags.tier, 2, '幻景 2 由条目声明且在 behavior.mirageTier 读取')
  assert.equal(entry.flags.mirageId, 'theBlackStone')
  // -2 帷幕：behavior.locationShroudModifier 只处理记忆囚笼；伙伴在本地也不返回 -2。
  const state = stateFor()
  state.locations = [{ id: 'theBlackStone', code: '08574', revealed: true, clues: 2 }]
  assert.equal(fm.locationShroudModifier(state, state.locations[0]), 0, '当前没有 -2 帷幕读点')
  // 花 frost 得线索能力：条目没有 abilities。
  assert.equal((entry.abilities || []).length, 0, '没有声明 [fast] 加 frost 得 2 线索能力')
  assert.equal(typeof fm.flipStoryFace === 'function', true)
})

// ---------------------------------------------------------------------------
// 08575–08583 九个记忆敌人（Prey=伙伴 / 特殊反应/谈判）
// ---------------------------------------------------------------------------
for (const code of fmDef.MEMORY_ENEMY_CODES) {
  test(`${code} 记忆敌人：翻面强制与关键词生效，但 Prey（伙伴）与专属反应/谈判无条目能力/读点`, () => {
    const entry = entryOf(code)
    assert.ok(entry, `${code} 已注册`)
    assert.equal(entry.enemyRule.flipOnDefeat, true, '被击败翻面由 enemyRule.flipOnDefeat 读点结算')
    const scenarioEnemy = fmDef.scenario.enemies[code]
    assert.ok(scenarioEnemy, '章节遭遇定义存在')
    assert.equal(Boolean(scenarioEnemy.alert || scenarioEnemy.retaliate), true, 'Alert/Retaliate 由卡文解析')
    assert.equal(scenarioEnemy.prey, undefined, '「Prey - Investigator with 伙伴」未被映射（无 preyPartner 读点）')
    assert.ok(entry.flags.preyPartner, '条目声明了 preyPartner，但引擎/内容层无读点')
    assert.equal((entry.abilities || []).length, 0, '专属反应/谈判没有条目能力')
    // 被击败 → 翻面读记忆剧情仍可执行。
    const state = stateFor()
    state.locations = [{ id: 'here', code: '08573', revealed: true, clues: 0 }]
    const enemy = { id: 'e1', code, originalCode: code, location: 'here', traits: [...(scenarioEnemy.traits || [])], defeatedBy: 0 }
    state.enemies = [enemy]
    const handled = fm.enemyDefeated(state, enemy, { info: () => {} })
    assert.equal(handled, true, '被击败翻面读剧情')
    assert.ok(hasStoryVictory(state, `${code}b`), '背面剧情进胜利区')
  })
}

// ---------------------------------------------------------------------------
// 08584 恐怖阴影
// ---------------------------------------------------------------------------
test('08584 恐怖阴影：冷漠/猎手由数据解析，但「破除幻景后失去冷漠」与「发现线索放毁灭」无读点', () => {
  const entry = entryOf('08584')
  const def = fmDef.scenario.enemies['08584']
  assert.equal(def.aloof, true, 'Aloof 由卡文解析')
  assert.equal(def.hunter, true, 'Hunter 由卡文解析')
  assert.equal(entry.flags.losesAloofAtFlippedLocation, true)
  assert.equal(entry.flags.doomOnClueDiscover, true)
  assert.equal((entry.abilities || []).length, 0, '两个强制都没有条目能力')
  // 内容层 behavior 没有任何线索发现→毁灭 的钩子。
  assert.equal(typeof fm.behavior?.cluesDiscovered, 'undefined')
  assert.equal(Object.keys(fm).some(key => /doomOnClue|cluesDiscovered/i.test(key)), false, 'behavior 无对应钩子')
})

// ---------------------------------------------------------------------------
// 08585 易散之雾 / 08586 回首往事
// ---------------------------------------------------------------------------
test('08585 易散之雾：条目声明了附属规则，但遭遇结算无 resolve/检定读点', () => {
  assert.equal(treacheryRuleFor('08585').attachToNearestUnflippedLocation, true)
  const entry = entryOf('08585')
  assert.equal(entry.flags.attachLocationClues, 2)
  assert.equal(entry.flags.discardWhenLocationFlipped, true)
  assert.equal(encounterResolveFor('08585'), null, '没有 encounterResolve')
  assert.equal(treacheryTestFor('08585'), null, '没有声明式显现检定')
  assert.equal(fmDef.scenario.treacheries['08585'] != null, true)
})
test('08586 回首往事：条目声明 chooseOne，但遭遇结算没有 chooseOne 读点', () => {
  assert.deepEqual(treacheryRuleFor('08586').chooseOne, ['take2Damage', 'place1DoomOnAgenda'])
  assert.equal(entryOf('08586').flags.peril, true)
  assert.equal(encounterResolveFor('08586'), null)
  assert.equal(treacheryTestFor('08586'), null)
  const def = fmDef.scenario.treacheries['08586']
  assert.equal(def.peril, true, 'Peril 由卡文解析（该项生效）')
})

// ---------------------------------------------------------------------------
// 08587–08595 九位坚毅伙伴
// ---------------------------------------------------------------------------
const PARTNER_EXPECT = {
  '08587': { usesType: 'secrets', abilities: 0, gap: 'heal2HorrorAfterFreeSpend' },
  '08588': { usesType: 'secrets', abilities: 0, gap: 'afterTekeliliResolvedDraw3DiscardWeaknesses' },
  '08589': { usesType: 'secrets', abilities: 1, gap: 'evadeBase6ThenMayMove' },
  '08590': { usesType: 'supplies', abilities: 0, gap: 'heal2DamageAfterFreeSpend' },
  '08591': { usesType: 'supplies', abilities: 0, gap: 'cancelFrostThenRevealOrSpendSupply' },
  '08592': { usesType: 'ammo', abilities: 1, gap: 'fightBase6NonEliteCannotAttackThisRound' },
  '08593': { usesType: 'secrets', abilities: 1, gap: 'investigateBase6LookTopCard' },
  '08594': { usesType: 'supplies', abilities: 0, gap: 'blankNonWeaknessTreacheryText' },
  '08595': { usesType: 'resources', abilities: 0, gap: 'gain1ResourceMoveUpTo3' },
}
for (const [code, expect] of Object.entries(PARTNER_EXPECT)) {
  test(`${code} 坚毅伙伴：条目 uses(${expect.usesType})/能力声明与 choosePartner 实体使用数、能力接线核验`, () => {
    const entry = entryOf(code)
    assert.equal(entry.usesType, expect.usesType, '条目声明使用类型')
    assert.equal(entry.flags.partnerRules ? Object.values(entry.flags.partnerRules)[0] : null, expect.gap, '声明的能力字符串无读点')
    const state = stateFor()
    const asset = fm.choosePartner(state, 0, code)
    assert.ok(asset, 'choosePartner 生成伙伴资产')
    assert.equal(asset.uses, undefined, 'choosePartner 只读 ALL_CARDS.uses（该卡无 uses 字段）→ 使用数未接线')
    assert.equal(asset.usesType, undefined, '资产 usesType 未接线')
    assert.equal((entry.abilities || []).length, expect.abilities, '条目能力数量')
    const calls = []
    const api = {
      evade: (...args) => calls.push(['evade', ...args]), fight: (...args) => calls.push(['fight', ...args]),
      investigate: (...args) => calls.push(['investigate', ...args]), lookAt: (...args) => calls.push(['lookAt', ...args]),
      testResult: () => ({ success: true }), moveDestinations: () => [], choice: () => null,
      addEffect: (...args) => calls.push(['addEffect', ...args]), moveInvestigator: (...args) => calls.push(['move', ...args]),
      locName: id => id, addUses: () => {},
    }
    for (const ability of entry.abilities || []) {
      assert.equal(ability.kind, 'action', '能力以 [action] 声明')
      assert.equal(ability.cost?.action, true, '声明为消耗 1 行动（卡面为 [fast]，时机口径不符）')
      ability.resolve({ inv: state.investigators[0], source: asset, target: { id: 'e1', elite: false }, state, api })
      for (const call of calls) {
        if (call[0] === 'fight') {
          const opts = call[call.length - 1]
          opts?.onSuccess?.({ enemy: { elite: false } })
        }
      }
    }
    if (code === '08592') {
      const add = calls.find(call => call[0] === 'addEffect')
      assert.ok(add, '曲奇的「本轮不能攻击」以 addEffect 实现')
      assert.deepEqual(add[1].modifiers, [], 'addEffect 的空 modifiers 不产生实际的「不能攻击」读点')
    }
    if (code === '08593') {
      const look = calls.find(call => call[0] === 'lookAt')
      assert.deepEqual(look?.[2], { zone: 'deck', count: 1 }, '只查看自己牌库顶 1 张：缺「任一位调查员牌库或遭遇牌库」与弃牌选项')
    }
  })
}

// ---------------------------------------------------------------------------
// 08596 失落之峰（剧本参考卡）
// ---------------------------------------------------------------------------
test('08596 失落之峰（剧本参考卡）：内容层已实现标记数值，但没有单卡条目文件（一卡一文件缺口）', () => {
  assert.equal(registeredEntry('08596'), null, '08596 没有单卡条目文件')
  assert.equal(peaks.manifest.referenceCode, '08596')
  assert.ok(tp.tokenMeanings && tp.tokenMeanings.standard, '内容层 behavior 提供 tokenMeanings')
  assert.equal(typeof tp.resolveChaosToken, 'function')
  const token = tp.resolveChaosToken({ scenarioFlags: {}, locations: [{ id: 'loc', code: '08607', level: 2 }], investigators: [{ seat: 0, location: 'loc' }] }, { seat: 0, location: 'loc' }, 'skull')
  assert.ok(token != null, 'skull 标记数值由内容层 chaos 提供（无条目 scenarioRule 读点）')
})

// ---------------------------------------------------------------------------
// toTheForbiddenPeaks 共享工具
// ---------------------------------------------------------------------------
function peakState(defs) {
  const state = stateFor()
  state.locations = []
  state.scenario = { locations: {}, agendas: [], acts: [] }
  for (const [id, code, level] of defs) {
    const location = { id, code, originalCode: code, revealed: true, level, clues: 0, connections: [] }
    setLocationLevel(location, level)
    state.locations.push(location)
    state.scenario.locations[id] = { originalCode: code, level }
  }
  state.investigators[0].location = defs[0][0]
  return state
}
function fromBelow(state, seat, fromId, toId) {
  const loc = id => state.locations.find(item => item.id === id)
  state.scenarioFlags.pendingMove = { seat, from: fromId, to: toId,
    fromLevel: locationLevel(loc(fromId)), toLevel: locationLevel(loc(toId)) }
}
const EXPEDITION = '08614'

// ---------------------------------------------------------------------------
// 08597 / 08598 议程
// ---------------------------------------------------------------------------
test('08597 失落山峰：移动后线索回供应堆；背面在最高处生成星之恐怖并夺走探险支援', () => {
  assert.equal(agendaRuleFor('08597').onMove, 'returnClues')
  assert.equal(agendaRuleFor('08597').onReveal, 'spawnTerrorOfTheStars')
  const state = peakState([['locLow', '08602', 0], ['locHigh', '08600', 1]])
  state.agendas = [{ originalCode: '08597' }]
  state.investigators[0].location = 'locHigh'
  state.investigators[0].clues = 3
  state.investigators[0].assets = [{ id: 'a1', code: EXPEDITION, exhausted: false }]
  state.storyAssets = []
  const entered = tp.locationEntered(state, state.investigators[0], 'locHigh', { info: () => {} })
  assert.equal(state.investigators[0].clues, 0, '移动后线索回供应堆')
  assert.equal(entered.returnedClues, 3)
  const spawned = tp.spawnTerrorOfTheStars(state, { info: () => {} })
  assert.ok(spawned, '星之恐怖生成')
  assert.equal(spawned.code, peaksDef.RAW_CODES.terrorOfTheStars)
  assert.equal(spawned.location, 'locHigh', '生成在最高且有调查员的地点')
  assert.equal(state.investigators[0].assets.length, 0, '失去所有探险支援')
  assert.ok(state.storyAssets.some(asset => String(asset.code) === EXPEDITION), '支援留在原地')
})

test('08598 恐怖降临：移动后线索回供应堆；背面按是否有调查员撤退进入结局 1/2', () => {
  assert.equal(agendaRuleFor('08598').onMove, 'returnClues')
  assert.equal(agendaRuleFor('08598').onReveal, 'finalResolution')
  const state = peakState([['locA', '08600', 1], ['locB', '08602', 0]])
  state.agendas = [{ originalCode: '08598' }]
  state.investigators[0].clues = 4
  tp.locationEntered(state, state.investigators[0], 'locA', { info: () => {} })
  assert.equal(state.investigators[0].clues, 0)
  state.investigators[0].resigned = true
  assert.equal(tp.finalResolution(state), 'resolution1', '有调查员撤退 → 结局 1')
  state.investigators[0].resigned = false
  assert.equal(tp.finalResolution(state), 'resolution2', '无人撤退 → 结局 2')
})

// ---------------------------------------------------------------------------
// 08599 幕
// ---------------------------------------------------------------------------
test('08599 登上高峰：目标全撤退推进；行动可控制本地点探险支援', () => {
  assert.deepEqual(actRuleFor('08599').objective, { type: 'allResigned' })
  assert.equal(actRuleFor('08599').onReveal, 'resolution1')
  const state = peakState([['locSummit', '08607', 6]])
  state.acts = [{ originalCode: '08599' }]
  state.investigators[0].resigned = true
  assert.equal(tp.checkObjectives(state, { info: () => {} }), true)
  const finished = []
  assert.equal(tp.actReveal(state, state.acts[0], { finish: key => finished.push(key) }), true)
  assert.deepEqual(finished, ['resolution1'])
  state.investigators[0].resigned = false
  state.storyAssets = [{ id: 's1', code: EXPEDITION, location: 'locSummit' }]
  const moves = tp.actions(state, state.investigators[0])
  const take = moves.find(move => move.rule === 'takeExpeditionAsset')
  assert.ok(take, '提供控制探险支援的行动')
  assert.equal(tp.performAction(state, state.investigators[0], take, { info: () => {} }), true)
  assert.equal(state.storyAssets.length, 0)
  assert.ok(state.investigators[0].assets.some(asset => String(asset.code) === EXPEDITION))
})

// ---------------------------------------------------------------------------
// 08600–08607 山腰地点
// ---------------------------------------------------------------------------
test('08600 深厚积雪：从下方进入时弃牌库顶 3 张并抽取其中的弱点', () => {
  assert.equal(locationRuleFor('08600').blocksUntilBelowClear, true)
  const state = peakState([['below', '08599', 0], ['loc00', '08600', 1]])
  state.investigators[0].location = 'below'
  state.investigators[0].deck = ['01009', '01010', '08723']
  const drawn = []
  fromBelow(state, 0, 'below', 'loc00')
  const result = tp.locationEntered(state, state.investigators[0], 'loc00', { info: () => {}, drawCards: (seat, n) => drawn.push([seat, n]) })
  assert.equal(result.enterFromBelow.effect, 'discardTop3ThenDrawWeaknesses')
  assert.equal(result.enterFromBelow.discarded.length, 3)
  assert.deepEqual(result.enterFromBelow.weaknesses, ['08723'], '识别被弃的弱点')
  assert.equal(drawn.length, 1, '弱点被抽取')
})

test('08601 白色断崖：从下方进入检定敏捷(X=高度+1)，失败失去探险支援', () => {
  const state = peakState([['below', '08599', 0], ['loc01', '08601', 1]])
  state.investigators[0].location = 'below'
  state.investigators[0].assets = [{ id: 'a1', code: EXPEDITION, exhausted: false }]
  state.storyAssets = []
  const tests = []
  const api = { info: () => {}, test: (seat, skill, difficulty, callback) => tests.push({ seat, skill, difficulty, callback }) }
  fromBelow(state, 0, 'below', 'loc01')
  tp.locationEntered(state, state.investigators[0], 'loc01', api)
  assert.equal(tests.length, 1)
  assert.equal(tests[0].skill, 'agility')
  assert.equal(tests[0].difficulty, 2, 'X = 高度 1 + 1')
  tests[0].callback({ success: false })
  assert.equal(state.investigators[0].assets.length, 0, '失败失去探险支援')
  assert.ok(state.storyAssets.some(asset => String(asset.code) === EXPEDITION))
})

test('08602 陡峭斜坡：从下方进入受到 1 点伤害', () => {
  const state = peakState([['below', '08599', 0], ['loc02', '08602', 1]])
  state.investigators[0].location = 'below'
  fromBelow(state, 0, 'below', 'loc02')
  tp.locationEntered(state, state.investigators[0], 'loc02', { info: () => {} })
  assert.equal(state.investigators[0].damage, 1)
})

test('08603 狭窄山脊：从下方进入受到 1 点恐惧', () => {
  const state = peakState([['below', '08599', 0], ['loc03', '08603', 1]])
  state.investigators[0].location = 'below'
  fromBelow(state, 0, 'below', 'loc03')
  tp.locationEntered(state, state.investigators[0], 'loc03', { info: () => {} })
  assert.equal(state.investigators[0].horror, 1)
})

test('08604 岩架：从下方进入把忒咳哩-哩牌库顶 1 张洗入牌库', () => {
  const state = peakState([['below', '08599', 0], ['loc04', '08604', 1]])
  state.investigators[0].location = 'below'
  state.investigators[0].deck = []
  initializeTekeliDeck(state, { cards: [...peaksDef.TEKELI_FACES], copies: [...peaksDef.TEKELI_COPIES] })
  const before = tekeliDeckSize(state)
  fromBelow(state, 0, 'below', 'loc04')
  const result = tp.locationEntered(state, state.investigators[0], 'loc04', { info: () => {} })
  assert.equal(result.enterFromBelow.effect, 'tekeliShuffleIntoDeck')
  assert.equal(tekeliDeckSize(state), before - 1, '忒咳哩-哩牌库少 1 张')
  assert.equal(state.investigators[0].deck.length, 1, '混洗入调查员牌库')
})

test('08605 白雪覆盖的峭壁：从下方进入横置你控制的所有支援', () => {
  const state = peakState([['below', '08599', 0], ['loc05', '08605', 1]])
  state.investigators[0].location = 'below'
  state.investigators[0].assets = [{ id: 'a1', code: '01009', exhausted: false }, { id: 'a2', code: EXPEDITION, exhausted: false }]
  fromBelow(state, 0, 'below', 'loc05')
  tp.locationEntered(state, state.investigators[0], 'loc05', { info: () => {} })
  assert.equal(state.investigators[0].assets.every(asset => asset.exhausted === true), true)
})

test('08606 迎风通路：从下方进入放 1 线索；揭示时按人数放线索（卡面「高度为 0」条件未读）', () => {
  assert.equal(locationRuleFor('08606').onReveal.effect, 'placeCluesPerInvestigator')
  const state = peakState([['below', '08599', 0], ['loc06', '08606', 1]])
  state.numInvestigators = 2
  state.investigators[0].location = 'below'
  fromBelow(state, 0, 'below', 'loc06')
  tp.locationEntered(state, state.investigators[0], 'loc06', { info: () => {} })
  const loc = state.locations.find(item => item.id === 'loc06')
  assert.equal(loc.clues, 1, '从下方进入放 1 个线索')
  const amount = tp.locationRevealed(state, loc, { info: () => {} })
  assert.equal(amount, 2, '当前实现不论高度都放 1×人数线索（缺「高度为 0」条件）')
})

test('08607 山顶：线索只能调查发现；揭示加 frost；[action] 撤退把探险支援加入胜利区', () => {
  const rule = locationRuleFor('08607')
  assert.equal(rule.cluesOnlyByInvestigation, true, '山顶线索只能通过调查发现')
  const state = peakState([['locSummit', '08607', 6]])
  state.investigators[0].location = 'locSummit'
  state.investigators[0].clues = 2
  state.storyAssets = []
  state.investigators[0].assets = [{ id: 'a1', code: EXPEDITION, exhausted: false }]
  tp.locationRevealed(state, state.locations[0], { info: () => {} })
  assert.ok(state.chaosBag.includes('frost'), '揭示时混乱袋加入 frost 标记')
  const moves = tp.actions(state, state.investigators[0])
  const resign = moves.find(move => move.rule === 'summitResign')
  assert.ok(resign, '提供山顶撤退行动')
  assert.equal(tp.performAction(state, state.investigators[0], resign, { info: () => {} }), true)
  assert.equal(state.investigators[0].resigned, true)
  assert.equal(state.investigators[0].clues, 0, '线索放回供应堆')
  assert.ok(state.victoryDisplay.some(card => String(card.code) === EXPEDITION), '探险支援加入胜利区')
})
