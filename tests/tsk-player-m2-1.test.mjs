// 八循环《绯红密钥》P6 一般玩家卡 · M2-1 分片（09021–09047）逐卡验收。
//
// 分片共 27 张；每张都有 `src/cards/entries/<code>.js` 与一条 `P6 <code> <中文名> …` 真实行为测试。
// 近似实现（缺引擎读点）在条目 note / 注释里逐条披露，并在
// `artifacts/migration/tsk/primitive-requests/<code>.json` 登记。
//
// 约定：
//   · 每张已实现卡至少一条真实行为断言（费用/槽位/使用次数/目标/窗口/持续时间/负面路径）；
//   · 引擎在每次 applyMove 后替换调查员对象 —— 断言前从 state 重新读取；
//   · 需要直接发起检定/窗口时，用 resolveTransaction 包住引擎入口（无 continuation 丢失）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, asset, enemy, settle, legalMoves } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { executeDescriptor, getMaxSanity, getStat, playCost, reactionWindow } from '../src/engine/engine.js'
import { commitProfile } from '../src/engine/lifecycle.js'
import { customizationChecked, upgradeCustomization } from '../src/engine/tsk-customizable.js'

import card09021 from '../src/cards/entries/09021.js'
import card09022 from '../src/cards/entries/09022.js'
import card09023 from '../src/cards/entries/09023.js'
import card09024 from '../src/cards/entries/09024.js'
import card09025 from '../src/cards/entries/09025.js'
import card09026 from '../src/cards/entries/09026.js'
import card09027 from '../src/cards/entries/09027.js'
import card09028 from '../src/cards/entries/09028.js'
import card09029 from '../src/cards/entries/09029.js'
import card09030 from '../src/cards/entries/09030.js'
import card09031 from '../src/cards/entries/09031.js'
import card09032 from '../src/cards/entries/09032.js'
import card09033 from '../src/cards/entries/09033.js'
import card09034 from '../src/cards/entries/09034.js'
import card09035 from '../src/cards/entries/09035.js'
import card09036 from '../src/cards/entries/09036.js'
import card09037 from '../src/cards/entries/09037.js'
import card09038 from '../src/cards/entries/09038.js'
import card09039 from '../src/cards/entries/09039.js'
import card09040 from '../src/cards/entries/09040.js'
import card09041 from '../src/cards/entries/09041.js'
import card09042 from '../src/cards/entries/09042.js'
import card09043 from '../src/cards/entries/09043.js'
import card09044 from '../src/cards/entries/09044.js'
import card09045 from '../src/cards/entries/09045.js'
import card09046 from '../src/cards/entries/09046.js'
import card09047 from '../src/cards/entries/09047.js'

const ENTRIES = [card09021, card09022, card09023, card09024, card09025, card09026, card09027, card09028,
  card09029, card09030, card09031, card09032, card09033, card09034, card09035, card09036, card09037,
  card09038, card09039, card09040, card09041, card09042, card09043, card09044, card09045, card09046, card09047]
for (const entry of ENTRIES) if (!registeredEntry(entry.code)) registerCardAbilities([entry])

const me = (state, seat = 0) => state.investigators[seat]
const pickId = (pending, ids) => {
  for (const id of ids) if (pending.options.some(option => String(option.id) === String(id))) return String(id)
  return null
}
const pickDesc = pending => {
  const option = pending.options.find(item => String(item.id).startsWith('desc:'))
  return option ? option.id : null
}
// 规则事务探针：直接调用引擎入口并收敛全部待决选择。
function probe(state, execute, choose = () => null) {
  resolveTransaction(state, 0, { action: 'tskPlayerProbe' }, execute)
  for (let index = 0; state.pendingChoice && index < 200; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId: chosen }, execute)
  }
}
// 对局行动探针：用 applyMove 入口（ability/play/fight）并收敛普通选择。
function act(state, choose = () => null) {
  for (let index = 0; state.pendingChoice && index < 200; index++) {
    const pending = state.pendingChoice
    const chosen = choose(pending)
      ?? ['done', 'skip', 'self'].find(id => pending.options.some(option => option.id === id))
      ?? pending.options[0]?.id
    assert.ok(chosen != null, `待决选择没有可选项：${JSON.stringify(pending)}`)
    move(state, { action: 'choose', choiceId: pending.id, optionId: chosen })
  }
}
// 事件卡在 catalog-only 阶段不能走真实 play 入口；直接执行已注册的 played 描述符
// （仍是引擎 executeDescriptor + ctx.api，不伪造效果），验证 resolve 行为。
const resolvePlayed = (state, code, extra = {}) => {
  const descriptor = registeredEntry(code).abilities.find(ability => ability.kind === 'played')
  assert.ok(descriptor, `${code} 缺少 played 描述符`)
  probe(state, draft => executeDescriptor(draft, {
    inv: draft.investigators[0], source: { id: `probe:${code}`, code }, descriptor, events: [],
    context: extra.context || {}, silent: false,
  }), extra.choose)
}
// 反应/免费能力的直接执行探针（同样走 executeDescriptor）。
const resolveAbility = (state, code, extra = {}) => {
  const entry = registeredEntry(code)
  const descriptor = extra.kind
    ? entry.abilities.find(ability => ability.kind === extra.kind)
    : entry.abilities[0]
  assert.ok(descriptor, `${code} 缺少描述符`)
  probe(state, draft => {
    const source = extra.source
      || (extra.assetCode
        ? draft.investigators[0].assets.find(card => card.code === extra.assetCode)
        : { id: `probe:${code}`, code })
    executeDescriptor(draft, {
      inv: draft.investigators[0], source, descriptor, events: [], context: extra.context || {}, silent: false,
    })
  }, extra.choose)
}
// 任意 ctx.api 调用的探针（走引擎 executeDescriptor，不直写 state）。
const withApi = (state, run, choose = () => null) => probe(state, draft => executeDescriptor(draft, {
  inv: draft.investigators[0], source: { id: 'probe:api', code: '01000' },
  descriptor: { kind: 'played', resolve: ({ api }) => run(api, draft) }, events: [], context: {}, silent: true,
}), choose)
const windowProbe = (state, when, context, choose = () => null) => {
  let captured = null
  probe(state, draft => {
    captured = { ...context }
    reactionWindow(draft, when, captured, [], { allowNested: true })
  }, choose)
  return captured
}
const freshAsset = (state, code) => me(state).assets.find(card => card.code === code)
const attachmentOf = (state, code) => {
  for (const owner of state.investigators) {
    for (const card of owner.assets || []) {
      const found = (card.attachments || []).find(item => item.code === code)
      if (found) return { host: card, attachment: found }
    }
  }
  return null
}
const twoLocations = state => {
  state.locations[0].connections = ['attic']
  state.locations.push({ id: 'attic', name: '阁楼', clues: 2, shroud: 1, connections: ['study'], revealed: true })
  return [state.locations[0], state.locations.find(location => location.id === 'attic')]
}
const custom = (state, code, checked, seat = 0) =>
  upgradeCustomization(state, { seat, code, checked, availableXp: 30 })

// ── 09021 猎人护甲 ──────────────────────────────────────────────────────────
test('P6 09021 猎人护甲 定制面板 7 项契约；轻量刻印 -1 费用；伤害优先分配给护甲', () => {
  const state = fixture('01001')
  me(state).assets = []
  asset(state, '09021')
  me(state).damage = 0
  const entry = registeredEntry('09021')
  assert.equal(entry.customizationOptions.length, 7, '7 个勾选面板项')
  assert.deepEqual(entry.customizationOptions.map(option => option.checks), [1, 2, 2, 2, 2, 3, 3], '逐项格数')
  assert.equal(playCost(state, me(state), ALL_CARDS['09021']), 4, '未勾选时印刷费用 4')
  custom(state, '09021', [4])
  assert.deepEqual(customizationChecked(state, 0, '09021'), [4], '轻量刻印已勾选')
  assert.equal(playCost(state, me(state), ALL_CARDS['09021']), 3, '轻量刻印：费用 -1')
  withApi(state, api => api.harm(0, { damage: 1, strategy: 'assetsFirst' }))
  assert.equal(freshAsset(state, '09021').damage, 1, '1 点伤害分配给猎人护甲')
  assert.equal(me(state).damage, 0, '调查员未受到伤害')
})

// ── 09022 符文斧 ────────────────────────────────────────────────────────────
test('P6 09022 符文斧 攻击 +1[combat]；花 1 充能灌注精准再 +2；每轮开始补满 1 充能', () => {
  const state = fixture('01001')
  me(state).assets = []
  const axe = asset(state, '09022')
  assert.equal(axe.uses, 4, '入场 4 充能')
  const target = enemy(state, { fight: 0, evade: 1, health: 30 })
  state.chaosBag = ['0']
  const attack = legalMoves(state).find(option => option.action === 'ability' && option.assetId === axe.id)
  assert.ok(attack, '符文斧应有攻击行动')
  move(state, attack)
  act(state, pending => {
    if (pending.options.some(option => String(option.id) === '1')) return '1'
    return pickId(pending, ['accuracy', 'power'])
  })
  const base = ALL_CARDS['01001'].combat
  assert.ok(state.lastTestResult?.success, '攻击成功')
  assert.equal(state.lastTestResult.value, base + 3, '基础 +1[combat] + 精准 +2[combat]')
  assert.equal(freshAsset(state, '09022').uses, 3, '花掉 1 充能')
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1, '本次攻击 1 点伤害')
  windowProbe(state, 'roundStarts', { when: 'roundStarts' })
  assert.equal(freshAsset(state, '09022').uses, 4, '轮开始补满 1 充能（上限 4）')
  assert.equal(registeredEntry('09022').customizationOptions.length, 8, '8 个定制项')
})

// ── 09023 定制改良 ──────────────────────────────────────────────────────────
test('P6 09023 定制改良 附属到[[枪械]]支援；攻击时揭示标记可取消并重抽', () => {
  const state = fixture('01001')
  me(state).assets = []
  const gun = asset(state, '11022')
  resolvePlayed(state, '09023', { choose: pending => pickId(pending, [gun.id]) })
  assert.ok((state.investigators[0].assets.find(card => card.code === '11022').attachments || [])
    .some(card => card.code === '09023'), '定制改良附属到枪械支援')
  state.chaosBag = ['-2', '0', '+1']
  const before = state.chaosBag.length
  state.skillTest = { seat: 0, skill: 'combat', difficulty: 2, value: 4, committed: [], assetSourceId: gun.id, stage: 'ST.5' }
  const context = windowProbe(state, 'tokenReveal', {
    when: 'tokenReveal', seat: 0, location: me(state).location, token: '-2', tokenDelta: -2, autoFail: false, testValue: 2,
  }, pending => (pending.options.some(option => option.id === 'trigger') ? 'trigger' : pickDesc(pending)))
  assert.ok(context.replacementToken && context.replacementToken !== '-2', '取消了原标记并替换为新标记')
  assert.equal(state.chaosBag.length, before - 1, '替换标记从混乱袋取出（净数量守恒）')
  assert.equal(state.investigators[0].assets.find(card => card.code === '11022')
    .attachments.find(card => card.code === '09023').exhausted, true, '横置定制改良作为费用')
  delete state.skillTest
})

// ── 09024 黑曜石手串 ────────────────────────────────────────────────────────
test('P6 09024 黑曜石手串 同地点其他调查员的伤害可以分配给本卡', () => {
  const state = fixture('01001', 2)
  me(state, 0).assets = []
  me(state, 1).assets = []
  const bracelet = asset(state, '09024')
  me(state, 1).damage = 0
  me(state, 0).damage = 0
  withApi(state, api => api.harm(1, { damage: 1 }), pending => pickId(pending, [bracelet.id]))
  assert.equal(freshAsset(state, '09024').damage, 1, '伤害分配给黑曜石手串')
  assert.equal(me(state, 1).damage, 0, '另一名调查员未受到伤害')
  assert.equal(me(state, 0).damage, 0, '控制者未受到伤害')
})

// ── 09025 绊脚索 ────────────────────────────────────────────────────────────
test('P6 09025 绊脚索 用[combat]躲避；成功且非精英时附属，敌人躲避值 -1 且横置', () => {
  const state = fixture('01001')
  me(state).assets = []
  const foe = enemy(state, { fight: 1, evade: 2, health: 10, elite: false })
  state.chaosBag = ['+1']
  const combat = getStat(state, me(state), 'combat')
  resolvePlayed(state, '09025', { choose: pending => pickId(pending, [foe.id]) })
  assert.ok(state.lastTestResult?.success, '躲避成功')
  assert.equal(state.lastTestResult.skill, 'combat', '躲避检定使用[combat]（而非[agility]）')
  assert.equal(state.lastTestResult.value, combat + 1, '技能值 = 战斗 + 标记')
  const after = state.enemies.find(item => item.id === foe.id)
  assert.ok((after.attachments || []).some(card => card.code === '09025'), '绊脚索附属到敌人')
  assert.equal((after.statMods || []).reduce((sum, row) => sum + (row.evade || 0), 0), -1, '附属敌人躲避值 -1')
  assert.equal(after.exhausted, true, '横置该敌人')
  const elite = enemy(state, { fight: 1, evade: 2, health: 10, elite: true })
  state.chaosBag = ['+1']
  resolvePlayed(state, '09025', { choose: pending => pickId(pending, [elite.id]) })
  assert.equal((state.enemies.find(item => item.id === elite.id).attachments || []).length, 0, '精英敌人不能被附属')
})

// ── 09026 强势破门 ──────────────────────────────────────────────────────────
test('P6 09026 强势破门 检定[combat](1)：成功附属到地点，超难度每点放 1 迹象并使隐藏值 -1', () => {
  const state = fixture('01001')
  me(state).assets = []
  state.chaosBag = ['+1']
  const combat = getStat(state, me(state), 'combat')
  resolvePlayed(state, '09026')
  assert.ok(state.lastTestResult?.success, '检定成功')
  const leads = combat
  const attachment = state.playerLocationAttachments.find(card => card.code === '09026')
  assert.ok(attachment, '强势破门附属到地点')
  assert.equal(attachment.leads, leads, '迹象数 = 超过难度的点数')
  assert.equal(state.locations[0].shroudMod, -leads, '隐藏值每个迹象 -1')
})

// ── 09027 深度伤痛 ──────────────────────────────────────────────────────────
test('P6 09027 深度伤痛 附属到非精英敌人；轮末对附属敌人造成 1 点伤害', () => {
  const state = fixture('01001')
  me(state).assets = []
  const foe = enemy(state, { fight: 1, evade: 1, health: 12, elite: false, damageTaken: 0 })
  resolvePlayed(state, '09027', { choose: pending => pickId(pending, [foe.id]) })
  assert.ok((state.enemies.find(item => item.id === foe.id).attachments || []).some(card => card.code === '09027'),
    '深度伤痛附属到敌人')
  windowProbe(state, 'roundEnds', { when: 'roundEnds', round: state.round })
  assert.equal(state.enemies.find(item => item.id === foe.id).damageTaken, 1, '轮末造成 1 点伤害')
  const elite = enemy(state, { fight: 1, evade: 1, health: 8, elite: true })
  resolvePlayed(state, '09027')
  assert.equal((state.enemies.find(item => item.id === elite.id).attachments || []).length, 0, '精英敌人不能被附属')
})

// ── 09028 励志演讲 ──────────────────────────────────────────────────────────
test('P6 09028 励志演讲 谈判：同地点一位调查员以 -3 费用从手牌打出[[盟友]]支援', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10062']
  me(state).resources = 0
  resolvePlayed(state, '09028', {
    choose: pending => pickId(pending, ['10062']) ?? pickId(pending, ['0']),
  })
  assert.ok(me(state).assets.some(card => card.code === '10062'), '盟友支援已入场')
  assert.equal(me(state).hand.length, 0, '手牌已打出')
  assert.equal(me(state).resources, 0, '费用 2 - 3 → 免费打出')
})

// ── 09029 还剩一枪 ──────────────────────────────────────────────────────────
test('P6 09029 还剩一枪 给打空弹药的[[枪械]]补 1 发；本轮攻击 +3 技能值', () => {
  const state = fixture('01001')
  me(state).assets = []
  const gun = asset(state, '11022', { uses: 0, usesType: 'ammo' })
  const base = ALL_CARDS['01001'].combat
  resolvePlayed(state, '09029')
  assert.equal(freshAsset(state, '11022').uses, 1, '补 1 发子弹')
  assert.equal(getStat(state, me(state), 'combat'), base + 3, '本轮攻击 +3 技能值')
  const effect = state.effects.find(item => item.sourceCode === '09029')
  assert.ok(effect, '持续效果已记录')
  assert.equal(effect.modifiers[0].amount, 3, '修正值 = 3')
  assert.ok(gun.id, '枪械实例存在')
})

// ── 09030 战斗课程 ──────────────────────────────────────────────────────────
test('P6 09030 战斗课程 只能投入攻击/躲避检定；任意地点调查员的检定可投入', () => {
  // 投入限制写在 commit 档案（commit-rules.js 的唯一读点 commitProfile(code).commitCondition）。
  const profile = commitProfile('09030')
  assert.equal(typeof profile.commitCondition, 'function', 'commit 档案带投入条件')
  const ctx = source => ({ test: { source }, owner: {}, performer: {}, state: {} })
  assert.equal(profile.commitCondition(ctx({ label: '攻击', enemyId: 'e1' })), true, '攻击检定可以投入')
  assert.equal(profile.commitCondition(ctx({ label: '躲避', enemyId: 'e2' })), true, '躲避检定可以投入')
  assert.equal(profile.commitCondition(ctx({ label: '调查' })), false, '调查检定不能投入')
  // 跨座位：条件不读座位（任意地点调查员的检定都可以投入）。
  assert.equal(profile.selfTestOnly, undefined, '没有限制只能投入自己的检定')
  assert.equal(profile.anySkill, undefined, '只限攻击/躲避：不是 anySkill')
})

// ── 09031 援助之手 ──────────────────────────────────────────────────────────
test('P6 09031 援助之手 可投入任意检定且每次限 1 张；其他投入卡的图标翻倍', () => {
  const profile = commitProfile('09031')
  assert.equal(profile.anySkill, true, '可投入任意类型的检定')
  assert.equal(profile.maxPerTest, 1, '每次检定最多投入 1 张')
  const state = fixture('01001')
  me(state).hand = ['09031']
  state.skillTest = { seat: 0, skill: 'combat', difficulty: 3, value: 5, committed: [{ seat: 0, code: '09031', icons: 0 }], stage: 'ST.2' }
  windowProbe(state, 'committedCard', {
    when: 'committedCard', seat: 0, location: me(state).location, cardCode: '10021', icons: 2,
  }, pending => pickDesc(pending))
  assert.equal(state.skillTest.extraCommittedIcons, 2, '其他卡牌的 2 个图标翻倍（+2）')
  // 负面路径：没有投入援助之手时不会翻倍。
  state.skillTest.committed = []
  windowProbe(state, 'committedCard', {
    when: 'committedCard', seat: 0, location: me(state).location, cardCode: '10034', icons: 2,
  }, pending => pickDesc(pending))
  assert.equal(state.skillTest.extraCommittedIcons, 2, '未投入援助之手时图标不翻倍')
  delete state.skillTest
})

// ── 09032 鼓舞决心 ──────────────────────────────────────────────────────────
test('P6 09032 鼓舞决心 技能检定开始时花 1 充能：把一张非弱点手牌投入检定（图标视为[wild]）', () => {
  const state = fixture('01001')
  me(state).assets = []
  const resolve = asset(state, '09032')
  assert.equal(resolve.uses, 4, '入场 4 充能')
  me(state).hand = ['10021']
  state.skillTest = { seat: 0, skill: 'combat', difficulty: 2, value: 4, committed: [], stage: 'ST.2' }
  windowProbe(state, 'testBegins', {
    when: 'testBegins', seat: 0, location: me(state).location, skill: 'combat', difficulty: 2,
  }, pending => pickDesc(pending) ?? pickId(pending, ['10021']))
  const bottle = freshAsset(state, '09032')
  assert.equal(bottle.uses, 3, '花掉 1 充能')
  assert.equal(me(state).hand.length, 0, '手牌已投入/弃置')
  assert.ok((state.skillTest.committed || []).some(item => item.code === '10021')
    || (state.skillTest.extraCommittedIcons || 0) > 0, '该卡的图标计入了本次检定')
  delete state.skillTest
})

// ── 09033 外勤特工 ──────────────────────────────────────────────────────────
test('P6 09033 外勤特工 +1[智力]；横置并受 1 点恐惧：发现所在地点 1 个线索', () => {
  const state = fixture('01001')
  me(state).assets = []
  const agent = asset(state, '09033')
  state.locations[0].clues = 1
  me(state).clues = 0
  assert.equal(getStat(state, me(state), 'intellect'), ALL_CARDS['01001'].intellect + 1, '+1 智力')
  resolveAbility(state, '09033', { kind: 'free', assetCode: '09033' })
  const card = freshAsset(state, '09033')
  assert.equal(card.horror || 0, 1, '对支援造成 1 点恐惧')
  assert.equal(me(state).clues, 1, '发现 1 个线索')
  assert.ok(agent.id, '外勤特工实例存在')
})

// ── 09034 看门狗 ────────────────────────────────────────────────────────────
test('P6 09034 看门狗 横置与同地点敌人交战并让它攻击你；受攻击伤害后反咬 1 点', () => {
  const state = fixture('01001')
  me(state).assets = []
  const dog = asset(state, '09034')
  const foe = enemy(state, { fight: 2, evade: 2, health: 10, damage: 1, horror: 1, damageTaken: 0 })
  resolveAbility(state, '09034', {
    kind: 'free',
    choose: pending => pickDesc(pending) ?? pickId(pending, [dog.id, foe.id, 'self']),
  })
  const after = state.enemies.find(item => item.id === foe.id)
  assert.equal(after.engagedSeat, 0, '与看门狗的控制者交战')
  assert.equal(freshAsset(state, '09034').damage || 0, 1, '看门狗承受了攻击伤害')
  assert.equal(after.damageTaken, 1, '反应对攻击者造成 1 点伤害')
})

// ── 09035 手铐 ──────────────────────────────────────────────────────────────
test('P6 09035 手铐 用[combat]躲避[[类人]]敌人：成功清空其毁灭并附属，非精英不能重整', () => {
  const state = fixture('01001')
  me(state).assets = []
  const cuffs = asset(state, '09035', { exhausted: false })
  const foe = enemy(state, { code: '10011', traits: ['Humanoid', 'Criminal'], fight: 2, evade: 2, health: 10, doom: 2 })
  state.chaosBag = ['+1']
  const action = legalMoves(state).find(option => option.action === 'ability' && option.assetId === cuffs.id)
  assert.ok(action, '手铐应有行动')
  move(state, action)
  act(state, pending => pickId(pending, [foe.id]))
  assert.ok(state.lastTestResult?.success, '躲避成功')
  assert.equal(state.lastTestResult.skill, 'combat', '本次躲避使用[combat]')
  const after = state.enemies.find(item => item.id === foe.id)
  assert.ok((after.attachments || []).some(card => card.code === '09035'), '手铐附属到敌人')
  assert.equal(after.doom || 0, 0, '移除该敌人全部毁灭标记')
  assert.ok(after.preventReady, '非精英敌人不能重整（preventReady 读点）')
})

// ── 09036 最坏的打算 ────────────────────────────────────────────────────────
test('P6 09036 最坏的打算 从牌库顶 9 张找出[[武器]]支援加入手牌并混洗牌库', () => {
  const state = fixture('01001')
  me(state).hand = []
  me(state).deck = ['01088', '01088', '10120', '01088', '01088', '01088', '01088', '01088', '01088', '01088', '01088']
  resolvePlayed(state, '09036', {
    choose: pending => pickId(pending, ['hand', 'play']) ?? pending.options[0].id,
  })
  assert.ok(me(state).hand.includes('10120'), '武器支援加入手牌')
  assert.equal(me(state).deck.includes('10120'), false, '该牌已离开牌库')
  assert.equal(me(state).deck.length, 10, '牌库数量 -1')
})

// ── 09037 殉道者护臂 ────────────────────────────────────────────────────────
test('P6 09037 殉道者护臂 显现结算时 +1 技能值；把同地点队友抽到的非险境遭遇改由你结算', () => {
  const state = fixture('01001', 2)
  me(state, 0).assets = []
  asset(state, '09037')
  const base = ALL_CARDS['01001'].combat
  state._treacheryResolving = 'dissonantVoices'
  assert.equal(getStat(state, me(state), 'combat'), base + 1, '显现结算期间 +1 技能值')
  delete state._treacheryResolving
  const context = windowProbe(state, 'encounterDrawn', {
    when: 'encounterDrawn', seat: 1, location: state.locations[0].id, cardCode: 'dissonantVoices', peril: false,
  }, pending => pickDesc(pending))
  assert.equal(context.redirectSeat ?? context.redirectSeat, 0, '改为由你抽取该遭遇卡')
  assert.equal(freshAsset(state, '09037').exhausted, true, '横置殉道者护臂')
})

// ── 09038 吉里什·卡达贾 ────────────────────────────────────────────────────
test('P6 09038 吉里什·卡达贾 承接同地点他人的伤害；横置令本次检定 +2，成功治愈自身 1 点', () => {
  const state = fixture('01001', 2)
  me(state, 0).assets = []
  me(state, 1).assets = []
  const girish = asset(state, '09038')
  withApi(state, api => api.harm(1, { damage: 1 }), pending => pickId(pending, [girish.id]))
  assert.equal(freshAsset(state, '09038').damage, 1, '承接了另一名调查员的 1 点伤害')
  assert.equal(me(state, 1).damage, 0, '另一名调查员未受伤')
  state.skillTest = { seat: 0, skill: 'willpower', difficulty: 2, value: 5, committed: [], stage: 'ST.4' }
  resolveAbility(state, '09038', { kind: 'free' })
  assert.equal(state.skillTest.value, 7, '本次检定 +2 技能值')
  windowProbe(state, 'skillTestSuccess', { when: 'skillTestSuccess', seat: 0, location: me(state).location })
  assert.equal(freshAsset(state, '09038').damage, 0, '成功后治愈自身 1 点伤害')
  delete state.skillTest
})

// ── 09039 时刻警惕 ──────────────────────────────────────────────────────────
test('P6 09039 时刻警惕 依次以 -1 费用打出最多 4 张手牌支援', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).hand = ['10062', '10715']
  me(state).resources = 5
  resolvePlayed(state, '09039', {
    choose: pending => pickId(pending, ['10062', '10715']) ?? (pending.options.some(option => option.id === 'skip') ? 'skip' : null),
  })
  assert.ok(me(state).assets.some(card => card.code === '10062'), '打出了 2 费盟友（费用 -1）')
  assert.ok(me(state).assets.some(card => card.code === '10715'), '打出了 1 费书籍（费用 -1）')
  assert.equal(me(state).resources, 4, '两张各 -1：2-1 + 1-1 = 1 资源')
  assert.equal(me(state).hand.length, 0, '手牌都打出了')
})

// ── 09040 炼金蒸馏 ──────────────────────────────────────────────────────────
test('P6 09040 炼金蒸馏 花 1 补给：检定[智力](1) 成功让调查员抽 2 张；精炼入场 +2 补给', () => {
  const state = fixture('01001')
  me(state).assets = []
  const still = asset(state, '09040')
  me(state).hand = []
  me(state).deck = ['01088', '01088', '01088', '01088']
  state.chaosBag = ['+1']
  const action = legalMoves(state).find(option => option.action === 'ability' && option.assetId === still.id)
  assert.ok(action, '炼金蒸馏应有行动')
  move(state, action)
  act(state, pending => pickId(pending, ['draw', 'resources', '0']))
  assert.ok(state.lastTestResult?.success, '智力检定成功')
  assert.equal(me(state).hand.length, 2, '抽 2 张卡牌')
  assert.equal(freshAsset(state, '09040').uses, 2, '花掉 1 补给')
  // 精炼（Refined）：入场 +2 补给。
  custom(state, '09040', [4])
  const bottle = asset(state, '09040')
  resolveAbility(state, '09040', { kind: 'entersPlay', source: bottle })
  assert.equal(bottle.uses, 5, '精炼：入场 3 + 2 = 5 补给')
})

// ── 09041 实证假设 ──────────────────────────────────────────────────────────
test('P6 09041 实证假设 回合开始选判据；达成判据横置加 1 证据；花 1 证据抽 1 张', () => {
  const state = fixture('01001')
  me(state).assets = []
  const hypothesis = asset(state, '09041')
  me(state).hand = []
  me(state).deck = ['01088', '01088']
  windowProbe(state, 'roundStarts', { when: 'roundStarts' }, pending => pickId(pending, ['success', 'fail']))
  assert.equal(state.scenarioFlags?.tskEmpiricalHypothesisCriteria?.criteria, 'success', '本轮判据已记录')
  state.lastTestResult = { seat: 0, success: true, value: 6, difficulty: 2 }
  resolveAbility(state, '09041', {
    kind: 'reaction', assetCode: '09041',
    context: { when: 'skillTestSuccess', seat: 0, location: me(state).location },
  })
  assert.equal(freshAsset(state, '09041').markers?.evidence, 1, '达成判据：加 1 证据')
  withApi(state, api => api.ready(freshAsset(state, '09041')))
  resolveAbility(state, '09041', { kind: 'free', assetCode: '09041' })
  assert.equal(freshAsset(state, '09041').markers?.evidence || 0, 0, '花费 1 证据')
  assert.equal(me(state).hand.length, 1, '抽 1 张卡牌')
  assert.ok(hypothesis.id, '实证假设实例存在')
})

// ── 09042 鸦翎羽毛笔 ────────────────────────────────────────────────────────
test('P6 09042 鸦翎羽毛笔 附属到你控制的[[书籍]]支援；墨力汲取把 1 充能移给所附属支援', () => {
  const state = fixture('01001')
  me(state).assets = []
  const tome = asset(state, '10715')
  const battery = asset(state, '09040', { uses: 3, usesType: 'supplies' })
  resolvePlayed(state, '09042', { choose: pending => pickId(pending, [tome.id]) })
  const host = state.investigators[0].assets.find(card => card.code === '10715')
  assert.ok((host.attachments || []).some(card => card.code === '09042'), '鸦翎羽毛笔附属到书籍支援')
  custom(state, '09042', [4])
  const attachment = host.attachments.find(card => card.code === '09042')
  resolveAbility(state, '09042', { kind: 'free', source: attachment })
  assert.equal(state.investigators[0].assets.find(card => card.code === '10715').attachments
    .find(card => card.code === '09042').uses, undefined, '羽毛笔本身没有 uses 字段')
  assert.equal(state.investigators[0].assets.find(card => card.code === '09040').uses, 2, '从另一张支援移走 1 充能')
  assert.ok(battery.id, '充能支援实例存在')
})

// ── 09043 解剖工具 ──────────────────────────────────────────────────────────
test('P6 09043 解剖工具 同地点敌人被击败后放 1 证据；1/2 证据分别 +1[敏捷]/+1[战斗]', () => {
  const state = fixture('01001')
  me(state).assets = []
  asset(state, '09043')
  const baseAgility = ALL_CARDS['01001'].agility
  const baseCombat = ALL_CARDS['01001'].combat
  assert.equal(getStat(state, me(state), 'agility'), baseAgility, '没有证据时无加值')
  const foe = enemy(state, { fight: 1, evade: 1, health: 4 })
  resolveAbility(state, '09043', {
    kind: 'reaction', assetCode: '09043',
    context: { when: 'enemyDefeated', enemy: foe, location: me(state).location },
  })
  assert.equal(freshAsset(state, '09043').markers?.evidence, 1, '击败敌人后放 1 证据')
  assert.equal(getStat(state, me(state), 'agility'), baseAgility + 1, '1+ 证据：+1 敏捷')
  withApi(state, (api, draft) => api.addCardCounter(draft.investigators[0].assets.find(card => card.code === '09043'), 'evidence', 2))
  assert.equal(getStat(state, me(state), 'combat'), baseCombat + 1, '2+ 证据：+1 战斗')
  assert.equal(getMaxSanity(me(state)), ALL_CARDS['01001'].sanity, '3+ 证据的神智加值已在条目 note 披露（缺读点）')
})

// ── 09044 凄惨传略 ──────────────────────────────────────────────────────────
test('P6 09044 凄惨传略 花 1 秘密调查 +2[智力]；成功超过 2 点抽 1 张', () => {
  const state = fixture('01001')
  me(state).assets = []
  const memoir = asset(state, '09044')
  state.locations[0].clues = 1
  me(state).hand = []
  me(state).deck = ['01088', '01088', '01088']
  state.chaosBag = ['+1']
  const action = legalMoves(state).find(option => option.action === 'ability' && option.assetId === memoir.id)
  assert.ok(action, '凄惨传略应有调查行动')
  move(state, action)
  act(state, pending => pickId(pending, ['draw']))
  assert.ok(state.lastTestResult?.success, '调查成功')
  assert.equal(state.lastTestResult.value, ALL_CARDS['01001'].intellect + 2 + 1, '调查 +2[智力]')
  assert.equal(freshAsset(state, '09044').uses, 3, '花掉 1 秘密')
  assert.equal(me(state).hand.length, 1, '成功超过 2 点：抽 1 张')
})

// ── 09045 研究笔记 ──────────────────────────────────────────────────────────
test('P6 09045 研究笔记 检定[智力](0)：成功每超出 1 点可花 1 证据发现 1 个线索', () => {
  const state = fixture('01001')
  me(state).assets = []
  const notes = asset(state, '09045')
  state.locations[0].clues = 4
  me(state).clues = 0
  withApi(state, (api, draft) => api.addCardCounter(draft.investigators[0].assets.find(card => card.code === '09045'), 'evidence', 2))
  state.chaosBag = ['+1']
  const action = legalMoves(state).find(option => option.action === 'ability' && option.assetId === notes.id)
  assert.ok(action, '研究笔记应有行动')
  move(state, action)
  act(state, pending => pickId(pending, ['spend']))
  assert.equal(me(state).clues, 2, '花 2 证据发现 2 个线索')
  assert.equal(freshAsset(state, '09045').markers?.evidence || 0, 0, '证据已花完')
})

// ── 09046 诡异诊断 ──────────────────────────────────────────────────────────
test('P6 09046 诡异诊断 把 1 个线索放到所在地点，然后治愈同地点调查员 3 点伤害', () => {
  const state = fixture('01001')
  me(state).assets = []
  me(state).clues = 1
  me(state).damage = 2
  state.locations[0].clues = 0
  resolvePlayed(state, '09046', { choose: pending => pickId(pending, ['self']) })
  assert.equal(me(state).clues, 0, '你的线索 -1')
  assert.equal(state.locations[0].clues, 1, '地点线索 +1')
  assert.equal(me(state).damage, 0, '治愈 3 点伤害（实际 2 点）')
})

// ── 09047 震撼发现 ──────────────────────────────────────────────────────────
test('P6 09047 震撼发现 查找牌库顶 6 张：放 1 个线索从查找牌里取 2 张入手并混洗', () => {
  const state = fixture('01001')
  me(state).clues = 1
  me(state).hand = []
  state.locations[0].clues = 0
  me(state).deck = ['01088', '01088', '01088', '01088', '01088', '10021', '10034', '01088', '01088', '01088']
  const before = me(state).deck.length
  resolvePlayed(state, '09047', {
    choose: pending => pickId(pending, ['place', '10021', '10034', '01088']) ?? (pending.options.some(o => o.id === 'stop') ? 'stop' : null),
  })
  assert.equal(me(state).clues, 0, '放置了 1 个线索')
  assert.equal(state.locations[0].clues, 1, '线索放到所在地点')
  assert.equal(me(state).hand.length, 2, '从查找的牌里取 2 张加入手牌')
  assert.equal(me(state).deck.length, before - 2, '牌库减少 2 张')
  for (const code of me(state).hand) assert.ok(['10021', '10034', '01088'].includes(code), '取到的都是查找区里的牌')
})
