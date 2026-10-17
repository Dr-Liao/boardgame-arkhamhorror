import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CORE_ACCEPTANCE_SHA256, coreCardVerified } from '../src/cards/core-acceptance.js'
import { allCardDefs } from '../src/engine/engine.js'
import { getAvailability } from '../src/deck/availability.js'

test('Core 验收清单严格对应183条原始基础包记录及行为测试，不波及扩展',()=>{
  const url=new URL('../audit/core-acceptance.json',import.meta.url), bytes=fs.readFileSync(url)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),CORE_ACCEPTANCE_SHA256)
  const ledger=JSON.parse(bytes)
  const expected=Object.values(ALL_CARDS).filter(c=>c.pack==='core'&&!['01000','98004'].includes(c.code)).map(c=>c.code).sort()
  assert.equal(expected.length,183); assert.deepEqual(ledger.entries.map(e=>e.code).sort(),expected)
  for(const e of ledger.entries) {
    assert.ok(e.evidence.length); assert.ok(coreCardVerified(e.code)); assert.equal(ALL_CARDS[e.code].effectStatus,'verified')
    assert.equal(getAvailability(e.code).availability,'strict')
  }
  for(const f of ledger.testFiles) {
    const bytes=fs.readFileSync(new URL('../../../'+f.file,import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,`Stale evidence: ${f.file}`)
  }
  assert.ok(!coreCardVerified('02020')); assert.ok(!coreCardVerified('01000')); assert.ok(!coreCardVerified('98004'))
})

test('Core 随机地点和运行时遭遇别名均继承实际卡牌的验收状态',()=>{
  const defs=allCardDefs()
  for(const code of ['01127','01131']) {
    assert.equal(defs[code].effectStatus,'verified')
    assert.ok(ALL_CARDS[code].scenarioReferences.some(r=>r.category==='locations'))
  }
  for(const code of ['ghoulMinion','rottingRemains','dreamsOfRlyeh','01117']) assert.equal(defs[code].effectStatus,'verified',code)
  assert.equal(defs['01121b'].effectStatus,'verified')
})
