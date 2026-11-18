// P5 九循环《铁杉谷盛宴》威尔森·理查德（10001）及专属依赖 Node 验收。
//
// 覆盖：条目注册形状 / 构筑（30 张 + 签名 10002 + 专属弱点 10003 + 1 张基础弱点）/
//   首张[[工具]]支援折扣 / [[工具]]支援检定 +1 / 旧印互换 / 应急手段（附属 + 反应 + 忽略费用）/
//   仓促修补（威胁区 + 两行动弃置 + 基础技能值 0）/ 存档往返。
//
// 索引依赖：三个条目文件的 entries/index.js 由主进程统一重建（子进程不写共享文件）。
// 索引重建前 implementation() 的静态索引看不到 10002/10003，buildDeck 会在「签名卡依赖」处失败；
// 本文件因此对 fixture/buildDeck 走一个自愈的过渡分支（重建后自动改用真实路径）。
import test from 'node:test'
import assert from 'node:assert/strict'

import wilson from '../src/cards/entries/10001.js'
import adHoc from '../src/cards/entries/10002.js'
import hastyRepairs from '../src/cards/entries/10003.js'
import '../src/engine/engine.js'

import { asset, enemy, fixture, legalMoves, move, settle } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { investigatorRule } from '../src/cards/investigator-abilities.js'
import { implementation } from '../src/cards/card-implementation.js'
import { firstAssetDiscount, recordPlayedCard } from '../src/engine/action-history.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { drawCards, elderSignEffect, getStat, performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { migrateState } from '../src/engine/save-migration.js'

const CODE = '10001'
const ENTRIES = [wilson, adHoc, hastyRepairs]

// 显式导入的条目在索引重建前不会被 engine.js 注册（它的注册表来自静态 entries/index.js）；
// 索引重建后 engine.js 已完成注册，按卡号逐个跳过即可（与 eote-investigator-lily 同一写法）。
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities(entry)

const INDEX_READY = ['10002', '10003', '10001'].every(code => implementation(code).implemented)

// 建局：索引重建后直接用 fixture('10001')；重建前用同职阶已实现调查员建局，再按印刷卡面切换身份。
function wilsonFixture() {
  if (INDEX_READY) return fixture(CODE)
  const state = fixture('01001')
  const inv = state.investigators[0]
  const def = ALL_CARDS[CODE]
  Object.assign(inv, {
    code: CODE,
    name: def.nameZh || def.name,
    nameEn: def.name,
    klass: def.klass,
    willpower: def.willpower,
    intellect: def.intellect,
    combat: def.combat,
    agility: def.agility,
    baseHealth: def.health,
    maxHealth: def.health,
    health: def.health,
    baseSanity: def.sanity,
    maxSanity: def.sanity,
    sanity: def.sanity,
  })
  return state
}

// 规则事务里的选择（检定/旧印等）必须用 resolveTransaction 消费恢复凭据（与 lily 测试同一写法）。
function transaction(state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'p5WilsonTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const choice = state.pendingChoice
    const id = select(choice, state)
      ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}

const baseValue = state => Number(state.lastTestResult?.value)
const invNow = state => state.investigators[0]
const attachOf = (state, hostId) =>
  (invNow(state).assets.find(item => item.id === hostId)?.attachments || []).find(item => item.code === '10002')
const locationOf = state => state.locations.find(location => location.id === invNow(state).location)

// 抽 1 张牌并结算（牌库顶放好要抽的卡号）。
function drawTop(state, code) {
  invNow(state).deck = [code]
  drawCards(state, invNow(state), 1, [])
  settle(state)
  return code
}

// ── 1. 条目注册形状 ─────────────────────────────────────────────────────────
test('P5 10001 条目注册：调查员旧印/首张支援折扣、应急手段 played+reaction、仓促修补威胁弱点', () => {
  for (const entry of ENTRIES) assert.ok(registeredEntry(entry.code), `${entry.code} 必须注册`)
  const investigator = registeredEntry(CODE)
  assert.equal(investigator.kind, 'investigator')
  assert.ok(investigator.elderSign?.resolve, '旧印必须有 resolve')
  assert.equal(investigator.elderSign.id, '10001-eldersign')
  assert.equal(Number(investigator.investigator?.elderSign?.bonus) || 0, 0, '旧印数值 +0')
  const rule = investigatorRule(CODE)
  assert.deepEqual(rule.firstAssetOfRound, { trait: 'tool', amount: 1 })

  const adHocEntry = registeredEntry('10002')
  assert.equal(adHocEntry.abilities.filter(descriptor => descriptor.kind === 'played').length, 1)
  const reaction = adHocEntry.abilities.find(descriptor => descriptor.kind === 'reaction')
  assert.ok(reaction, '应急手段必须有反应描述子')
  assert.deepEqual(reaction.trigger, ['assetActionResolved'])
  assert.equal(reaction.cost.exhaust, true, '反应费用是横置')
  assert.equal(adHocEntry.keepOnPlay, true, '事件结算后留在宿主上')
  assert.equal(adHocEntry.playCondition.length, 1, '必须有打出条件（控制[[工具]]/[[武器]]支援）')

  const hastyEntry = registeredEntry('10003')
  const weakness = hastyEntry.abilities.find(descriptor => descriptor.kind === 'weakness')
  assert.ok(weakness, '仓促修补是弱点描述子')
  assert.equal(weakness.weakness.type, 'threat')
  assert.deepEqual(weakness.weakness.discardCost, { action: 2 }, '两行动弃掉')
  assert.equal(hastyEntry.modifiers.length, 4, '四项技能各一条 -印刷基值 的等价修正')
  assert.deepEqual(hastyEntry.modifiers.map(modifier => modifier.target).sort(),
    ['skill:agility', 'skill:combat', 'skill:intellect', 'skill:willpower'])
  assert.ok(hastyEntry.note, '近似实现必须在条目 note 里披露')
})

// ── 2. 构筑 ────────────────────────────────────────────────────────────────
test('P5 10001 构筑：印刷牌组要求、合法 30 张零错误、非法卡报错', () => {
  const card = ALL_CARDS[CODE]
  assert.equal(card.deckRequirements.size, 30)
  assert.deepEqual([...card.deckRequirements.signatureCards].sort(), ['10002', '10003'])
  assert.equal(ALL_CARDS['10002'].signatureFor[0], CODE)
  assert.equal(ALL_CARDS['10002'].quantity, 1)
  assert.equal(ALL_CARDS['10003'].quantity, 1)
  assert.equal(ALL_CARDS['10003'].subtype, 'weakness')

  // 合法 30 张（Tool 0–5 / Guardian 0–4 / Neutral 0–5 都在威尔森的印刷选项内）。
  const legal = ['01016', '01016', '01017', '01017', '01018', '01018', '01019', '01019',
    '01020', '01020', '01021', '01021', '01022', '01022', '01023', '01023', '01024', '01024',
    '01025', '01025', '01030', '01030', '01086', '01086', '01087', '01087', '01088', '01088',
    '01089', '01089']
  assert.deepEqual(validateDeckRules(INVESTIGATORS[CODE], legal, ALL_CARDS).errors, [])
  // 非法：09077 是游荡者支援，既非[[工具]]也不在守卫者/中立/即兴升级选项内。
  const illegal = validateDeckRules(INVESTIGATORS[CODE], [...legal.slice(1), '09077'], ALL_CARDS)
  assert.ok(illegal.errors.length > 0, '选项外的 0 经验卡必须报错')

  if (!INDEX_READY) {
    // 子进程不重建 entries/index.js：静态 implementation() 索引里还没有 10002/10003，
    // buildDeck 的「签名卡依赖」校验因此失败。主进程重建索引后本分支不再执行，改用下面的真实构筑。
    let built = null
    try {
      built = buildDeck(INVESTIGATORS[CODE], { seed: 'p5-10001' })
    } catch (error) {
      assert.match(String(error.message), /签名卡或专属弱点依赖/, '索引未重建时的预期失败原因')
    }
    if (built) assert.equal(built.playerCards.length, 30)
    return
  }
  const deck = buildDeck(INVESTIGATORS[CODE], { seed: 'p5-10001' })
  assert.equal(deck.playerCards.length, 30)
  assert.deepEqual([...deck.signatureCards].sort(), ['10002'], '签名事件 1 张')
  assert.deepEqual(deck.signatureWeaknesses, ['10003'], '专属弱点 1 张')
  assert.equal(deck.basicWeaknesses.length, 1, '1 张随机基础弱点')
  assert.deepEqual(validateDeckRules(INVESTIGATORS[CODE], deck.playerCards, ALL_CARDS).errors, [])
})

// ── 3. 首张[[工具]]支援折扣 ─────────────────────────────────────────────────
test('P5 10001 每轮第一张[[工具]]支援 -1：同轮第二张原价、下一轮重置、[[工具]]事件不消耗', () => {
  const state = wilsonFixture()
  invNow(state).resources = 30
  invNow(state).hand = ['01030', '01030', '01030'] // 放大镜：费用 1 的[[工具]]支援
  const spent = () => {
    const before = invNow(state).resources
    move(state, legalMoves(state, 0).find(candidate => candidate.action === 'play' && candidate.cardId === '01030'))
    settle(state)
    return before - invNow(state).resources
  }
  assert.equal(spent(), 0, '本轮第一张[[工具]]支援费用 1-1=0')
  assert.equal(spent(), 1, '同轮第二张恢复原价')
  state.round += 1
  assert.equal(spent(), 0, '新一轮重置折扣')

  // 「[[工具]]事件」不会消耗本轮折扣：recordPlayedCard 只对 type==='asset' 记账。
  const probe = wilsonFixture()
  const probeInv = invNow(probe)
  const toolEvent = { ...ALL_CARDS['03037'], type: 'event' }
  recordPlayedCard(probe, probeInv, toolEvent, registeredEntry)
  const toolAsset = ALL_CARDS['01030']
  assert.equal(firstAssetDiscount(probe, probeInv, toolAsset, registeredEntry), 1)
  const nonTool = ALL_CARDS['01088'] // 非[[工具]]卡不吃这份折扣
  assert.equal(firstAssetDiscount(probe, probeInv, nonTool, registeredEntry), 0)
})

// ── 4. [[工具]]支援检定 +1 ──────────────────────────────────────────────────
test('P5 10001 [[工具]]支援上的技能检定 +1，非[[工具]]检定不加值', () => {
  const state = wilsonFixture()
  const shovel = asset(state, '03037') // 挖墓人的铲子：[[工具]]/[[武器]]，[action] 攻击
  enemy(state)
  const printed = ALL_CARDS[CODE].combat
  assert.equal(getStat(state, invNow(state), 'combat'), printed, '非检定期间不加值')
  move(state, legalMoves(state, 0).find(candidate => candidate.action === 'ability'
    && candidate.assetId === shovel.id && candidate.abilityIndex === 0))
  settle(state)
  // 铲子本次攻击 +2[combat]：基础值 = 印刷 3 + 威尔森 +1 = 4，总值 6。
  assert.equal(state.lastTestResult.baseValue, printed + 1, '[[工具]]支援检定基础值 +1')
  assert.equal(baseValue(state), printed + 1 + 2)

  const basic = wilsonFixture()
  const foe = enemy(basic)
  move(basic, { action: 'fight', enemyId: foe.id })
  settle(basic)
  assert.equal(basic.lastTestResult.baseValue, printed, '普通攻击检定不加值')
})

// ── 5. 旧印 ────────────────────────────────────────────────────────────────
test('P5 10001 旧印 +0：可与手牌[[工具]]互换（费用相等或更低），费用更高时不换', () => {
  const plain = wilsonFixture()
  const effect = elderSignEffect(plain, invNow(plain))
  assert.equal(Number(effect.delta) || 0, 0, '旧印 +0')
  settle(plain)

  const swapOf = handCode => {
    const state = wilsonFixture()
    asset(state, '03037') // 印刷费用 2 的[[工具]]
    invNow(state).hand = [handCode]
    state.chaosBag = ['eldersign']
    const prompts = []
    transaction(state, draft => performTest(draft, 0, 'willpower', 0, {}), choice => {
      const prompt = String(choice.prompt || '')
      prompts.push(prompt)
      // 「威尔森旧印：是否交换…」：选第一个非「不交换」的选项。
      if (prompt.includes('威尔森旧印')) return choice.options.find(option => option.id !== 'skip')?.id ?? 'skip'
      return null
    })
    return { state, prompts }
  }

  const cheaper = swapOf('01040') // 放大镜 0 费[[工具]]
  assert.equal(cheaper.state.lastTestResult.value, ALL_CARDS[CODE].willpower, '旧印 +0 不改变检定值')
  assert.ok(cheaper.prompts.some(prompt => prompt.includes('威尔森旧印')), '有合法配对时应询问')
  assert.deepEqual(invNow(cheaper.state).assets.map(item => item.code), ['01040'], '新手牌[[工具]]在原位入场')
  assert.deepEqual(invNow(cheaper.state).hand, ['03037'], '旧[[工具]]退回手牌')

  const pricier = swapOf('05024') // 指纹采集器 4 费 > 2 费
  assert.deepEqual(invNow(pricier.state).assets.map(item => item.code), ['03037'], '费用更高的手牌[[工具]]不能换')
  assert.deepEqual(invNow(pricier.state).hand, ['05024'])
  assert.equal(pricier.prompts.some(prompt => prompt.includes('威尔森旧印')), false, '没有合法配对时不询问')
})

// ── 6. 应急手段 ────────────────────────────────────────────────────────────
test('P5 10001 应急手段：打出附属到[[工具]]，反应弃手牌[[工具]]/[[武器]]并忽略费用结算其能力', () => {
  const state = wilsonFixture()
  const host = asset(state, '02114') // 灭火器：[[工具]]，[action] 攻击
  locationOf(state).clues = 2
  const foe = enemy(state)
  invNow(state).hand = ['10002']
  move(state, { action: 'play', cardId: '10002' })
  settle(state)
  assert.equal(attachOf(state, host.id)?.code, '10002', '应附属到[[工具]]宿主')
  assert.equal(invNow(state).discard.includes('10002'), false, '事件留在宿主上（不进弃牌堆）')
  assert.ok(invNow(state).assets.some(item => item.id === host.id), '宿主仍在场')

  invNow(state).hand = ['03037'] // 挖墓人的铲子：[[工具]]/[[武器]]，有「发现 1 线索」的[action]能力
  const cluesBefore = invNow(state).clues
  const seen = []
  move(state, legalMoves(state, 0).find(candidate => candidate.action === 'ability'
    && candidate.assetId === host.id && candidate.abilityIndex === 0))
  settle(state, choice => {
    seen.push({ prompt: String(choice.prompt || ''), labels: choice.options.map(option => option.label) })
    const reactionOption = choice.options.find(option => /应急手段/.test(option.label))
    if (reactionOption) return reactionOption.id
    const clueAbility = choice.options.find(option => /线索/.test(option.label))
    if (clueAbility) return clueAbility.id
    return null
  })
  assert.ok(seen.some(item => item.labels.some(label => /应急手段/.test(label))), '所附属支援结算[action]能力后应询问反应')
  assert.equal(invNow(state).clues, cluesBefore + 1, '忽略费用结算了「发现 1 线索」')
  assert.deepEqual(invNow(state).hand, [], '手牌中的[[工具]]被弃掉')
  assert.ok(invNow(state).discard.includes('03037'), '弃掉的支援进入弃牌堆')
  assert.equal(attachOf(state, host.id)?.exhausted, true, '应急手段被横置')
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 1, '宿主攻击本身照常结算')
})

test('P5 10001 应急手段：手里没有[[工具]]/[[武器]]时不询问；有卡但没有[action]能力时只横置不弃牌', () => {
  const setup = handCode => {
    const state = wilsonFixture()
    const host = asset(state, '02114')
    enemy(state)
    invNow(state).hand = ['10002']
    move(state, { action: 'play', cardId: '10002' })
    settle(state)
    invNow(state).hand = [handCode]
    const seen = []
    move(state, legalMoves(state, 0).find(candidate => candidate.action === 'ability'
      && candidate.assetId === host.id && candidate.abilityIndex === 0))
    settle(state, choice => {
      seen.push(choice.options.map(option => option.label).join('|'))
      const reactionOption = choice.options.find(option => /应急手段/.test(option.label))
      return reactionOption?.id ?? null
    })
    return { state, hostId: host.id, prompts: seen.filter(labels => /应急手段/.test(labels)) }
  }

  const noTool = setup('01088') // 01088 不是[[工具]]/[[武器]]
  assert.equal(noTool.prompts.length, 0, '手牌没有[[工具]]/[[武器]]时反应不可用')
  assert.deepEqual(invNow(noTool.state).hand, ['01088'])
  assert.equal(attachOf(noTool.state, noTool.hostId)?.exhausted, undefined)

  const noAbility = setup('01030') // 放大镜没有[action]能力
  assert.equal(noAbility.prompts.length, 1, '仍会询问一次（criteria 读不到能力表，见条目 note）')
  assert.deepEqual(invNow(noAbility.state).hand, ['01030'], '没有可结算能力时不弃牌')
  assert.equal(invNow(noAbility.state).discard.includes('01030'), false)
  assert.equal(attachOf(noAbility.state, noAbility.hostId)?.exhausted, true, '横置费用照付')
})

test('P5 10001 应急手段：没有控制的[[工具]]/[[武器]]时不能打出，[[武器]]宿主同样合法', () => {
  const state = wilsonFixture()
  invNow(state).hand = ['10002']
  const blocked = legalMoves(state, 0).find(candidate => candidate.action === 'play' && candidate.cardId === '10002')
  assert.equal(blocked, undefined, '没有合法宿主时不提供打出候选')
  const weapon = asset(state, '01016') // .45 Automatic：[[武器]]（不是[[工具]]）
  const allowed = legalMoves(state, 0).find(candidate => candidate.action === 'play' && candidate.cardId === '10002')
  assert.ok(allowed, '有[[武器]]宿主时可以打出')
  move(state, { action: 'play', cardId: '10002' })
  settle(state)
  assert.equal(attachOf(state, weapon.id)?.code, '10002', '[[武器]]也是合法宿主')
})

// ── 7. 仓促修补 ────────────────────────────────────────────────────────────
test('P5 10001 仓促修补：显现进威胁区、触发支援能力时基础技能值 0、两行动弃掉', () => {
  const state = wilsonFixture()
  drawTop(state, '10003')
  assert.ok(invNow(state).threat.some(item => item.code === '10003'), '显现后进入威胁区')

  const shovel = asset(state, '03037') // [[工具]]支援：本次攻击 +2[combat]
  enemy(state)
  move(state, legalMoves(state, 0).find(candidate => candidate.action === 'ability'
    && candidate.assetId === shovel.id && candidate.abilityIndex === 0))
  settle(state)
  // 基础值 = 0 + 威尔森[[工具]]检定 +1 = 1；铲子 +2 → 总值 3（没有弱点时是 6）。
  assert.equal(state.lastTestResult.baseValue, 1, '基础技能值被设为 0，再叠加修正')
  assert.equal(baseValue(state), 3)

  const actionsBefore = invNow(state).actionsLeft
  const discard = legalMoves(state, 0).find(candidate => candidate.action === 'discardThreat')
  assert.ok(discard, '威胁区应提供弃置行动')
  assert.match(discard.label, /花 2 行动/)
  move(state, discard)
  settle(state)
  assert.equal(invNow(state).actionsLeft, actionsBefore - 2, '弃置花 2 行动')
  assert.equal(invNow(state).threat.some(item => item.code === '10003'), false)
  assert.ok(invNow(state).discard.includes('10003'))
})

// ── 8. 存档往返 ────────────────────────────────────────────────────────────
test('P5 10001 存档往返：附属的应急手段与威胁区弱点、注册表与调查员规则都随 JSON 保存', () => {
  const state = wilsonFixture()
  const host = asset(state, '02114')
  locationOf(state).clues = 2
  enemy(state)
  drawTop(state, '10003')
  invNow(state).hand = ['10002']
  move(state, { action: 'play', cardId: '10002' })
  settle(state)
  invNow(state).hand = ['03037']

  const saved = JSON.parse(JSON.stringify(state))
  migrateState(saved)
  assert.ok(registeredEntry('10001') && registeredEntry('10002') && registeredEntry('10003'), '注册表在存档往返后仍可用')
  assert.deepEqual(investigatorRule('10001').firstAssetOfRound, { trait: 'tool', amount: 1 })
  assert.equal(attachOf(saved, host.id)?.code, '10002', '附属随存档保留')
  assert.ok(saved.investigators[0].threat.some(item => item.code === '10003'), '威胁区弱点随存档保留')

  // 读档后照常结算宿主[action]能力：弱点把基础值压到 0、威尔森 +1，且应急手段的反应仍可触发。
  const seen = []
  move(saved, legalMoves(saved, 0).find(candidate => candidate.action === 'ability'
    && candidate.assetId === host.id && candidate.abilityIndex === 0))
  settle(saved, choice => {
    seen.push(choice.options.map(option => option.label).join('|'))
    const reactionOption = choice.options.find(option => /应急手段/.test(option.label))
    if (reactionOption) return reactionOption.id
    const clueAbility = choice.options.find(option => /线索/.test(option.label))
    if (clueAbility) return clueAbility.id
    return null
  })
  assert.equal(saved.lastTestResult.baseValue, 1, '读档后「基础技能值 0」仍然生效')
  assert.ok(seen.some(labels => /应急手段/.test(labels)), '读档后反应仍被询问')
  assert.equal(saved.investigators[0].clues, 1, '忽略费用结算了铲子的发现线索能力')
  assert.equal(saved.investigators[0].hand.length, 0)
})
