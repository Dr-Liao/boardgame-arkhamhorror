// TDE P3 批次 3：多重（Myriad）构筑限制的 Node 验收。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MYRIAD_LIMIT, addCardRespectingMyriad, isMyriad, myriadUsage, validateMyriadLimit,
} from '../src/engine/myriad.js'

const DEFS = {
  '06020': { title: '庄严立誓', myriad: true, text: 'Myriad.' },
  '06021': { title: '一瓣缟玛瑙', keywords: ['Myriad'] },
  '06022': { title: '庄严立誓', myriad: true, text: 'Myriad.' }, // 同名不同号
  '06030': { title: '普通卡' },
  '06031': { title: '普通卡' },
}
const defs = code => DEFS[code] || null

test('识别 Myriad：字段 / keywords / 卡文；常量是 3', () => {
  assert.equal(MYRIAD_LIMIT, 3)
  assert.equal(isMyriad(DEFS['06020']), true)
  assert.equal(isMyriad(DEFS['06021']), true)
  assert.equal(isMyriad(DEFS['06030']), false)
  assert.equal(isMyriad({ text: 'Myriad. Bonded.' }), true)
  assert.equal(isMyriad(null), false)
})

test('同名跨卡号共享 3 张额度', () => {
  const deck = ['06020', '06022', '06020']
  assert.deepEqual(validateMyriadLimit(deck, defs), { ok: true, violations: [] })
  const over = validateMyriadLimit([...deck, '06022'], defs)
  assert.equal(over.ok, false)
  assert.equal(over.violations.length, 1)
  assert.equal(over.violations[0].count, 4)
  assert.deepEqual(over.violations[0].codes.sort(), ['06020', '06020', '06022', '06022'])
})

test('非 Myriad 卡不受此限制（普通同名不在这里拦）', () => {
  const deck = ['06030', '06031', '06030']
  assert.deepEqual(validateMyriadLimit(deck, defs), { ok: true, violations: [] })
})

test('未知卡号跳过（存在性由别的账本管）', () => {
  assert.deepEqual(validateMyriadLimit(['99999', '06020'], defs), { ok: true, violations: [] })
  assert.throws(() => validateMyriadLimit([], null), /cardDefs/)
})

test('加卡：满 3 张拒绝并给原因；未满放行', () => {
  const full = ['06020', '06022', '06020', '06021']
  const rejected = addCardRespectingMyriad(full, '06020', defs)
  assert.equal(rejected.ok, false)
  assert.match(rejected.reason, /Myriad，同名最多 3 张/)
  assert.deepEqual(rejected.deck, full)
  const accepted = addCardRespectingMyriad(['06020'], '06022', defs)
  assert.equal(accepted.ok, true)
  assert.deepEqual(accepted.deck, ['06020', '06022'])
  assert.equal(addCardRespectingMyriad(full, '06030', defs).ok, true, '非 Myriad 不拦')
})

test('myriadUsage 按标题汇总份数与上限', () => {
  const usage = myriadUsage(['06020', '06022', '06021', '06030'], defs)
  assert.deepEqual(usage.map(item => ({ title: item.title, count: item.count, limit: item.limit })), [
    { title: '庄严立誓', count: 2, limit: 3 },
    { title: '一瓣缟玛瑙', count: 1, limit: 3 },
  ])
})

test('构造期不改输入牌组', () => {
  const deck = ['06020']
  addCardRespectingMyriad(deck, '06022', defs)
  assert.deepEqual(deck, ['06020'])
})
