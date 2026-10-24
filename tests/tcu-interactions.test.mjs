// 万象无终（TCU）第 4 步 P5 验收：交互协议与面板模型。
//
// 浏览器里的真实 DOM 由 tests/tcu-interactions.browser.mjs 覆盖；本文件验证两件事：
//   1. 引擎把「谁在选什么」讲清楚——pickTarot / storyInvestigator / haunted 三种待决选择
//      的 kind、source 与选项字段，界面不需要再猜；
//   2. web/tcu-ui.js 的模型函数只读会话投影，能把投影整理成面板要的形状（含存档往返）。
//
// 面板不发明选项：模型里每个候选都带 `move`（来自 legalMoves），没有 move 的候选在界面上置灰。

import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture } from './core-fixture.mjs'
import { buildTarotDeck, tarotChoiceOption, tarotInfo, drawTarot, discardDrawnTarot } from '../src/engine/tarot.js'
import { setExtraEncounterDeck, discardTopOfExtraEncounterDeck } from '../src/engine/alt-decks.js'
import { addBreach, setLocationFlag } from '../src/engine/location-state.js'
import { markHunted, markTakenByWatcher, recordMemento } from '../src/campaign/mementos.js'
import { chooseTarot } from '../src/engine/tarot.js'
import { createHaunted } from '../src/engine/haunted.js'
import { selectStoryInvestigators } from '../src/engine/story-investigators.js'
import { campaignProjection } from '../src/cards/campaign-view.js'
import { manifest as tcuManifest } from '../content/campaigns/theCircleUndone/manifest.js'
import {
  enemyFaceBadge, hauntedChoiceModel, locationTcuBadges, multiSkillTestInfo, romanNumeral,
  storyInvestigatorPickerModel, tarotPickerModel, tcuCampaignModel,
} from '../web/tcu-ui.js'

// 把「待决选择 + 合法动作」拼成面板看到的会话形状：与 observation.viewState 的公开字段同名。
function sessionOf(state, choice, extra = {}) {
  const legalMoves = (choice?.options || []).map(option => ({
    action: 'choose', choiceId: choice.id, optionId: String(option.id), label: option.label,
  }))
  return {
    sessionId: 'test-session',
    state: { ...state, pendingChoice: choice, legalMoves, ...extra },
  }
}

test('P5 塔罗：pickTarot 选项自带编号/正逆位/中英文名，界面不用再存 22 张表', () => {
  const state = {}
  buildTarotDeck(state, { shuffle: list => [...list] })
  const asked = []
  const chosen = chooseTarot(state, {
    seat: 0, count: 3, orientation: 'reverse',
    requestChoice: (target, request) => { asked.push(request); return '19' },
  })
  assert.equal(asked.length, 1)
  assert.equal(asked[0].kind, 'pickTarot')
  assert.equal(asked[0].seat, 0)
  assert.equal(asked[0].source.kind, 'tarot')
  assert.equal(asked[0].source.count, 3)
  assert.deepEqual(asked[0].options.map(option => option.id), ['21', '20', '19'])
  for (const option of asked[0].options) {
    assert.equal(option.orientation, 'reverse')
    assert.equal(typeof option.arcana, 'number')
    assert.match(option.nameZh, /^[\u4e00-\u9fa5]+$/)
    assert.ok(option.nameEn && option.nameEn.length > 2)
  }
  assert.equal(chosen.arcana, 19)
  // 编号→罗马数字由界面算，不写进服务端数据。
  assert.equal(romanNumeral(0), '0')
  assert.equal(romanNumeral(16), 'XVI')
  assert.equal(romanNumeral(21), 'XXI')
})

test('P5 塔罗面板模型：候选来自已抽牌，牌库与已抽历史都读投影；存档往返不变', () => {
  const state = fixture('01001', 1)
  buildTarotDeck(state, { shuffle: list => [...list] })
  const [first] = drawTarot(state, { count: 1, orientation: 'upright' })
  const candidates = drawTarot(state, { count: 2, orientation: 'reverse' }).map(tarotChoiceOption)
  const choice = {
    id: 'q7-0', kind: 'pickTarot', seat: 0, source: { kind: 'tarot', count: 2 },
    prompt: '选择一张要结算的塔罗牌（共 2 张）。', options: candidates,
  }
  const session = sessionOf(state, choice, { tarot: tarotInfo(state) })
  const model = tarotPickerModel(session)
  assert.ok(model)
  assert.equal(model.candidates.length, 2)
  assert.equal(model.candidates[0].orientation, 'reverse')
  assert.equal(model.candidates[0].orientationLabel, '逆位')
  assert.equal(model.candidates[0].roman, romanNumeral(model.candidates[0].arcana))
  assert.equal(model.selectable, 2)
  assert.equal(model.remaining, 19)
  assert.deepEqual(model.drawn.map(entry => entry.arcana), [first.arcana])
  assert.equal(model.drawn[0].orientationLabel, '正位')
  // 不可跳过的选择不给取消按钮；可跳过的选择把 skip 动作原样带出来。
  assert.equal(model.skipMove, null)
  const skippable = {
    ...session,
    state: { ...session.state, pendingChoice: { ...choice, canSkip: true }, legalMoves: [...session.state.legalMoves, { action: 'choose', choiceId: 'q7-0', optionId: 'skip', label: '跳过' }] },
  }
  assert.equal(tarotPickerModel(skippable).skipMove.optionId, 'skip')
  // 存档往返：待决选择与投影都是 JSON。
  const restored = JSON.parse(JSON.stringify(session))
  assert.deepEqual(tarotPickerModel(restored), model)
  // 只认 pickTarot：别的选择不会被塔罗面板截走。
  assert.equal(tarotPickerModel({ state: { ...restored.state, pendingChoice: { ...choice, kind: 'commit' } } }), null)
  assert.equal(tarotPickerModel({ state: { pendingChoice: null } }), null)
})

test('P5 序章选人：选项带职业/属性，source 记录人数；模型给出已选与划掉', () => {
  const state = fixture('01001', 2)
  state.classNames = { guardian: '守护者', seeker: '探求者', rogue: '流浪者', mystic: '潜修者', survivor: '生存者', neutral: '中立' }
  const asked = []
  const config = { codes: ['05046', '05047', '05048', '05049'], crossOutUnused: true }
  const names = { '05046': '加弗瑞拉·米兹拉克', '05047': '杰罗姆·戴维斯', '05048': '瓦伦蒂诺·里瓦斯', '05049': '佩妮·怀特' }
  const record = selectStoryInvestigators(state, config, {
    requestChoice: (target, request) => { asked.push(request); return request.options[0].id },
    cardName: code => names[code] || code,
    cardInfo: () => ({
      klass: 'neutral', classLabel: '中立', subtitle: '私人警卫',
      stats: { willpower: 3, intellect: 3, combat: 4, agility: 2 }, health: 8, sanity: 4,
    }),
  })
  assert.equal(asked.length, 2, '每个座位各问一次')
  assert.equal(asked[0].kind, 'storyInvestigator')
  assert.equal(asked[0].source.seatCount, 2)
  assert.equal(asked[0].options.length, 4)
  const first = asked[0].options[0]
  assert.equal(first.klass, 'neutral')
  assert.equal(first.classLabel, '中立')
  assert.deepEqual(Object.keys(first.stats).sort(), ['agility', 'combat', 'intellect', 'willpower'])
  assert.equal(typeof first.health, 'number')
  assert.equal(typeof first.sanity, 'number')
  assert.equal(asked[1].options.length, 3, '已选的调查员不再出现在下一位的候选里')
  assert.equal(record.chosen.length, 2)
  assert.equal(record.crossedOut.length, 2)
  // 面板模型（第一次提问时的状态）：还没有人选出，候选 4 位。
  const previewState = { ...state, pendingChoice: asked[0], legalMoves: asked[0].options.map(option => ({ action: 'choose', choiceId: asked[0].id, optionId: String(option.id), label: option.label })) }
  delete previewState.storyInvestigators
  const model = storyInvestigatorPickerModel({ state: previewState })
  assert.ok(model)
  assert.equal(model.remainingCount, 4)
  assert.equal(model.selectable, 4)
  assert.equal(model.seatCount, 2)
  assert.equal(model.candidates[0].classLabel, '中立')
  // 选项 id 就是故事调查员卡号：界面据此画卡面并打开完整人物档案。
  // 观察投影会把 klass/classLabel/subtitle/stats/health/sanity 补发给应答座位（见 view-privacy.test.mjs）。
  assert.equal(model.candidates[0].code, '05046')
  assert.equal(model.candidates[0].subtitle, '私人警卫')
  assert.equal(model.candidates[0].health, 8)
  assert.equal(model.candidates[0].sanity, 4)
  assert.deepEqual(model.candidates[0].stats, { willpower: 3, intellect: 3, combat: 4, agility: 2 })
  assert.equal(model.collapsed.length, 0)
  assert.equal(model.alreadyChosen.length, 0)
  // 选完之后：模型从投影里读到已选两人与被划掉的两人。
  const afterChoice = { ...asked[1], id: 'q2-0' }
  const afterState = {
    ...state, pendingChoice: afterChoice, storyInvestigators: record,
    legalMoves: afterChoice.options.map(option => ({ action: 'choose', choiceId: 'q2-0', optionId: String(option.id), label: option.label })),
  }
  const after = storyInvestigatorPickerModel({ state: afterState })
  assert.equal(after.alreadyChosen.length, 2)
  assert.equal(after.collapsed.length, 2)
  assert.equal(after.remainingCount, 3)
})

test('P5 序章选人模型：旧会话只有 id/label 时降级不崩，code 回落卡号', () => {
  const model = storyInvestigatorPickerModel({
    state: {
      pendingChoice: {
        id: 'q-old', kind: 'storyInvestigator', seat: 0, prompt: '选择故事调查员。',
        // 旧存档/旧投影：选项只有 id/label，没有 cardCode 与卡面身份字段。
        options: [{ id: '05046', label: '加弗瑞拉·米兹拉克' }],
      },
      legalMoves: [{ action: 'choose', choiceId: 'q-old', optionId: '05046', label: '加弗瑞拉·米兹拉克' }],
    },
  })
  assert.ok(model)
  assert.equal(model.candidates.length, 1)
  // id 就是卡号：即使没有 cardCode，界面仍能画卡面/打开档案；身份字段缺失时不伪造。
  assert.equal(model.candidates[0].code, '05046')
  assert.equal(model.candidates[0].name, '加弗瑞拉·米兹拉克')
  assert.equal(model.candidates[0].classLabel, null)
  assert.equal(model.candidates[0].stats, null)
  assert.equal(model.candidates[0].health, null)
  assert.equal(model.candidates[0].sanity, null)
  assert.equal(model.candidates[0].move.optionId, '05046')
})

test('P5 闹鬼：待决选择带地点与能力身份，面板按顺序列出条目', () => {
  const state = {
    round: 1, phase: 'investigation', log: [],
    investigators: [{ seat: 0, name: '测试调查员', location: 'loc-a', clues: 2, resources: 3, hand: ['01088'], assets: [], engaged: [], damage: 0, horror: 0, actionsLeft: 3 }],
    locations: [{ id: 'loc-a', name: '暮色庄园', connections: [], haunted: [
      { text: '闹鬼 - 受到 1 点恐惧。', effect: [{ kind: 'horror', amount: 1 }] },
      { text: '闹鬼 - 失去 1 个行动。', effect: [{ kind: 'loseAction', amount: 1 }] },
    ] }],
    enemies: [], scenario: {},
  }
  const requests = []
  const primitive = createHaunted({
    reactionWindow: (target, when, context) => context,
    requestChoice: (target, request) => { requests.push(request); return request.options[0].id },
    scenarioBehavior: () => ({}),
    cardDef: () => ({}),
  })
  const api = {
    info: () => {},
    horror: (seat, amount) => { state.investigators[seat].horror += amount },
    loseActions: (seat, amount) => { state.investigators[seat].actionsLeft -= amount },
    damage: () => {},
    directDamage: () => {},
    directHorror: () => {},
    damageAsset: () => {},
    discardRandom: () => {},
    discardChosen: () => {},
    discardAsset: () => {},
    spendClues: () => {},
    doomOn: () => {},
    addDoom: () => {},
    spawn: () => {},
    attack: () => {},
    moveInvestigator: () => {},
    cardName: code => code,
  }
  primitive.resolveHaunted(state, 0, {}, api, [])
  assert.equal(requests.length, 1, '两条能力时询问结算顺序')
  const request = requests[0]
  assert.equal(request.kind, 'haunted')
  assert.equal(request.source.locationId, 'loc-a')
  assert.equal(request.source.order, true)
  assert.equal(request.options.length, 2)
  assert.equal(request.options[0].abilityIndex, 0)
  assert.match(request.options[0].text, /闹鬼/)
  // 面板模型：地点名、能力原文、条目顺序。
  const model = hauntedChoiceModel({
    state: {
      ...state, pendingChoice: request,
      legalMoves: request.options.map(option => ({ action: 'choose', choiceId: request.id, optionId: String(option.id), label: option.label })),
    },
  })
  assert.ok(model)
  assert.equal(model.locationName, '暮色庄园')
  assert.equal(model.options.length, 2)
  assert.deepEqual(model.options.map(item => item.order), [1, 2])
  assert.equal(model.selectable, 2)
  assert.equal(model.location.id, 'loc-a')
  // 二选一子句也带能力身份（source.text）；没有地点信息时退回「你所在地点」。
  const binary = hauntedChoiceModel({
    state: {
      ...state,
      pendingChoice: { id: 'q1-1', kind: 'haunted', seat: 0, prompt: '二选一', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        source: { kind: 'haunted', locationId: 'loc-a', abilityId: 'loc-a#1', text: '闹鬼 - 你必须失去 1 次行动或失去 2 点资源。' } },
      legalMoves: [{ action: 'choose', choiceId: 'q1-1', optionId: 'a', label: 'A' }],
    },
  })
  assert.equal(binary.abilityText, '闹鬼 - 你必须失去 1 次行动或失去 2 点资源。')
  assert.equal(binary.order, false)
  assert.equal(binary.selectable, 1, '没有对应 move 的选项不计入可选')
  assert.equal(hauntedChoiceModel({ state: { ...state, locations: [] , pendingChoice: { ...binary.choice, source: { kind: 'haunted' } } } }).locationName, '你所在地点')
})

test('P5 战役面板：把六类投影合成一块面板，旧战役没有这些字段就不出现', () => {
  const state = fixture('01001', 1)
  const location = state.locations.find(item => item.id === state.investigators[0].location)
  // 旧战役：什么都没有时返回 null，牌桌不新增空块。
  assert.equal(tcuCampaignModel(campaignProjection(state)), null)
  setExtraEncounterDeck(state, 'spectral', ['01004', '01005'], { shuffle: list => [...list] })
  discardTopOfExtraEncounterDeck(state, 'spectral', 1)
  buildTarotDeck(state, { shuffle: list => [...list] })
  drawTarot(state, { count: 2, orientation: 'reverse' })
  discardDrawnTarot(state, 20)
  addBreach(state, location.id, 2)
  setLocationFlag(state, location.id, 'brazier', true)
  recordMemento(state, 'mesmerizingFlute')
  markHunted(state, 0)
  markTakenByWatcher(state, '05046')
  const view = { ...state, ...campaignProjection(state) }
  // 观察投影里的 locations 必须仍是数组（P5 修正过的键名回归）。
  assert.ok(Array.isArray(view.locations) || view.locations == null)
  assert.ok(view.locationStates[location.id])
  const model = tcuCampaignModel({ ...view, campaign: { mementoLabels: tcuManifest.mementoLabels } })
  assert.ok(model)
  assert.equal(model.spectral.deck, 1)
  assert.equal(model.spectral.discard, 1)
  assert.equal(model.tarot.deck, 20)
  assert.equal(model.tarot.drawn.length, 1)
  assert.equal(model.tarot.discarded, 1)
  assert.equal(model.breaches, 2)
  assert.equal(model.breachLocations, 1)
  assert.deepEqual(model.braziers.map(item => [item.id, item.lit]), [[location.id, true]])
  assert.equal(model.watcher.hunted.length, 1)
  assert.deepEqual(model.watcher.taken, ['05046'])
  assert.deepEqual(model.mementos, [{ id: 'mesmerizingFlute', label: '魅惑长笛' }])
  // 10 个 Memento 中文名齐全，不把英文枚举暴露给玩家。
  assert.equal(Object.keys(tcuManifest.mementoLabels).length, 10)
  for (const label of Object.values(tcuManifest.mementoLabels)) assert.match(label, /^[\u4e00-\u9fa5]+$/)
})

test('P5 地点标记 / 异端者面 / 阵法多技能：读投影，不猜规则', () => {
  const state = fixture('01001', 1)
  const location = state.locations.find(item => item.id === state.investigators[0].location)
  assert.deepEqual(locationTcuBadges({ ...state, ...campaignProjection(state) }, location.id), [])
  addBreach(state, location.id, 1)
  // 火盆只有「已点燃」会写进状态（清掉等于熄灭），所以徽标只在点燃时出现。
  setLocationFlag(state, location.id, 'brazier', true)
  const view = { ...state, ...campaignProjection(state) }
  const badges = locationTcuBadges(view, location.id)
  assert.deepEqual(badges.map(item => item.kind), ['breach', 'brazier'])
  assert.equal(badges[0].value, 1)
  assert.match(badges[1].label, /点燃/)
  // 幽灵地点：地点实例上的 spectral 标记。
  const spectral = { ...view, locations: [...view.locations, { id: 'geist', name: '幽灵地点', spectral: true }] }
  assert.deepEqual(locationTcuBadges(spectral, 'geist').map(item => item.kind), ['spectral'])

  assert.equal(enemyFaceBadge({ name: '普通敌人' }), null)
  const heretic = { name: '异端者', side: 'enemy', cannotBeDefeated: true, faces: [{ code: '05178a', side: 'enemy' }, { code: '05178b', side: 'unfinishedBusiness' }] }
  assert.equal(enemyFaceBadge(heretic).label, '敌人面')
  assert.equal(enemyFaceBadge(heretic).cannotBeDefeated, true)
  assert.match(enemyFaceBadge(heretic).title, /2 面/)
  assert.match(enemyFaceBadge(heretic).title, /放逐/)
  assert.equal(enemyFaceBadge({ ...heretic, side: 'unfinishedBusiness' }).label, '未了之事面')

  assert.equal(multiSkillTestInfo({}), null)
  const single = multiSkillTestInfo({ skillTest: { skill: 'willpower', printedValue: 3, value: 3, difficulty: 4 } })
  assert.equal(single.multi, false)
  assert.equal(single.label, '意志')
  const circle = multiSkillTestInfo({ skillTest: { skill: ['willpower', 'intellect', 'combat', 'agility'], printedValue: 20, value: 20, difficulty: 20, actionKind: 'circle' } })
  assert.equal(circle.multi, true)
  assert.equal(circle.label, '意志+智识+战斗+敏捷')
  assert.equal(circle.actionKind, 'circle')
  assert.deepEqual(circle.skills.map(item => item.icon), ['star', 'book', 'sword', 'leaf'])
})
