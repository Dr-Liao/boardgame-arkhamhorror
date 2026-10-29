// TDE P5 批次 1：开局模式策略（campaign-modes.js）的 Node 验收。
//
// 路线图 §1.4.1：开局只暴露四个选项；奇数人数禁止并行；1 人只能单线；
// 分选两线各 ≥1；并行等分；每座位只建一套牌组（本例只验证「怎么分线」）。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MODE_ORDER, assignSeatPart, campaignPartsManifest, defaultSeatParts, describeModePlan,
  modeOptions, modePlan, supportsModeSelection,
} from '../src/campaign/campaign-modes.js'

const parts = Object.freeze({
  A: Object.freeze({ name: '梦寻', chapters: [{ scenarioId: 'a1' }, { scenarioId: 'a2' }, { scenarioId: 'a3' }, { scenarioId: 'a4' }] }),
  B: Object.freeze({ name: '梦网', chapters: [{ scenarioId: 'b1' }, { scenarioId: 'b2' }, { scenarioId: 'b3' }, { scenarioId: 'b4' }] }),
})

test('未声明 parts 的战役不出现模式选择；声明后归一化成 A/B 两线', () => {
  assert.equal(modeOptions({ playerCount: 2 }), null)
  assert.equal(supportsModeSelection({}), false)
  assert.equal(supportsModeSelection({ parts }), true)
  const manifest = campaignPartsManifest({ parts })
  assert.deepEqual(Object.keys(manifest).sort(), ['A', 'B'])
  assert.deepEqual(manifest.A.chapters.map(chapter => chapter.pair), [1, 2, 3, 4])
  assert.equal(manifest.B.chapters[0].scenarioId, 'b1')
})

test('四种模式 × 1–4 人的可用性与置灰原因', () => {
  const matrix = {}
  for (const playerCount of [1, 2, 3, 4]) {
    matrix[playerCount] = Object.fromEntries(modeOptions({ playerCount, parts }).map(option => [option.mode, option]))
  }
  for (const mode of MODE_ORDER) for (const count of [1, 2, 3, 4]) {
    const option = matrix[count][mode]
    assert.equal(option.label.length > 0, true)
    if (mode === 'singleA' || mode === 'singleB') assert.equal(option.enabled, true, `${count} 人的 ${mode} 应可用`)
  }
  // 并行：只有偶数人可用；奇数给「需要两组人数相等」。
  assert.equal(matrix[1].parallel.enabled, false)
  assert.match(matrix[1].parallel.reason, /只能进行单线|偶数|两组人数相等/)
  assert.equal(matrix[2].parallel.enabled, true)
  assert.equal(matrix[3].parallel.enabled, false)
  assert.match(matrix[3].parallel.reason, /两组人数相等/)
  assert.equal(matrix[4].parallel.enabled, true)
  // 分选：至少 2 人（两线各 ≥1）；1 人不可用。
  assert.equal(matrix[1].pick.enabled, false)
  for (const count of [2, 3, 4]) assert.equal(matrix[count].pick.enabled, true, `${count} 人的 pick 应可用`)
})

test('默认分线：并行等分、分选交替、单线全在一侧', () => {
  assert.deepEqual([...defaultSeatParts('singleA', 3)], ['A', 'A', 'A'])
  assert.deepEqual([...defaultSeatParts('singleB', 2)], ['B', 'B'])
  assert.deepEqual([...defaultSeatParts('parallel', 4)], ['A', 'A', 'B', 'B'])
  assert.deepEqual([...defaultSeatParts('parallel', 2)], ['A', 'B'])
  assert.deepEqual([...defaultSeatParts('pick', 4)], ['A', 'B', 'A', 'B'])
  assert.deepEqual([...defaultSeatParts('pick', 3)], ['A', 'B', 'A'])
})

test('开局计划：合法模式给出座位计划与活动线，非法模式给原因', () => {
  const single = modePlan({ mode: 'singleA', playerCount: 1 })
  assert.equal(single.ok, true)
  assert.deepEqual([...single.seatParts], ['A'])
  assert.deepEqual(single.activeParts, ['A'])
  assert.equal(single.currentPart, 'A')

  const parallel = modePlan({ mode: 'parallel', playerCount: 4 })
  assert.equal(parallel.ok, true)
  assert.deepEqual([...parallel.seatParts], ['A', 'A', 'B', 'B'])
  assert.deepEqual(parallel.activeParts, ['A', 'B'])
  assert.equal(parallel.currentPart, null)
  assert.deepEqual(parallel.laneCounts, { A: 2, B: 2 })

  const pick = modePlan({ mode: 'pick', playerCount: 3, seatParts: ['A', 'B', 'A'] })
  assert.equal(pick.ok, true)
  assert.deepEqual(pick.laneCounts, { A: 2, B: 1 })
  assert.deepEqual(pick.activeParts, ['A'])

  assert.equal(modePlan({ mode: 'parallel', playerCount: 3 }).ok, false)
  assert.match(modePlan({ mode: 'parallel', playerCount: 3 }).reason, /两组人数相等/)
  assert.equal(modePlan({ mode: 'pick', playerCount: 1 }).ok, false)
  assert.match(modePlan({ mode: 'pick', playerCount: 1 }).reason, /只能进行单线/)
  assert.equal(modePlan({ mode: 'pick', playerCount: 2, seatParts: ['A', 'A'] }).ok, false)
  assert.match(modePlan({ mode: 'pick', playerCount: 2, seatParts: ['A', 'A'] }).reason, /B 线没有座位|两线各至少/)
  assert.equal(modePlan({ mode: 'pick', playerCount: 2, seatParts: ['A'] }).ok, false)
  assert.equal(modePlan({ mode: 'nope', playerCount: 2 }).ok, false)
  assert.throws(() => modePlan({ mode: 'singleA', playerCount: 5 }), /1–4/)
  assert.throws(() => modeOptions({ playerCount: 5, parts }), /1–4/)
})

test('分选改线：只允许 pick；改线后两线都必须 ≥1', () => {
  const ok = assignSeatPart({ mode: 'pick', seatParts: ['A', 'B', 'A'], seat: 2, part: 'B' })
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.seatParts, ['A', 'B', 'B'])
  const emptyLine = assignSeatPart({ mode: 'pick', seatParts: ['A', 'B', 'A'], seat: 1, part: 'A' })
  assert.equal(emptyLine.ok, false)
  assert.match(emptyLine.reason, /B 线没有座位/)
  assert.equal(assignSeatPart({ mode: 'singleA', seatParts: ['A', 'A'], seat: 1, part: 'B' }).ok, false)
  assert.equal(assignSeatPart({ mode: 'parallel', seatParts: ['A', 'B'], seat: 0, part: 'B' }).ok, false)
  assert.equal(assignSeatPart({ mode: 'pick', seatParts: ['A', 'B'], seat: 9, part: 'A' }).ok, false)
  assert.equal(assignSeatPart({ mode: 'pick', seatParts: ['A', 'B'], seat: 0, part: 'C' }).ok, false)
})

test('开局摘要：写清座位、活动线与每座位一套牌组', () => {
  const text = describeModePlan(modePlan({ mode: 'pick', playerCount: 3, seatParts: ['A', 'B', 'A'] }))
  assert.match(text, /分选双线/)
  assert.match(text, /A 线座位 1、3/)
  assert.match(text, /B 线座位 2/)
  assert.match(text, /每座位只建一套牌组/)
  assert.match(describeModePlan(modePlan({ mode: 'parallel', playerCount: 4 })), /并行双线/)
  assert.match(describeModePlan({ ok: false, reason: '人数不足' }), /人数不足/)
})
