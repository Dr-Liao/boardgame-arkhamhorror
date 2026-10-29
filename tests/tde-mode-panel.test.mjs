// P5 批次 3 / 交互第 1 条：开局模式面板的纯数据模型（web/hub-mode-view.js）。
//
// 面板本身只渲染模型；这里锁定「模式顺序、置灰原因、座位分线、先选模式提示」的口径，
// 避免浏览器里再写一套判断。真实 DOM/浏览器证据仍以 P8 注册 parts 战役为前提。
import test from 'node:test'
import assert from 'node:assert/strict'

import { modePanelModel } from '../web/hub-mode-view.js'
import { departureLanes } from '../web/departure-lanes.js'

const modeMove = (mode, label, extra = {}) => ({ action: 'hubSetMode', mode, label, ...extra })
const seatMove = (seat, part, extra = {}) => ({
  action: 'hubSetSeatPart', seat, part, label: `座位 ${seat + 1} → ${part} 线`, ...extra,
})

test('未声明 parts 的战役：没有 hubSetMode，面板整体不渲染', () => {
  const model = modePanelModel({ campaign: { seatParts: [] } }, [
    { action: 'hubSetDifficulty', difficulty: 'standard' },
    { action: 'hubGoSetup', label: '准备调查员' },
  ])
  assert.equal(model.visible, false)
  assert.equal(model.firstScreen, false, '没有 hubSetMode 的战役不能被模式门拦截')
  assert.deepEqual(model.modes, [])
  assert.equal(model.needsMode, false, '非 parts 战役没有模式步骤')
})

test('四种模式按固定顺序渲染，置灰模式保留引擎给的原因', () => {
  const moves = [
    modeMove('parallel', '并行', { disabled: true, explanation: '并行需要偶数人数' }),
    modeMove('pick', '分选', { disabled: true, explanation: '分选至少需要 2 名调查员' }),
    modeMove('singleA', '单线 A'),
    modeMove('singleB', '单线 B'),
  ]
  const model = modePanelModel({ campaign: { seatParts: ['A', 'B'] } }, moves)
  assert.equal(model.visible, true)
  assert.deepEqual(model.modes.map(item => item.mode), ['singleA', 'singleB', 'pick', 'parallel'])
  assert.equal(model.modes[0].disabled, false)
  assert.equal(model.modes[0].reason, '')
  assert.equal(model.modes[2].reason, '分选至少需要 2 名调查员')
  assert.equal(model.modes[3].reason, '并行需要偶数人数')
  assert.equal(model.selected, null)
  assert.equal(model.needsMode, true)
})

test('分选模式：座位分线逐条给按钮模型，跨线重复校验原因原样保留', () => {
  const moves = [
    modeMove('pick', '分选'),
    seatMove(0, 'A'),
    seatMove(1, 'B'),
    seatMove(2, 'A', { disabled: true, explanation: '另一条线已经没有人了' }),
  ]
  const model = modePanelModel({ campaign: { mode: 'pick', seatParts: ['A', 'B', 'A'] } }, moves)
  assert.equal(model.selected, 'pick')
  assert.equal(model.seatHint, true)
  assert.deepEqual(model.seats.map(item => [item.seat, item.part]), [[0, 'A'], [1, 'B'], [2, 'A']])
  assert.equal(model.seats[2].disabled, true)
  assert.equal(model.seats[2].reason, '另一条线已经没有人了')
  assert.deepEqual(model.seatParts, ['A', 'B', 'A'])
  assert.equal(model.needsMode, false)
})

test('并行模式不出现座位分线（按人数整桌分线由引擎决定）', () => {
  const model = modePanelModel({ campaign: { mode: 'parallel', seatParts: ['A', 'A', 'B', 'B'] } }, [
    modeMove('singleA', '单线 A'),
    modeMove('singleB', '单线 B'),
    modeMove('pick', '分选'),
    modeMove('parallel', '并行'),
  ])
  assert.equal(model.selected, 'parallel')
  assert.equal(model.seats.length, 0)
  assert.equal(model.seatHint, false)
  assert.deepEqual(model.seatParts, ['A', 'A', 'B', 'B'])
})

test('选定分选后：hubSetMode 不再下发，面板仍显示当前模式与座位分线', () => {
  const model = modePanelModel({ campaign: { mode: 'pick', seatParts: ['A', 'B', 'A'] } }, [
    seatMove(0, 'B'),
    seatMove(1, 'A', { disabled: true, explanation: '另一条线已经没有人了' }),
  ])
  assert.equal(model.visible, true)
  assert.equal(model.modes.length, 0)
  assert.equal(model.selected, 'pick')
  assert.equal(model.selectedLabel, '分选双线')
  assert.equal(model.needsMode, false)
  assert.equal(model.seats.length, 2)
})

test('首屏门：未选模式时 firstScreen=true，且没有任何页签/分线', () => {
  const model = modePanelModel({ campaign: { seatParts: [] } }, [modeMove('singleA', '单线 A（梦寻）')])
  assert.equal(model.firstScreen, true)
  assert.equal(model.assignments.length, 0)
  assert.equal(model.balanced, false)
})

test('并行分线摘要：assignments 覆盖全部座位，人数不等时 balanced=false', () => {
  const model = modePanelModel({ campaign: { mode: 'parallel', seatParts: ['A', 'A', 'B', 'B'] } }, [
    seatMove(0, 'B'),
    seatMove(1, 'B'),
  ])
  assert.equal(model.firstScreen, false)
  assert.deepEqual(model.assignments.map(item => [item.seat, item.part]), [[0, 'A'], [1, 'A'], [2, 'B'], [3, 'B']])
  assert.deepEqual(model.laneCounts, { A: 2, B: 2 })
  assert.equal(model.balanced, true)
  // 自由换线后允许暂时 3:1，只是不能开始。
  const unbalanced = modePanelModel({ campaign: { mode: 'parallel', seatParts: ['A', 'A', 'A', 'B'] } }, [seatMove(3, 'A')])
  assert.deepEqual(unbalanced.laneCounts, { A: 3, B: 1 })
  assert.equal(unbalanced.balanced, false)
})

test('非房主席位：投影里的 requiresMode 让首屏门仍然成立，并提示等待房主', () => {
  const model = modePanelModel({ campaign: { requiresMode: true, mode: null } }, [])
  assert.equal(model.firstScreen, true)
  assert.equal(model.visible, true)
  assert.equal(model.modes.length, 0)
  assert.equal(model.hostChooses, true)
  // 模式选定后首屏门解除。
  const chosen = modePanelModel({ campaign: { requiresMode: true, mode: 'parallel', seatParts: ['A', 'B'] } }, [])
  assert.equal(chosen.firstScreen, false)
  assert.equal(chosen.hostChooses, false)
})

test('出发准备分屏模型：非并行战役保持原页面', () => {
  const model = departureLanes({ campaign: { mode: 'singleA' } }, [])
  assert.equal(model.parallel, false)
  assert.deepEqual(model.lanes, [])
})

test('出发准备分屏模型：A/B 两栏、每线队长、换线与开始按钮', () => {
  const state = { campaign: {
    mode: 'parallel', seatParts: ['A', 'A', 'B', 'B'], partLeads: { A: 0, B: 3 },
  } }
  const moves = [
    { action: 'hubSetPartLeader', part: 'A', leadSeat: 1, label: 'A 线队长：Daisy' },
    { action: 'hubSetPartLeader', part: 'B', leadSeat: 2, label: 'B 线队长：Skids' },
    { action: 'hubSetSeatPart', seat: 1, part: 'B', label: '座位 2 → B 线' },
    { action: 'hubSetSeatPart', seat: 3, part: 'A', label: '座位 4 → A 线' },
    { action: 'hubBeginScenario', label: '开始当前关卡' },
  ]
  const model = departureLanes(state, moves)
  assert.equal(model.parallel, true)
  assert.deepEqual(model.lanes.map(lane => [lane.part, lane.size]), [['A', 2], ['B', 2]])
  assert.deepEqual(model.lanes[0].seats, [0, 1])
  assert.equal(model.lanes[0].leaderSeat, 0)
  assert.equal(model.lanes[1].leaderSeat, 3)
  assert.deepEqual(model.lanes[1].leaders.map(move => move.leadSeat), [2])
  assert.deepEqual(model.lanes[0].switches.map(move => move.seat), [1])
  assert.equal(model.balanced, true)
  assert.equal(model.startMove.action, 'hubBeginScenario')
})
