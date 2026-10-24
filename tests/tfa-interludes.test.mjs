import test from 'node:test'
import assert from 'node:assert/strict'
import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { manifest } from '../content/campaigns/theForgottenAge/manifest.js'
import { TFA_STORY_TEXT } from '../content/campaigns/theForgottenAge/story-text.js'
import { createGameState, applyMove, consumeMulliganBlock, consumeStartingAdjustments } from '../src/engine/engine.js'
import { applyCampaignEffect } from '../src/campaign/campaign-effects.js'
import { campaignStory } from '../src/campaign/story.js'
import { ChoicePause } from '../src/engine/resolution.js'

// 幕间（剧情与幕间机制）验收：五个幕间与补给点的检查、记录写入、创伤与补给消耗。
// 与 tfa-launch-supplies 一样走真实引擎状态与真实效果分发器，不给行为注入桩。
const sectionText = (interlude, key) => TFA_STORY_TEXT.interludes[interlude].sections[key].join('\n\n')
const effects = name => manifest.flow.nodes[name].effects
const effect = (name, type) => effects(name).find(item => item.type === type)

/** 大厅开局 → 序幕 → 进入《荒莽密林》，返回真实引擎状态。 */
function launch(purchases = ['provisions', 'provisions']) {
  const state = createGameState({ campaignId: manifest.id, campaignHub: true, seed: 'tfa-interludes' }, [{ seat: 0, role: 'human' }])
  const step = move => applyMove(state, 0, move)
  step({ action: 'hubGoSetup' })
  step({ action: 'hubSelectInvestigator', code: '04001' })
  step({ action: 'hubAutoDeck' })
  step({ action: 'hubDoneSeat' })
  step({ action: 'hubBeginScenario' })
  const bought = [...purchases]
  for (let guard = 0; state.pendingChoice && guard < 200; guard++) {
    const pending = state.pendingChoice
    const wanted = pending.kind === 'pickSupplies' ? bought.shift() : null
    const optionId = wanted && pending.options.some(option => option.id === wanted) ? wanted : pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
  return state
}

/** 与 resolveTransaction 相同的重放模型执行一个幕间效果。 */
function runEffect(base, item, pick = choice => choice.options[0].id) {
  const answers = []
  for (let guard = 0; guard < 96; guard++) {
    const state = structuredClone(base)
    state._resolution = { id: 'tfa-interlude-test', answers, cursor: 0, events: [] }
    try {
      applyCampaignEffect(state, item, text => state.log.push(text))
      return state
    } catch (error) {
      if (!(error instanceof ChoicePause)) throw error
      const choice = error.choice
      answers.push({ choiceId: choice.id, kind: choice.kind, source: choice.source, seat: choice.seat,
        optionId: pick(choice, answers.length) })
    }
  }
  throw new Error('选择循环超过安全上限')
}

const withInterludeNode = (state, nodeId) => {
  state.campaign.flow = { ...(state.campaign.flow || {}), nodeId, history: [], visits: {} }
  return state
}
const inLog = (state, needle) => state.log.some(line => line.includes(needle))
const suppliesOf = (state, seat = 0) => state.campaign.supplies?.[seat] || []

test('幕间一：没有毛毯要选择 1 点创伤，有毛毯则安稳入睡', () => {
  const base = launch(['blanket'])
  const slept = runEffect(base, effect('interludeOne', 'sleepCheck'))
  assert.ok(inLog(slept, '安稳入睡'))
  assert.equal(slept.campaign.trauma[0].physical + slept.campaign.trauma[0].mental, 0)

  const cold = runEffect(launch([]), effect('interludeOne', 'sleepCheck'),
    choice => (choice.options.find(option => option.id === 'mental') || choice.options[0]).id)
  assert.ok(inLog(cold, '辗转反侧'))
  assert.equal(cold.campaign.trauma[0].mental, 1)
})

test('幕间一：放哨者带双筒望远镜得到 2 XP，否则得到 1 点精神创伤', () => {
  const watching = runEffect(launch(['binoculars']), effect('interludeOne', 'lookoutCheck'))
  assert.ok(inLog(watching, '树林中的身影'))
  assert.equal(watching.campaign.investigators[0].xp, 2)
  assert.ok(inLog(watching, '额外获得 2 XP'))

  const blind = runEffect(launch(['provisions']), effect('interludeOne', 'lookoutCheck'))
  assert.ok(inLog(blind, '黑暗中的眼睛'))
  assert.equal(blind.campaign.trauma[0].mental, 1)
})

test('幕间一：配给不足由队长指定调查员，下一场起始资源 -3', () => {
  const short = runEffect(launch([]), effect('interludeOne', 'crossOffSupply'))
  assert.deepEqual(suppliesOf(short), [])
  assert.ok(inLog(short, '配给不足'))
  assert.deepEqual(short.campaign.startingAdjustments[0], { resources: -3, clues: 0 })
})

test('幕间一：药品划掉后移除中毒弱点，仍在中毒者受 1 点肉体创伤', () => {
  const base = launch(['medicine'])
  base.campaign.investigators[0].deck.push('04102')
  const cured = runEffect(base, effect('interludeOne', 'curePoisonedWithMedicine'),
    choice => (choice.options.find(option => option.id === '0') || choice.options[0]).id)
  assert.deepEqual(suppliesOf(cured), [])
  assert.equal(cured.campaign.investigators[0].deck.includes('04102'), false)

  const kept = runEffect(base, effect('interludeOne', 'curePoisonedWithMedicine'), () => 'skip')
  assert.equal(kept.campaign.investigators[0].deck.includes('04102'), true)
  assert.ok(inLog(kept, '毒性扩散'))
  assert.equal(kept.campaign.trauma[0].physical, 1)
})

test('幕间二：只有取回遗物才二选一，选亚历山卓写两条记录并加石板标记', () => {
  const missing = runEffect(launch(), effect('interludeTwo', 'relicCustody'))
  assert.ok(inLog(missing, '哈伦·恩斯通走进了你的起居室'))
  assert.equal(missing.campaign.records.theInvestigatorsGaveCustodyOfTheRelicToAlejandro, false)

  const base = launch()
  base.campaign.records.theInvestigatorsRecoveredTheRelicOfAges = true
  const alejandro = runEffect(base, effect('interludeTwo', 'relicCustody'),
    choice => (choice.options.find(option => option.id === 'alejandro') || choice.options[0]).id)
  assert.equal(alejandro.campaign.records.theInvestigatorsGaveCustodyOfTheRelicToAlejandro, true)
  assert.equal(alejandro.campaign.records.theInvestigatorsHaveEarnedAlejandrosTrust, true)
  assert.equal(alejandro.campaign.chaosBag.filter(face => face === 'tablet').length, 1, '交给亚历山卓加入 1 个石板')
  assert.equal(alejandro.campaign.investigators[0].deck.includes('04051'), true)
  assert.ok(inLog(alejandro, '它属于博物馆') || inLog(alejandro, '1925年7月19日'))

  const harlan = runEffect(base, effect('interludeTwo', 'relicCustody'),
    choice => (choice.options.find(option => option.id === 'harlan') || choice.options[0]).id)
  assert.equal(harlan.campaign.records.theInvestigatorsGaveCustodyOfTheRelicToHarlanEarnstone, true)
  assert.equal(harlan.campaign.records.alejandroIsContinuingHisResearchOnHisOwn, true)
  assert.equal(harlan.campaign.chaosBag.filter(face => face === 'tablet').length, 0, '交给哈伦不加石板')
})

test('补给点：3 XP 移除中毒、5 XP 移除 1 点创伤', () => {
  const base = launch()
  base.campaign.investigators[0].deck.push('04102')
  base.campaign.investigators[0].xp = 8
  base.campaign.trauma[0].mental = 1
  const paid = runEffect(base, effect('resupplyPoint', 'resupplyServices'), choice => {
    if (choice.kind === 'resupplyPoison') return 'cure'
    if (choice.kind === 'resupplyTrauma') return 'mental'
    return choice.options[0].id
  })
  assert.equal(paid.campaign.investigators[0].deck.includes('04102'), false)
  assert.equal(paid.campaign.investigators[0].xp, 0)
  assert.equal(paid.campaign.trauma[0].mental, 0)
  assert.ok(inLog(paid, '移除了中毒弱点'))
})

test('幕间三：没有汽油时下一场不能换手牌，有汽油则划掉 1 个', () => {
  const dry = runEffect(launch(), effect('interludeThree', 'crossOffSupply'))
  assert.ok(inLog(dry, '燃料耗尽'))
  assert.equal(dry.campaign.ruleFlags.cannotMulliganOnce, true)

  const fuelled = launch([])
  fuelled.campaign.supplies[0].push('gasoline')
  const crossed = runEffect(fuelled, effect('interludeThree', 'crossOffSupply'))
  assert.deepEqual(suppliesOf(crossed), [])
  assert.equal(crossed.campaign.ruleFlags?.cannotMulliganOnce, undefined)
})

test('幕间三：地图写「摸清前进的道路」，水壶给下一场 +1 起始线索', () => {
  const map = runEffect(launch(['map']), effect('interludeThree', 'supplyCheck'))
  assert.equal(map.campaign.records.theInvestigatorsMappedOutTheWayForward, true)
  assert.ok(inLog(map, '发现道路'))

  const canteen = runEffect(launch(['canteen']), effects('interludeThree').filter(item => item.type === 'supplyCheck')[1])
  assert.ok(inLog(canteen, '石壁上的图案'))
  assert.equal(canteen.campaign.startingAdjustments[0].clues, 1)

  const none = runEffect(launch(), effects('interludeThree').filter(item => item.type === 'supplyCheck')[1])
  assert.ok(inLog(none, '石壁上的秘密'))
})

test('幕间三：伊塔卡的信念要三个条件，全部满足才写记录并加异教徒标记', () => {
  const base = launch()
  base.campaign.chaosBag.push('cultist', 'cultist')
  base.campaign.records.theInvestigatorsForgedABondWithIchtaca = true
  base.campaign.records.ichtacaHasConfidenceInYou = true
  const restored = runEffect(base, effect('interludeThree', 'ichtacaFaith'))
  assert.equal(restored.campaign.records.ichtacasFaithIsRestored, true)
  assert.equal(restored.campaign.chaosBag.filter(face => face === 'cultist').length, 3)
  assert.ok(inLog(restored, '重振信念'))

  const short = runEffect(launch(), effect('interludeThree', 'ichtacaFaith'))
  assert.equal(short.campaign.records.ichtacasFaithIsRestored, false)
  assert.ok(inLog(short, '条件未满足'))
})

test('幕间四：归位程式反效果按标记给离体体验弱点与伊斯人身体', () => {
  const base = launch()
  base.campaign.records.theProcessBackfired = true
  base.campaign.chaosBag = ['cultist', 'cultist', 'cultist']
  const outOfBody = runEffect(base, effect('interludeFour', 'outOfBodyProcess'))
  assert.equal(outOfBody.campaign.investigators[0].deck.includes('04264'), true, '加入离体体验弱点')
  assert.deepEqual(outOfBody.campaign.ruleFlags.yithianBodySeats, [0])
  assert.ok(inLog(outOfBody, '揭示：cultist'))

  const calm = launch()
  calm.campaign.records.theProcessBackfired = true
  calm.campaign.chaosBag = ['eldersign', '+1']
  const none = runEffect(calm, effect('interludeFour', 'outOfBodyProcess'))
  assert.equal(none.campaign.investigators[0].deck.includes('04264'), false)
  assert.ok(inLog(none, '不承受负面效果'))
})

test('幕间四：三个条件满足才恢复意识，否则亚历山卓与你为敌', () => {
  const base = launch()
  base.campaign.investigators[0].deck.push('04051')
  base.campaign.chaosBag.push('tablet', 'tablet')
  base.campaign.records.theInvestigatorsRescuedAlejandro = true
  base.campaign.ruleFlags = { ...(base.campaign.ruleFlags || {}), custodianWasUnderControl: true }
  const recovering = runEffect(base, effect('interludeFour', 'alejandroMind'))
  assert.equal(recovering.campaign.records.alejandroRemembersEverything, true)
  assert.equal(recovering.campaign.records.alejandroIsSetAgainstYou, false)

  const lost = runEffect(launch(), effect('interludeFour', 'alejandroMind'))
  assert.equal(lost.campaign.records.alejandroIsSetAgainstYou, true)
  assert.equal(lost.campaign.records.alejandroRemembersEverything, false)
  assert.ok(inLog(lost, '永远迷失'))
})

test('幕间四：没有粉笔时道路关闭且下一场不能换手牌', () => {
  const shut = runEffect(launch(), effect('interludeFour', 'supplyCheck'))
  assert.ok(inLog(shut, '道路现已关闭'))
  assert.equal(shut.campaign.ruleFlags.cannotMulliganOnce, true)

  const open = runEffect(launch(['chalk']), effect('interludeFour', 'supplyCheck'))
  assert.ok(inLog(open, '道路现已开启'))
  assert.equal(open.campaign.ruleFlags?.cannotMulliganOnce, undefined)
})

test('幕间五：深渊 / 联结点分支、遗物的读数与火盆记录', () => {
  const base = launch()
  const fell = runEffect(base, effect('interludeFive', 'storyBranch'))
  assert.ok(inLog(fell, '如果接近联结点'))
  const depths = launch()
  depths.campaign.records.theInvestigatorsFellIntoTheDepths = true
  assert.ok(inLog(runEffect(depths, effect('interludeFive', 'storyBranch')), '犹如沥青的黑暗'))

  const missing = runEffect(launch(), effect('interludeFive', 'relicReadings'))
  assert.ok(inLog(missing, '日益忧虑'))
  assert.equal(missing.campaign.chaosBag.filter(face => face === '-4').length,
    launch().campaign.chaosBag.filter(face => face === '-4').length + 1)

  const found = launch()
  found.campaign.records.theInvestigatorsFoundTheRelicOfAges = true
  assert.ok(inLog(runEffect(found, effect('interludeFive', 'relicReadings')), '神秘的嗡嗡声'))

  const lit = runEffect(launch(['torches']), effects('interludeFive').filter(item => item.type === 'supplyCheck')[0])
  assert.equal(lit.campaign.records.theBraziersAreLit, true)
  assert.ok(inLog(lit, '火炬之光'))

  const unlit = runEffect(launch(), effects('interludeFive').filter(item => item.type === 'supplyCheck')[0])
  assert.equal(unlit.campaign.records.theBraziersRemainUnlit, true)
  assert.ok(inLog(unlit, '无尽深渊'))

  const reading = launch(['map'])
  reading.campaign.records.theBraziersAreLit = true
  const signs = runEffect(reading, effects('interludeFive').filter(item => item.type === 'supplyCheck')[1])
  assert.ok(inLog(signs, '解读印记'))
  assert.equal(signs.campaign.investigators[0].xp, 2)
})

test('幕间五：结尾划掉所有药品与配给', () => {
  const base = launch(['medicine', 'provisions', 'provisions'])
  const state = runEffect(base, effect('interludeFive', 'discardSupplies'))
  assert.deepEqual(suppliesOf(state), [])
  assert.ok(inLog(state, '划掉了'))
})

test('幕间：只有到达的段落进入调查纪事，互斥分支不展开', () => {
  const base = withInterludeNode(launch(['blanket']), 'interludeOne')
  const state = runEffect(base, effect('interludeOne', 'sleepCheck'))
  const reached = state.campaign.storySections.interludeOne
  assert.ok(reached.length)
  assert.ok(reached.join('').includes('安稳入睡'))
  assert.equal(reached.join('').includes('辗转反侧'), false)

  state.campaign.flow.history = [{ nodeId: 'interludeOne', visit: 1 }]
  const entry = campaignStory(state, contentRegistry).entries
    .find(item => item.kind === 'interlude' && item.title.includes('幕间'))
  assert.ok(entry, '纪事里有幕间条目')
  assert.equal(entry.nodeId, 'interludeOne', '纪事条目带上剧情节点，供局外面板定位当前幕间')
  assert.equal(entry.paragraphs.join('').includes('辗转反侧'), false)

  // 还没结算任何分支时，纪事展示的是卡面的检查清单。
  const fresh = withInterludeNode(launch(), 'interludeTwo')
  fresh.campaign.flow.history = [{ nodeId: 'interludeTwo', visit: 1 }]
  const pending = campaignStory(fresh, contentRegistry).entries.find(item => item.nodeId === 'interludeTwo')
  assert.ok(pending, '未结算的幕间也要有纪事条目')
  assert.ok(pending.paragraphs.join('').includes('如果调查员找到了古代遗物'))
})

test('幕间：局外面板的数据通路（当前节点 + 到达段落 + 记录标签）', async () => {
  const { viewState } = await import('../src/integration/observation.js')
  const base = withInterludeNode(launch(['blanket']), 'interludeOne')
  const state = runEffect(base, effect('interludeOne', 'sleepCheck'))
  state.campaign.flow.history = [{ nodeId: 'interludeOne', visit: 1 }]
  const view = viewState(state, 0)
  assert.equal(view.campaign.flow.nodeId, 'interludeOne')
  const entry = view.campaignStory.entries.find(item => item.nodeId === 'interludeOne')
  assert.ok(entry, '观察投影里能定位当前幕间的纪事条目')
  assert.ok(entry.paragraphs.join('').includes('安稳入睡'))
  assert.equal(entry.paragraphs.join('').includes('辗转反侧'), false)
  // 记录标签随大厅战役清单下发，档案页与结算页才能显示中文名。
  const listed = campaignListForUi(contentRegistry).find(entry => entry.id === manifest.id)
  assert.equal(listed.recordLabels.yigsFury, '伊格之怒')
  assert.equal(listed.recordLabels.theHarbingerIsAlive, '预示者还活着')
  assert.equal(Object.keys(listed.recordLabels).length, 49)
})

test('幕间修正：起始资源 / 起始线索用一次后清空，禁止换牌也只生效一次', () => {
  const base = launch()
  base.campaign.startingAdjustments = { 0: { resources: -3, clues: 1 } }
  const inv = { ...base.investigators[0], resources: 5, clues: 0 }
  const applied = consumeStartingAdjustments(base, inv, null)
  assert.deepEqual(applied, { resources: -3, clues: 1 })
  assert.equal(inv.resources, 2)
  assert.equal(inv.clues, 1)
  assert.equal(consumeStartingAdjustments(base, inv, null), null, '修正只用一次')

  base.campaign.ruleFlags = { ...(base.campaign.ruleFlags || {}), cannotMulliganOnce: true }
  assert.equal(consumeMulliganBlock(base), true)
  assert.equal(consumeMulliganBlock(base), false)
})

test('幕间：每个节点都挂了效果与检查清单正文', () => {
  for (const id of ['interludeOne', 'interludeTwo', 'interludeThree', 'interludeFour', 'interludeFive', 'resupplyPoint']) {
    const node = manifest.flow.nodes[id]
    assert.equal(node.type, 'interlude', id)
    assert.ok(node.text.length > 10, `${id} 有检查清单正文`)
    assert.ok(node.effects.length > 0, `${id} 有结算效果`)
    assert.ok(node.next, id)
  }
  // 互斥正文不再一次性塞进节点文本。
  const one = manifest.flow.nodes.interludeOne.text
  assert.equal(one.includes(sectionText('interludeOne', 'restfulSleep')), false)
  assert.equal(one.includes(sectionText('interludeOne', 'tossingAndTurning')), false)
})
