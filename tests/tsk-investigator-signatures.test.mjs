// P5 十四张专属依赖卡的统一验收：注册、依赖标记、构筑强制带入、关键机制接线。
import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { getAvailability } from '../src/deck/availability.js'
import { canSelectInvestigator } from '../src/deck/availability.js'

const INVESTIGATORS = ['09001', '09004', '09008', '09011', '09015', '09018']
const SIGNATURES = ['09002', '09003', '09005', '09006', '09007', '09009', '09010',
  '09012', '09013', '09014', '09016', '09017', '09019', '09020']

test('P5 专属依赖 14 张：全部注册为 dependencyOnly，且跟随调查员强制带入', () => {
  for (const code of SIGNATURES) {
    assert.ok(registeredEntry(code), `${code} 必须注册条目`)
    const availability = getAvailability(code)
    assert.equal(availability.dependencyOnly, true, `${code} 必须标记 dependencyOnly`)
    assert.equal(availability.deckbuilding, false, `${code} 不得进入一般构筑池`)
    assert.equal(ALL_CARDS[code].signatureFor?.length, 1, `${code} 必须声明 signatureFor`)
    assert.ok(INVESTIGATORS.includes(ALL_CARDS[code].signatureFor[0]))
  }
  for (const code of INVESTIGATORS) assert.equal(canSelectInvestigator(code), true)
})

test('P5 专属依赖关键机制接线', () => {
  // 技能/事件/支援/敌人/弱点五类的机制读点。
  assert.ok(registeredEntry('09002').abilities.some(descriptor => descriptor.kind === 'commit'))
  assert.ok(registeredEntry('09003').abilities.some(descriptor => [].concat(descriptor.trigger).includes('turnEnded')))
  assert.equal(registeredEntry('09006').zoneReplacement?.discard, 'setAside')
  assert.equal(registeredEntry('09007').weaknessPlaysAsAsset, true)
  assert.equal(registeredEntry('09009').abilities[0].cost.action, 2)
  assert.equal(registeredEntry('09010').enemyWeakness?.prey, true)
  assert.ok(registeredEntry('09012').abilities[0].fast === true)
  assert.ok([].concat(registeredEntry('09013').abilities[0].trigger).includes('testBegins'))
  assert.ok(registeredEntry('09014').abilities.some(descriptor => descriptor.kind === 'weakness'))
  assert.ok(registeredEntry('09016').abilities.filter(descriptor => descriptor.kind === 'reaction').length >= 2)
  assert.ok(registeredEntry('09017').abilities.some(descriptor => descriptor.kind === 'weakness'))
  assert.ok(registeredEntry('09019').abilities.some(descriptor => [].concat(descriptor.trigger).includes('assetExhausted')))
  assert.ok(registeredEntry('09020').abilities.some(descriptor => descriptor.kind === 'weakness'))
})
