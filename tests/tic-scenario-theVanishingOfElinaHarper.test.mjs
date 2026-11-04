// P7 艾莲娜·哈珀失踪案（theVanishingOfElinaHarper）逐章验收测试。
//
// 审计契约（tools/audit-tic-scenarios.mjs#chapterTestFor / CHECK_TITLE_MARKERS）：
//   · 必须在 tests/suites.mjs 登记，并显式引用本章：chapterFixture('theVanishingOfElinaHarper')；
//   · 工具 `node --test --test-reporter=tap` 实跑，文件全绿才算通过；
//   · 每个行为检查需要至少一条通过用例标题命中关键词（setup/幕/地点/遭遇/混乱/结局/存档…）。
//
// 本章重点：07060 指控流程（0/1/2 正确 → 撤退/转场/转场+暴民）、07061 营救（六结局映射）、
// 轮末可选推进、团队线索谈判、关键 chaos token 与 JSON 往返。内容层流程（entry-rules.js 的
// events/roundEnded）已由 w6 接线，本测试不再 patch content，直接走真实链路。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'

import { chapterFixture } from './tic-chapter-fixture.mjs'
import { enemy, move, settle } from './core-fixture.mjs'
import { advanceAct, enemyHealth, legalMoves, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { entityModifierTotal, entityRuleActive } from '../src/engine/modifiers.js'
import { enemyIsAloof } from '../src/engine/enemy-aloof.js'
import { contentRegistry } from '../content/registered.js'
import { SUSPECTS, HIDEOUTS, hideoutRole, suspectRole } from '../src/cards/encounter-entries/_shared.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const SCENARIO_ID = 'theVanishingOfElinaHarper'
const RESCUE_MAP = {
  '07078': 'resolution2', // Brian Burnham
  '07081': 'resolution3', // Othera Gilman
  '07080': 'resolution4', // Joyce Little
  '07079': 'resolution5', // Barnabas Marsh
  '07077': 'resolution6', // Zadok Allen
  '07076': 'resolution7', // Robert Friendly
}

// 本章 29 张单卡条目真实注册（chapterFixture 只注册章节定义/开局事务，不注册单卡能力层）。
const chapterDir = new URL('../src/cards/encounter-entries/theInnsmouthConspiracy/theVanishingOfElinaHarper/', import.meta.url)
for (const name of readdirSync(chapterDir)) {
  if (!name.endsWith('.js')) continue
  const entry = (await import(new URL(name, chapterDir))).default
  if (!registeredEntry(entry.code)) registerCardAbilities(entry)
}

const codeOf = card => card?.originalCode || card?.code || (typeof card === 'string' ? card : '')
// 印刷定义（state.scenario.locations 是 id→定义 的对象，含未入场的藏身处）
const definitionByCode = (state, code) => Object.values(state.scenario.locations || {}).find(item => codeOf(item) === code)
// 当前在场的地点实例
const inPlayByCode = (state, code) => (state.locations || []).find(item => codeOf(item) === code)

// 真实事务推进：execute 里调引擎 API；ScenarioEnded 是正常结束关卡，继续把待决选择清空。
function transaction(state, execute, select = () => null) {
  const executeOnce = draft => {
    try { return execute(draft) } catch (error) {
      if (error.constructor?.name !== 'ScenarioEnded') throw error
    }
  }
  resolveTransaction(state, 0, { action: 'testTicHarperChapter' }, executeOnce)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 150, `TIC 哈珀 choice loop: ${state.pendingChoice?.prompt}`)
    const choice = state.pendingChoice
    const optionId = select(choice, state)
      ?? ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, executeOnce)
  }
}

// 开局夹具 + 私有答案牌堆里真实嫌疑/窝点（chapter-setup.js 固定 [真嫌犯, 真窝点]）。
function harper(count = 2, options = {}) {
  const state = chapterFixture(SCENARIO_ID, count, options)
  const answers = state.scenarioFlags.mechanics.scenarioDecks.harperAnswers.deck.map(codeOf)
  return { state, trueSuspect: answers[0], trueHideout: answers[1] }
}

// 指控选择器：correct=0/1/2 控制嫌疑人/窝点两次指认各选真答案还是错误答案。
function chooserFor(trueSuspect, trueHideout, correct) {
  return choice => {
    const codes = choice.options.filter(option => option.cardCode).map(option => String(option.id))
    if (choice.prompt?.includes('绑架犯')) {
      return correct >= 1 ? (codes.includes(trueSuspect) ? trueSuspect : codes[0])
        : (codes.find(code => code !== trueSuspect) ?? codes[0])
    }
    if (choice.prompt?.includes('关在哪里')) {
      return correct === 2 ? (codes.includes(trueHideout) ? trueHideout : codes[0])
        : (codes.find(code => code !== trueHideout) ?? codes[0])
    }
    return null
  }
}

const entityParley = state => legalMoves(state, 0).find(command =>
  command.action === 'entityAbility' && command.entityId === state.acts[state.actIndex].id
  && command.actionKind === 'parley')

test('P7 哈珀 setup 初始设置与区域守恒：07062a 剧情资产/私有迹象牌堆/7 地点/幕 07060 议程 07057', () => {
  const { state: s, trueSuspect, trueHideout } = harper(2)
  assert.equal(s.scenario.id, SCENARIO_ID)
  assert.deepEqual(s.acts.map(codeOf), ['07060'])
  assert.deepEqual(s.agendas.map(agenda => codeOf(agenda)), ['07057', '07058'])
  assert.equal(s.actIndex, 0)
  assert.equal(s.agendaIndex, 0)
  assert.equal(String(s.agendas[0].stage), '1a')
  // 开局地点：7 个印刷地点入场（07063–07069），起始地点印斯茅斯广场 07065 已揭示
  const inPlay = s.locations.map(location => codeOf(location)).sort()
  assert.deepEqual(inPlay, ['07063', '07064', '07065', '07066', '07067', '07068', '07069'])
  assert.equal(codeOf(s.locations.find(location => location.id === s.investigators[0].location)), '07065')
  assert.equal(s.locations.filter(location => location.revealed).length, 1)
  // 13 个印刷地点（含 6 个隐藏窝点 07070–07075）全部登记身份
  const definitions = Object.values(s.scenario.locations)
  assert.equal(definitions.length, 13)
  assert.ok(definitions.every(location => location.identityStatus === 'mapped'))
  // 嫌疑敌人身份表：6 张真人嫌疑都在本章敌人定义里
  for (const code of Object.keys(SUSPECTS)) assert.ok(s.scenario.enemies[code], `嫌疑 ${code} 应在本章敌人定义里`)
  // 隐藏窝点定义存在（尚未入场）
  for (const code of Object.keys(HIDEOUTS)) assert.ok(definitionByCode(s, code), `窝点 ${code} 应有地点定义`)
  // 剧情参考卡 07062a：全局剧情资产，关联 07062b 愤怒暴民
  const storyAsset = s.storyAssets.find(asset => codeOf(asset) === '07062a')
  assert.ok(storyAsset, '07062a 应在场（全局剧情资产）')
  assert.equal(codeOf(storyAsset), '07062a')
  assert.equal(storyAsset.linkedOriginalCode, '07062b')
  // 私有牌堆：harperAnswers（真嫌疑+真窝点）+ leads（其余 10 张）；答案顺序固定
  const decks = s.scenarioFlags.mechanics.scenarioDecks
  assert.deepEqual(Object.keys(decks).sort(), ['harperAnswers', 'leads'])
  assert.equal(decks.harperAnswers.deck.length, 2)
  assert.equal(decks.leads.deck.length, 10)
  assert.ok(Object.keys(SUSPECTS).includes(trueSuspect), '真嫌犯应在身份表')
  assert.ok(Object.keys(HIDEOUTS).includes(trueHideout), '真窝点应在身份表')
  // 牌库/旁置区守恒：25 张遭遇牌库；07082/07083 旁置；crossedOff 为空
  assert.equal(s.encounterDeck.length, 25)
  assert.ok(s.scenarioZones.setAside.includes('07082') && s.scenarioZones.setAside.includes('07083'))
  assert.deepEqual(s.scenarioFlags.crossedOff, [])
  // 开场剧情：真实 introduction 返回冒险标题 + intro1 + townInfo + intro2
  const intro = contentRegistry.getBehavior(SCENARIO_ID).introduction(s.scenario, s.campaign.records)
  assert.ok(intro.sections.length >= 2)
  assert.ok(intro.sections.every(section => section.paragraphs.length > 0))
})

test('P7 哈珀 地点与连接：城镇地点入场、连接图与隐藏窝点定义', () => {
  const { state: s } = harper(2)
  // 所有入场地点都有真实连接（双向印刷连线）
  for (const location of s.locations) {
    assert.ok(Array.isArray(location.connections) && location.connections.length > 0, `${codeOf(location)} 应有连接`)
  }
  const start = s.locations.find(location => location.id === s.investigators[0].location)
  assert.equal(codeOf(start), '07065')
  assert.deepEqual([...start.connections].sort(), ['location07063', 'location07064', 'location07067', 'location07068'])
  // 未入场的窝点地点保持在场外；连接初始化不泄漏隐藏窝点
  const inPlay = new Set(s.locations.map(location => codeOf(location)))
  for (const code of Object.keys(HIDEOUTS)) assert.equal(inPlay.has(code), false, `窝点 ${code} 开局不在场`)
  // 起始地点线索与印刷值一致（至少 1 个，且按调查员数放置）
  assert.ok(start.clues >= 1)
})

test('P7 哈珀 幕 07060 团队线索谈判：花费 X[每调查员]、揭示抽取 1 张、其余洗回、团队每轮一次', () => {
  const { state: s } = harper(2)
  assert.equal(entityParley(s), undefined, '团队线索不足时不应出现谈判按钮')
  s.investigators[0].clues = 3
  s.investigators[1].clues = 3
  s.clues = 6
  const leadsBefore = [...s.scenarioFlags.mechanics.scenarioDecks.leads.deck]
  const topTwo = leadsBefore.slice(-2).reverse() // 牌堆顶 = 数组末位
  const command = entityParley(s)
  assert.ok(command, '团队线索充足时应出现 [fast] 谈判入口')
  move(s, command)
  settle(s, choice => (choice.kind === 'effect' ? '2' : null))
  assert.equal(s.clues, 2, 'X=2 × 2 人 = 4 个团队线索')
  assert.deepEqual(s.investigators.map(inv => inv.clues), [1, 1], '线索由两位调查员分摊')
  assert.deepEqual(s.scenarioFlags.harperDrawnLeads, [topTwo[0]], '抽取牌堆顶 1 张并记账')
  const deck = s.scenarioFlags.mechanics.scenarioDecks.leads.deck
  assert.equal(deck.includes(topTwo[0]), false, '抽到的迹象离开迹象牌堆')
  assert.equal(deck.length, leadsBefore.length, '其余 1 张 + 遭遇牌库顶 1 张洗回：数量守恒')
  for (const code of topTwo) assert.ok(s.scenarioFlags.crossedOff.includes(code), `揭示的 ${code} 应被划掉`)
  assert.equal(entityParley(s), undefined, '团队每轮仅限一次')
})

test('P7 哈珀 幕 07060 轮末可选推进：skip 不推进 / advance 进入指控并转入 07061', () => {
  const behavior = contentRegistry.getBehavior(SCENARIO_ID)
  const roundEnded = draft => behavior.roundEnded?.(draft, scenarioRuntime(draft, []))
  const skipped = harper(1)
  transaction(skipped.state, roundEnded, () => 'skip')
  assert.equal(codeOf(skipped.state.acts[skipped.state.actIndex]), '07060', '选择暂不推进时幕不动')
  assert.equal(skipped.state.actIndex, 0)
  const advanced = harper(1)
  transaction(advanced.state, roundEnded, (choice) => {
    if (choice.prompt?.includes('是否发起指控')) return 'advance'
    return chooserFor(advanced.trueSuspect, advanced.trueHideout, 2)(choice)
  })
  assert.equal(codeOf(advanced.state.acts[advanced.state.actIndex]), '07061', '选择推进 → 真实指控 → 营救幕')
  assert.equal(codeOf(advanced.state.agendas[advanced.state.agendaIndex]), '07059')
})

test('P7 哈珀 幕 07060 指控 2 正确：转营救幕/议程、藏身处+07083 在下方+绑架犯、保留 07062a', () => {
  const { state: s, trueSuspect, trueHideout } = harper(2)
  transaction(s, draft => advanceAct(draft, []), chooserFor(trueSuspect, trueHideout, 2))
  // 转场：当前幕 07061、当前议程 07059、场上毁灭清空
  assert.deepEqual(s.acts.map(codeOf), ['07060', '07061'])
  assert.equal(s.actIndex, 1)
  assert.deepEqual(s.agendas.map(codeOf), ['07057', '07059'])
  assert.equal(s.agendaIndex, 1)
  assert.equal(s.doom, 0)
  // 真实答案写进战役记录（角色名，供深陷其中/达贡巢穴用）
  assert.equal(s.campaign.records.harperSuspect, suspectRole(trueSuspect))
  assert.equal(s.campaign.records.harperHideout, hideoutRole(trueHideout))
  // 藏身处真实入场：印刷线索/人 + 指控 1/人；07083 压在 location.beneath；绑架犯生成于此
  const hideout = inPlayByCode(s, trueHideout)
  assert.ok(hideout, '藏身处地点应真实入场')
  assert.equal(hideout.revealed, true)
  const definition = definitionByCode(s, trueHideout)
  // 定义中的印刷线索值：cluesPerInvestigator（本地点表 1/人）或固定 clues
  const printedClues = Number(definition.cluesPerInvestigator ?? definition.cluesFixed ?? definition.clues ?? 0)
  assert.equal(hideout.clues, printedClues * s.numInvestigators + s.numInvestigators)
  assert.ok((hideout.beneath || []).includes('07083'), '07083 艾莲娜·哈珀压在藏身处下方')
  const kidnapper = s.enemies.find(entity => codeOf(entity) === trueSuspect)
  assert.ok(kidnapper, '绑架犯应在场')
  assert.equal(kidnapper.location, hideout.id)
  // 2 正确不翻愤怒暴民，剧情参考卡 07062a 保留
  assert.equal(s.enemies.some(entity => codeOf(entity) === '07062b'), false)
  assert.ok(s.storyAssets.some(asset => codeOf(asset) === '07062a'))
})

test('P7 哈珀 幕 07060 指控 1 正确：愤怒暴民 07062b 见于印斯茅斯广场、07062a 离场、仍转入 07061', () => {
  const { state: s, trueSuspect, trueHideout } = harper(2)
  transaction(s, draft => advanceAct(draft, []), chooserFor(trueSuspect, trueHideout, 1))
  const square = s.locations.find(location => codeOf(location) === '07065')
  const mob = s.enemies.find(entity => codeOf(entity) === '07062b')
  assert.ok(square, '印斯茅斯广场应在场')
  assert.ok(mob, '1 正确应生成愤怒暴民 07062b')
  assert.equal(mob.location, square.id)
  assert.equal(s.storyAssets.some(asset => codeOf(asset) === '07062a'), false, '剧情参考卡 07062a 离场')
  assert.equal(codeOf(s.acts[s.actIndex]), '07061')
  assert.ok(s.enemies.some(entity => codeOf(entity) === trueSuspect), '绑架犯仍生成在藏身处')
})

test('P7 哈珀 幕 07060 指控 0 正确：全员撤退 → resolution1/TheMissionFailed 记录、不转场', () => {
  const { state: s, trueSuspect, trueHideout } = harper(2)
  transaction(s, draft => advanceAct(draft, []), chooserFor(trueSuspect, trueHideout, 0))
  assert.ok(s.investigators.every(inv => inv.resigned), '指控失误：全员撤退')
  assert.equal(s.campaign.records.TheMissionFailed, true, '失败记录写入')
  assert.equal(s.campaign.scenarioResults.length, 1)
  assert.equal(s.campaign.pendingNode, 'interlude2')
  assert.ok(['noResolution', 'resolution1'].includes(s.resolution), '结局按 noResolution→resolution1 重定向')
  assert.equal(codeOf(s.acts[s.actIndex]), '07060', '0 正确不转营救幕')
  assert.equal(inPlayByCode(s, trueHideout), undefined, '0 正确不布置藏身处')
})

test('P7 哈珀 幕 07061 修正：绑架犯失去冷漠/不能谈判/+1×人数生命，其他嫌疑敌人不受影响', () => {
  const { state: s, trueSuspect, trueHideout } = harper(2)
  transaction(s, draft => advanceAct(draft, []), chooserFor(trueSuspect, trueHideout, 2))
  const kidnapper = s.enemies.find(entity => codeOf(entity) === trueSuspect)
  assert.ok(kidnapper)
  const other = enemy(s, { code: '07076', originalCode: '07076', aloof: true, location: kidnapper.location })
  assert.equal(entityRuleActive(s, kidnapper, 'loses:aloof'), true)
  assert.equal(entityRuleActive(s, kidnapper, 'cannot:parley'), true)
  assert.equal(entityModifierTotal(s, kidnapper, 'enemyHealth'), s.numInvestigators, '+1[每调查员]生命')
  assert.equal(enemyHealth(s, kidnapper), ALL_CARDS[trueSuspect].health + s.numInvestigators)
  assert.equal(enemyIsAloof(s, kidnapper), false, '失去冷漠：自动交战/攻击读点')
  // 非绑架犯的其他嫌疑敌人不受修正
  assert.equal(entityRuleActive(s, other, 'loses:aloof'), false)
  assert.equal(entityModifierTotal(s, other, 'enemyHealth'), 0)
  assert.equal(enemyIsAloof(s, other), true, '其他嫌疑敌人仍然是冷漠的')
})

test('P7 哈珀 幕 07061 目标：1 人局 OR / ≥2 人局 AND（绑架犯在胜利区 + 藏身处无线索）', () => {
  const rescueObjective = state => registeredEntry('07061').actRule.objective(state, state.acts[state.actIndex])
  const hideoutStage = state => {
    const stage = structuredClone(state.scenario.stageCards['07061'])
    state.acts = [stage]
    state.actIndex = 0
    return stage
  }
  // 1 人局：任一条件成立即推进
  const solo = chapterFixture(SCENARIO_ID, 1)
  hideoutStage(solo)
  const soloHideout = definitionByCode(solo, '07070')
  solo.locations.push({ ...structuredClone(soloHideout), id: 'probeHideout', code: '07070', originalCode: '07070',
    revealed: true, clues: 0, beneath: ['07083'], connections: [] })
  solo.numInvestigators = 1
  assert.equal(rescueObjective(solo), true, '1 人：藏身处无线索 → 推进')
  const soloClues = chapterFixture(SCENARIO_ID, 1)
  hideoutStage(soloClues)
  soloClues.locations.push({ ...structuredClone(definitionByCode(soloClues, '07070')), id: 'probeHideout2',
    code: '07070', originalCode: '07070', revealed: true, clues: 2, beneath: ['07083'], connections: [] })
  soloClues.numInvestigators = 1
  assert.equal(rescueObjective(soloClues), false, '1 人：藏身处有线索且绑架犯不在胜利区 → 不推进')
  soloClues.campaign.records.harperSuspect = suspectRole('07078')
  soloClues.victoryDisplay.push({ code: '07078', originalCode: '07078', victory: 0 })
  assert.equal(rescueObjective(soloClues), true, '1 人：绑架犯在胜利区 → 推进')
  // ≥2 人局：两项都必须满足
  const duo = chapterFixture(SCENARIO_ID, 2)
  hideoutStage(duo)
  duo.locations.push({ ...structuredClone(definitionByCode(duo, '07070')), id: 'probeHideout3', code: '07070',
    originalCode: '07070', revealed: true, clues: 0, beneath: ['07083'], connections: [] })
  assert.equal(rescueObjective(duo), false, '2 人：只有藏身处无线索不够')
  duo.campaign.records.harperSuspect = suspectRole('07078')
  duo.victoryDisplay.push({ code: '07078', originalCode: '07078', victory: 0 })
  assert.equal(rescueObjective(duo), true, '2 人：两条件都满足才推进')
  duo.locations.find(location => location.id === 'probeHideout3').clues = 2
  assert.equal(rescueObjective(duo), false, '2 人：只有绑架犯在胜利区不够')
})

test('P7 哈珀 幕 07061 营救结局：六种绑架犯 → resolution2–7 + TheMissionWasSuccessful 记录', () => {
  for (const [kidnapper, expected] of Object.entries(RESCUE_MAP)) {
    const state = chapterFixture(SCENARIO_ID, 2, { records: { harperSuspect: suspectRole(kidnapper) } })
    const stage = structuredClone(state.scenario.stageCards['07061'])
    state.acts = [stage]
    state.actIndex = 0
    state.victoryDisplay.push({ code: kidnapper, originalCode: kidnapper, victory: 0 })
    state.locations.push({ ...structuredClone(definitionByCode(state, '07074')), id: 'probeHideout',
      code: '07074', originalCode: '07074', revealed: true, clues: 0, beneath: ['07083'], connections: [] })
    transaction(state, draft => advanceAct(draft, []))
    assert.equal(state.resolution, expected, `${kidnapper} 应进入 ${expected}`)
    assert.equal(state.campaign.records.TheMissionWasSuccessful, true)
    assert.equal(state.campaign.scenarioResults.length, 1)
    assert.equal(state.campaign.pendingNode, 'interlude2')
  }
})

test('P7 哈珀 议程 07059 狂热追击：推进 → resolution1/TheMissionFailed 结算并交接到 interlude2', () => {
  const { state: s, trueSuspect, trueHideout } = harper(2)
  transaction(s, draft => advanceAct(draft, []), chooserFor(trueSuspect, trueHideout, 2))
  assert.equal(codeOf(s.agendas[s.agendaIndex]), '07059')
  transaction(s, draft => scenarioRuntime(draft, []).advanceAgenda())
  assert.equal(s.resolution, 'resolution1', '狂热追击推进 = 营救失败结局 R1')
  assert.equal(s.campaign.records.TheMissionFailed, true)
  assert.equal(s.campaign.scenarioResults.length, 1)
  assert.equal(s.campaign.pendingNode, 'interlude2')
})

test('P7 哈珀 chaos token 07056 提示卡：skull 按议程阶段、easy 失败符号效果（cultist 毁灭/tablet 恐惧/elderthing 线索）', () => {
  // skull = -(议程阶段数字 + hard)：开局议程 1a，easy -1 / hard -2
  for (const [difficulty, expected] of [['easy', 19], ['hard', 18]]) {
    const s = chapterFixture(SCENARIO_ID, 1)
    s.difficulty = difficulty
    s.investigators[0].willpower = 20
    s.chaosBag = ['skull']
    transaction(s, draft => scenarioRuntime(draft, []).test(0, 'willpower', 0, () => {}))
    assert.equal(s.lastTestResult.value, expected, `${difficulty} skull 值`)
  }
  // easy/standard 失败：cultist → 最近敌人 +1 毁灭
  {
    const s = chapterFixture(SCENARIO_ID, 1)
    s.chaosBag = ['cultist']
    enemy(s, { code: '07076', originalCode: '07076', location: s.investigators[0].location, engagedSeat: 0, health: 99 })
    transaction(s, draft => scenarioRuntime(draft, []).test(0, 'willpower', 99, () => {}))
    assert.ok(s.enemies.some(entity => entity.doom === 1), 'cultist 失败 → 最近敌人放 1 毁灭')
  }
  // easy/standard 失败：tablet → 1 恐惧
  {
    const s = chapterFixture(SCENARIO_ID, 1)
    s.chaosBag = ['tablet']
    transaction(s, draft => scenarioRuntime(draft, []).test(0, 'willpower', 99, () => {}))
    assert.equal(s.investigators[0].horror, 1)
  }
  // easy/standard 失败：elderthing → 1 个线索放到当前地点（调查员线索 -1）
  {
    const s = chapterFixture(SCENARIO_ID, 1)
    s.chaosBag = ['elderthing']
    s.investigators[0].clues = 2
    transaction(s, draft => scenarioRuntime(draft, []).test(0, 'willpower', 99, () => {}))
    assert.equal(s.investigators[0].clues, 1, 'elderthing 失败把 1 个线索放到地点')
  }
})

test('P7 哈珀 JSON 保存/恢复：合法动作一致，恢复后继续推进 07061 得到真实营救结局', () => {
  const { state: s, trueSuspect, trueHideout } = harper(2)
  transaction(s, draft => advanceAct(draft, []), chooserFor(trueSuspect, trueHideout, 2))
  const actionSignature = state => legalMoves(state, 0)
    .map(command => `${command.action}:${command.entityId ?? command.locationId ?? ''}:${command.abilityIndex ?? ''}`).sort()
  const saved = JSON.parse(JSON.stringify(s))
  assert.deepEqual(actionSignature(saved), actionSignature(s), '保存/恢复后合法动作集合一致')
  assert.equal(codeOf(saved.acts[saved.actIndex]), '07061')
  assert.equal(codeOf(saved.agendas[saved.agendaIndex]), '07059')
  const savedHideout = inPlayByCode(saved, trueHideout)
  assert.ok(savedHideout && (savedHideout.beneath || []).includes('07083'))
  assert.ok(saved.enemies.some(entity => codeOf(entity) === trueSuspect), '恢复后绑架犯仍在场')
  // 存档恢复后继续：满足 07061 目标（2 人局两条件）→ 推进 → 对应绑架犯结局
  saved.victoryDisplay.push({ code: trueSuspect, originalCode: trueSuspect, victory: 0 })
  savedHideout.clues = 0
  transaction(saved, draft => advanceAct(draft, []))
  assert.equal(saved.resolution, RESCUE_MAP[trueSuspect], '恢复后可继续推进到真实营救结局')
  assert.equal(saved.campaign.records.TheMissionWasSuccessful, true)
})
