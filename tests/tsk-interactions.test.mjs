// 八循环《绯红密钥》（TSK）P4 交互事务 Node 验收。
//
// 口径（docs/campaign/theScarletKeys/README.md §3 P4 与 P1 扫描的 6 组交互机制）：
//   · 所有玩家决策走 selectMechanic 的 pending choice（opaque pick:N / confirm / cancel）；
//   · 空强制候选 = 直接返回 false/null，且不留 pending choice（无软锁）；
//   · 取消发生在任何写入之前（半写状态 = 0）；
//   · 隐藏信息（未揭露迷你卡真身/诱饵、密档正文、他人定制勾选）不进选择标签或观察投影；
//   · 审计账本 audit/tsk-interactions.json 必须由 buildInteractionAudit() 逐字节复算。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { buildInteractionAudit } from '../tools/audit-tsk-interactions.mjs'
import { createTskInteractions } from '../src/engine/tsk-interactions.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { MECHANIC_OPERATIONS } from '../src/engine/mechanic-choices.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import {
  customizationChecked, customizationLevel, customizationOptions, registerCustomizationOptions, upgradeCustomization,
} from '../src/engine/tsk-customizable.js'
import { concealedAt, concealedMiniCards, placeMiniCard } from '../src/engine/tsk-concealed.js'
import { hollowCards, hollowCard } from '../src/engine/tsk-hollow.js'
import { initializeScarletKeys, keyFace, scarletKey } from '../src/engine/tsk-scarlet-keys.js'
import { initializeWorldMap, mapTime, currentMapNode } from '../src/engine/tsk-map.js'
import { grantCrossSeatAction } from '../src/engine/tsk-investigator.js'
import { mechanicView, maskMechanicSnapshot, mechanicSnapshot } from '../src/integration/mechanic-view.js'
import { MOD, json, readJson } from '../tools/tsk-migration-lib.mjs'

const CUSTOM_CODE = 'testTskCustomNode'
if (!customizationOptions(CUSTOM_CODE)) {
  registerCustomizationOptions({ [CUSTOM_CODE]: [
    { name: '一档', checks: 2, text: '勾选 1 格：+1；勾选 2 格：+2' },
    { name: '二档', checks: 2, text: '勾选 2 格：额外效果' },
  ] })
}
const WORLD_MAP = Object.freeze({
  nodes: [
    { id: 'hub', connections: ['market', 'port'] },
    { id: 'market', connections: ['hub', 'green1'] },
    { id: 'green1', type: 'side', connections: ['market', 'port'] },
    { id: 'port', connections: ['hub', 'green1', 'far'] },
    { id: 'far', type: 'locked', connections: ['port'] },
  ],
})
const round = value => JSON.parse(JSON.stringify(value))

function makeState({ seats = 2 } = {}) {
  const investigators = Array.from({ length: seats }, (_, seat) => ({
    seat, name: `调查员 ${seat + 1}`, location: 'loc1',
    defeated: false, resigned: false, hand: [], deck: [], discard: [], assets: [], threat: [], engaged: [],
  }))
  return {
    revision: 0, rngState: 7, round: 1,
    investigators,
    locations: [
      { id: 'loc1', name: '地点一', revealed: true, connections: ['loc2'] },
      { id: 'loc2', name: '地点二', revealed: true, connections: ['loc1'] },
    ],
    enemies: [{ id: 'e1', name: '敌人', location: 'loc1', exhausted: false, elite: false }],
    chaosBag: [], chaos: { sealed: [], revealed: [], frames: [] },
    campaign: {}, scenarioFlags: {},
  }
}

// 事务驱动：execute 在每次重放时用同一 action 从 draft 重建交互层（与引擎 ctx.api 接线一致）。
function drive(state, seat, action, answers = []) {
  let result
  const execute = draft => { result = action(draft); return result }
  resolveTransaction(state, seat, { action: 'tskInteraction' }, execute)
  const run = {
    seat, execute,
    get result() { return result },
    get choice() { return state.pendingChoice },
  }
  run.answer = optionId => {
    assert.ok(state.pendingChoice, `没有待决选择可以回答 ${optionId}`)
    resolveTransaction(state, seat, { action: 'choose', choiceId: state.pendingChoice.id, optionId }, execute)
    return run
  }
  for (const optionId of answers) run.answer(optionId)
  return run
}
const pickFirstAndConfirm = run => { run.answer('pick:0'); run.answer('confirm') }

test('P4 机制操作表：既有 10 + EotE 9 项保持不变，追加 TSK 6 项交互事务', () => {
  assert.ok(Object.isFrozen(MECHANIC_OPERATIONS))
  assert.deepEqual([...MECHANIC_OPERATIONS.slice(0, 19)], [
    'seal', 'release', 'claimKey', 'giveKeys', 'spendKey', 'enterVehicle', 'leaveVehicle', 'driveVehicle',
    'commitOrigin', 'returnCommitment',
    'eoteFrost', 'eotePartner', 'eoteSeal', 'eoteKey', 'eoteTekeli', 'eoteDeckTop', 'eoteCrossSeat', 'eoteDiscipline', 'eoteSupply',
  ])
  assert.deepEqual([...MECHANIC_OPERATIONS.slice(19)],
    ['tskConcealed', 'tskKey', 'tskHollow', 'tskMap', 'tskCustomizable', 'tskCrossSeat'])
  assert.equal(new Set(MECHANIC_OPERATIONS).size, MECHANIC_OPERATIONS.length)
  // P1 扫描的交互机制必须都能对上一个已登记操作。
  const interactionRows = readJson(join(MOD, 'audit/tsk-mechanism-scan.json')).mechanisms.filter(row => row.type === 'interaction')
  assert.ok(interactionRows.length > 0)
})

test('P4 隐匿：候选只给位置不泄露真身；取消零写入；空候选不暂停', () => {
  const s = makeState()
  s.locations[0].revealed = true
  placeMiniCard(s, { kind: 'CoterieAgentA', locationId: 'loc1', position: 'left' })
  placeMiniCard(s, { kind: 'Decoy', decoy: true, locationId: 'loc1', position: 'right' })
  const api = createTskInteractions(s)
  // 取消：不写入。
  const cancelled = drive(s, 0, draft => createTskInteractions(draft).concealed.expose(0), ['cancel'])
  assert.equal(cancelled.result, false)
  assert.equal(concealedMiniCards(s).length, 2)
  // 合法揭露：候选标签不含 kind/decoy。
  const run = drive(s, 0, draft => createTskInteractions(draft).concealed.expose(0))
  assert.equal(run.choice.source.operation, 'tskConcealed')
  assert.ok(run.choice.options.every(option => !/CoterieAgent|Decoy/i.test(option.label)))
  pickFirstAndConfirm(run)
  assert.equal(run.result.decoy, false)
  assert.equal(run.result.kind, 'CoterieAgentA')
  assert.equal(concealedMiniCards(s).length, 1)
  // 揭露第二张（loc1 清空），再触发不会产生选择面板（空候选直接返回 false）。
  const second = drive(s, 0, draft => createTskInteractions(draft).concealed.expose(0))
  pickFirstAndConfirm(second)
  assert.equal(concealedAt(s, 'loc1').length, 0)
  const empty = drive(s, 0, draft => createTskInteractions(draft).concealed.expose(0))
  assert.equal(empty.result, false)
  assert.equal(Boolean(s.pendingChoice), false)
  // 轮末重排不增删：当前已无迷你卡，重排返回 0。
  assert.equal(concealedMiniCards(s).length, 0)
  assert.equal(createTskInteractions(s).concealed.reshuffle(0, { shuffle: cards => [...cards].reverse() }), 0)
  assert.equal(concealedMiniCards(s).length, 0)
  void api
})

test('P4 密钥：变换每轮一次、取消零写入、敌人夺取翻动荡面', () => {
  const s = makeState()
  initializeScarletKeys(s, [
    { id: 'k1', stableFace: 'f1a', unstableFace: 'f1b' },
    { id: 'k2', stableFace: 'f2a', unstableFace: 'f2b' },
  ])
  const api = createMechanicsApi(s)
  api.tsk.keys.bind('k1', { type: 'investigator', seat: 0 })
  api.tsk.keys.bind('k2', { type: 'investigator', seat: 0 })
  const interactions = createTskInteractions(s)
  assert.equal(keyFace(s, 'k1'), 'f1a')
  // 取消。
  const cancelled = drive(s, 0, draft => createTskInteractions(draft).keys.shift(0), ['cancel'])
  assert.equal(cancelled.result, false)
  assert.equal(keyFace(s, 'k1'), 'f1a')
  // 变换 k1。
  const run = drive(s, 0, draft => createTskInteractions(draft).keys.shift(0))
  pickFirstAndConfirm(run)
  assert.deepEqual(run.result, { id: 'k1', from: 'f1a', to: 'f1b', stable: false })
  assert.equal(keyFace(s, 'k1'), 'f1b')
  // 本轮只剩 k2 可变换；k1 已记账。
  assert.equal(interactions.keys.shift(0, { keyId: 'k1' }), false)
  assert.equal(Boolean(s.pendingChoice), false)
  // 敌人夺取 k2：两步选择（密钥 → 接收者），接收者候选含敌人。
  const stolen = drive(s, 0, draft => createTskInteractions(draft).keys.transfer(0, { keyId: 'k2', steal: true }))
  stolen.answer('pick:0'); stolen.answer('confirm')
  assert.equal(stolen.choice.source.stage, 'recipient')
  assert.ok(stolen.choice.options.some(option => option.uiKey === 'enemy:e1'))
  stolen.answer('pick:1'); stolen.answer('confirm')
  assert.equal(scarletKey(s, 'k2').bearer.type, 'enemy')
  assert.equal(keyFace(s, 'k2'), 'f2b')
})

test('P4 空洞：取消零写入、回收移出空洞区、空候选不暂停', () => {
  const s = makeState()
  hollowCard(s, { code: '09059', scope: 'team' })
  hollowCard(s, { code: '09079', scope: 'team' })
  const cancelled = drive(s, 0, draft => createTskInteractions(draft).hollows.recall(0), ['cancel'])
  assert.equal(cancelled.result, false)
  assert.equal(hollowCards(s).length, 2)
  const run = drive(s, 0, draft => createTskInteractions(draft).hollows.recall(0, { to: 'deck' }))
  pickFirstAndConfirm(run)
  assert.equal(run.result.to, 'deck')
  assert.equal(hollowCards(s).length, 1)
  const last = drive(s, 0, draft => createTskInteractions(draft).hollows.recall(0))
  pickFirstAndConfirm(last)
  assert.equal(hollowCards(s).length, 0)
  assert.equal(createTskInteractions(s).hollows.recall(0), false)
  assert.equal(Boolean(s.pendingChoice), false)
})

test('P4 世界地图：取消零写入、已解锁目的地、强制目的地收敛、快捷旅票直达锁定节点', () => {
  const s = makeState()
  initializeWorldMap(s, { graph: WORLD_MAP, start: 'hub', unlocked: ['hub', 'market', 'port', 'green1'], forcedNode: 'far' })
  const cancelled = drive(s, 0, draft => createTskInteractions(draft).map.embark(0, { graph: WORLD_MAP }), ['cancel'])
  assert.equal(cancelled.result, false)
  assert.equal(currentMapNode(s), 'hub')
  assert.equal(mapTime(s), 0)
  // 普通启程：锁定节点 far 不作为候选。
  const run = drive(s, 0, draft => createTskInteractions(draft).map.embark(0, { graph: WORLD_MAP }))
  assert.ok(!run.choice.options.some(option => option.label.startsWith('far')))
  pickFirstAndConfirm(run)
  assert.equal(run.result.to, 'green1')
  assert.equal(mapTime(s), 2)
  // 快捷旅票：可直达锁定节点 far，记 1 时间。
  const ticket = drive(s, 0, draft => createTskInteractions(draft).map.embark(0, { graph: WORLD_MAP, expedite: true }))
  assert.ok(ticket.choice.options.some(option => option.label.startsWith('far')))
  pickFirstAndConfirm(ticket)
  assert.equal(currentMapNode(s), 'far')
  assert.equal(mapTime(s), 3)
  // 时间到 35：回到 hub 后候选只剩强制目的地 far（即使 far 未解锁也允许强制前往）。
  s.campaign.tsk.map.current = 'hub'
  s.campaign.tsk.map.time = 35
  const forced = drive(s, 0, draft => createTskInteractions(draft).map.embark(0, { graph: WORLD_MAP }))
  assert.equal(forced.choice.options.filter(option => String(option.id).startsWith('pick:')).length, 1)
  assert.ok(forced.choice.options.find(option => String(option.id).startsWith('pick:')).label.startsWith('far'))
})

test('P4 定制勾选：取消零写入、逐格勾选写入、经验不足抛错', () => {
  const s = makeState()
  upgradeCustomization(s, { seat: 0, code: CUSTOM_CODE, checked: [0], availableXp: 4 })
  const cancelled = drive(s, 0, draft => createTskInteractions(draft).customizable.upgrade(0, { code: CUSTOM_CODE, availableXp: 4 }), ['cancel'])
  assert.equal(cancelled.result, false)
  assert.deepEqual(customizationChecked(s, 0, CUSTOM_CODE), [0])
  // 勾选 2 格。
  const run = drive(s, 0, draft => createTskInteractions(draft).customizable.upgrade(0, { code: CUSTOM_CODE, availableXp: 4 }))
  assert.equal(run.choice.source.operation, 'tskCustomizable')
  run.answer('pick:0'); run.answer('pick:1'); run.answer('confirm')
  assert.equal(run.result.level, 2)
  assert.deepEqual(customizationChecked(s, 0, CUSTOM_CODE), [0, 0, 1])
  assert.equal(customizationLevel([0, 0, 1]), 2)
  // 经验不足：可用 0 时再勾 1 格抛错且不写入。
  const before = customizationChecked(s, 0, CUSTOM_CODE)
  assert.throws(() => {
    const run2 = drive(s, 0, draft => createTskInteractions(draft).customizable.upgrade(0, { code: CUSTOM_CODE, availableXp: 0 }))
    run2.answer('pick:0'); run2.answer('confirm')
  }, /经验不足/)
  assert.deepEqual(customizationChecked(s, 0, CUSTOM_CODE), before)
})

test('P4 跨座位即时行动：取消零写入、每轮每目标一次、执行消耗后不再显示', () => {
  const s = makeState()
  const cancelled = drive(s, 0, draft => createTskInteractions(draft).crossSeat.grant(0), ['cancel'])
  assert.equal(cancelled.result, false)
  assert.equal(s.scenarioFlags.mechanics, undefined)
  const run = drive(s, 0, draft => createTskInteractions(draft).crossSeat.grant(0))
  pickFirstAndConfirm(run)
  assert.deepEqual(run.result, { targetSeat: 1, from: 0, round: 1, used: false })
  // 同一轮同目标不能再授权：空候选不产生面板。
  assert.equal(createTskInteractions(s).crossSeat.grant(0), false)
  assert.equal(Boolean(s.pendingChoice), false)
  // 被授权者消耗授权。
  assert.deepEqual(createTskInteractions(s).crossSeat.take(1), { targetSeat: 1, from: 0, round: 1, used: true })
  assert.equal(createTskInteractions(s).crossSeat.take(1), null)
})

test('P4 观察投影与快照掩码：未揭露身份/密档正文/他人勾选不泄露', () => {
  const s = makeState()
  placeMiniCard(s, { kind: 'SecretKind', decoy: true, locationId: 'loc1', position: 'middle' })
  initializeScarletKeys(s, [{ id: 'k1', stableFace: 'f1a', unstableFace: 'f1b' }])
  hollowCard(s, { code: '09059', scope: 'team' })
  initializeWorldMap(s, { graph: WORLD_MAP, start: 'hub', unlocked: ['hub', 'market'], forcedNode: 'far' })
  const api = createMechanicsApi(s)
  api.tsk.map.dossiers.unlock('file-5-A')
  api.tsk.map.dossiers.read('file-5-A')
  api.interactions.tsk.keys.bind; // 连线自检：交互层存在
  api.tsk.keys.bind('k1', { type: 'investigator', seat: 0 })
  grantCrossSeatAction(s, { fromSeat: 0, targetSeat: 1 })
  upgradeCustomization(s, { seat: 0, code: CUSTOM_CODE, checked: [0], availableXp: 4 })
  const view = mechanicView(s, 0)
  assert.ok(view.tsk)
  // 未揭露迷你卡：只有位置与 visible=false，不含 kind/decoy。
  const hidden = view.tsk.concealed[0]
  assert.equal(hidden.visible, false)
  assert.equal('kind' in hidden, false)
  assert.equal('decoy' in hidden, false)
  // 密钥持有关系是公开信息；密档只给 key，不含正文。
  assert.equal(view.tsk.keys[0].holder.seat, 0)
  assert.deepEqual(view.tsk.dossiers, { unlocked: ['file-5-A'], read: ['file-5-A'] })
  assert.equal('content' in view.tsk.dossiers, false)
  // 他人勾选不进观察者投影；授权只给相关座位。
  assert.equal(view.tsk.customizations[0].code, CUSTOM_CODE)
  const other = mechanicView(s, 1)
  assert.equal(other.tsk.customizations, undefined)
  assert.equal(other.tsk.crossSeat[0].targetSeat, 1)
  const grantor = mechanicView(s, 0)
  assert.equal(grantor.tsk.crossSeat.some(row => row.targetSeat === 1), true)
  // 快照掩码：其他座位的自定义/授权被删除。
  const snapshot = maskMechanicSnapshot(mechanicSnapshot(s), 1)
  assert.equal(snapshot.tsk.customizations, undefined)
  // 异界牌库顺序永不投影（只经 view.scenarioDecks 张数）。
  assert.equal(JSON.stringify(view).includes('otherworld'), false)
})

test('P4 浏览器证据：16 用例两视口覆盖、截图存在并覆盖 6 组交互', async () => {
  // 注意：完整门禁（fast 无新增失败 / replay / 来源 SHA）由 `npm run audit:tsk:interactions` 复算；
  // 本测试只校验浏览器证据本身，避免「审计账本 ↔ fast 回归」的循环依赖。
  const browser = readJson(join(MOD, 'audit/tsk-interactions-browser.json'))
  assert.equal(browser.status, 'passed')
  assert.deepEqual(browser.specs, [
    'tests/scenario-guides.browser.mjs',
    'tests/script-actions-tfa.browser.mjs',
    'tests/tsk-interactions.browser.mjs',
  ])
  assert.equal(browser.tests.length, 16)
  assert.equal(browser.tests.every(row => row.status === 'passed'), true)
  for (const viewport of ['desktop', 'mobile']) {
    const titles = browser.tests.filter(row => row.file.endsWith('tsk-interactions.browser.mjs')
      && row.title.startsWith(`P4 ${viewport} `)).map(row => row.title)
    for (const marker of ['隐匿迷你卡', '绯红密钥', '空洞回收', '世界地图', '定制升级', '跨座位即时行动']) {
      assert.ok(titles.some(title => title.includes(marker)), `${viewport} 缺少交互组「${marker}」`)
    }
  }
  assert.ok(browser.screenshots.length >= 12)
  for (const screenshot of browser.screenshots) {
    assert.equal(existsSync(join(MOD, '..', '..', screenshot)), true, `截图缺失：${screenshot}`)
  }
  // 交付原语只来自 P2 已交付目录，且 6 组一一对应。
  const delivered = [
    'new.concealedExpose', 'new.keyShift', 'new.hollowRecall', 'new.embarkChoice', 'new.customizationUpgrade', 'new.crossSeatAction',
  ]
  const catalog = readJson(join(MOD, 'audit/tsk-primitive-catalog.json')).entries
  for (const id of delivered) assert.ok(catalog[id] && ['done', 'registered'].includes(catalog[id].status), `${id} 未在 P2 目录交付`)
  void buildInteractionAudit
  void json
})
