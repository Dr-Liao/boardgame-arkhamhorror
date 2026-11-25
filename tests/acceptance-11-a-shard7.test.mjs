// 11-a-7（TDC · tdcc 11619–11659）补证/缺陷复现测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import * as courtDef from '../content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/definition.js'
import { behavior as court } from '../content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/behavior.js'
import * as obsidianDef from '../content/campaigns/theDrownedCity/scenarios/obsidianCanyons/definition.js'
import { behavior as obsidian } from '../content/campaigns/theDrownedCity/scenarios/obsidianCanyons/behavior.js'
import altar from '../src/cards/encounter-entries/theDrownedCity/courtOfTheAncients/11623.js'
import shard from '../src/cards/encounter-entries/theDrownedCity/courtOfTheAncients/11638.js'
import winds from '../src/cards/encounter-entries/theDrownedCity/obsidianCanyons/11640.js'
import streets from '../src/cards/encounter-entries/theDrownedCity/obsidianCanyons/11648.js'
import spire from '../src/cards/encounter-entries/theDrownedCity/obsidianCanyons/11649.js'
import cliff from '../src/cards/encounter-entries/theDrownedCity/obsidianCanyons/11655.js'

const walk = root => {
  const out = []
  const step = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = d + '/' + e.name
      if (e.isDirectory()) step(p); else if (p.endsWith('.js')) out.push(p)
    }
  }
  step(root)
  return out
}
const entries = walk('src/cards/encounter-entries/theDrownedCity')
const findEntry = code => entries.find(f => f.endsWith('/' + code + '.js'))
const engineText = () => fs.readdirSync('src/engine').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('src/engine/' + f, 'utf8')).join('\n')
const obsidianText = () => walk('content/campaigns/theDrownedCity/scenarios/obsidianCanyons').map(f => fs.readFileSync(f, 'utf8')).join('\n')

test('验收 11619/11620/11621/11622/11622b/11623/11624/11625/11626/11627/11628/11629/11630/11631/11632/11633/11634/11635/11636/11637/11638 古代法庭：条目与 definition/behavior 读点', () => {
  for (const code of ['11619', '11620', '11621', '11622', '11622b', '11623', '11624', '11625', '11626', '11627', '11628', '11629', '11630', '11631', '11632', '11633', '11634', '11635', '11636', '11637', '11638']) {
    assert.ok(findEntry(code), `${code} 条目存在`)
  }
  const defText = fs.readFileSync('content/campaigns/theDrownedCity/scenarios/courtOfTheAncients/definition.js', 'utf8')
  for (const code of ['11619', '11620', '11622', '11623', '11626', '11632', '11633', '11634', '11636']) assert.ok(defText.includes(code), `${code} 在 definition`)
  for (const hook of ['enemyAttackResolved', 'enemyDefeated', 'actions', 'performAction']) {
    assert.equal(typeof court[hook], 'function', `court behavior.${hook} 读点`)
  }
  assert.equal(altar.code, '11623')
  assert.equal(shard.code, '11638')
  assert.ok(shard.abilities?.length > 0, '11638 剧情资产能力声明')
  const engine = engineText()
  for (const key of ['entryToll', 'ignoreFirstAttack', 'encounterCardsDiscardedFromTop']) assert.ok(engine.includes(key), `引擎原语 ${key}`)
  assert.ok(courtDef && typeof courtDef === 'object')
})

test('验收 11639/11640/11640b/11641/11642/11643/11644/11645/11646/11647/11648/11649/11650 黑曜石峡谷场景/风卡/幕/议程/地点：读点齐备', () => {
  for (const code of ['11640', '11640b', '11641', '11642', '11643', '11644', '11645', '11646', '11647', '11648', '11649', '11650']) {
    assert.ok(findEntry(code), `${code} 条目存在`)
  }
  const defText = fs.readFileSync('content/campaigns/theDrownedCity/scenarios/obsidianCanyons/definition.js', 'utf8')
  for (const code of ['11639', '11640', '11641', '11642', '11643', '11644', '11645', '11646', '11647']) assert.ok(defText.includes(code), `${code} 在 obsidianCanyons definition`)
  for (const hook of ['roundEnded', 'blowWinds', 'agendaReveal', 'checkObjectives', 'actReveal', 'actions', 'performAction']) {
    assert.equal(typeof obsidian[hook], 'function', `obsidian behavior.${hook} 读点`)
  }
  assert.equal(winds.code, '11640')
  assert.equal(streets.code, '11648')
  assert.equal(spire.code, '11649')
  assert.match(fs.readFileSync(findEntry('11649'), 'utf8'), /entryToll/, '11649 入场费读点声明')
})

test('验收 11651/11652/11653/11654/11655/11656/11657/11658/11659 黑曜石地点：行为分派函数存在且条目声明齐备', () => {
  for (const code of ['11651', '11652', '11653', '11654', '11655', '11656', '11657', '11658', '11659']) assert.ok(findEntry(code), `${code} 条目存在`)
  const text = obsidianText()
  for (const needle of ['obsidianSearchSpires', 'obsidianTakeSkyRelic', 'obsidianHangingShipSlide', 'dazzlingSkylineAction', 'obsidianGlyphTranslate', 'turnEnded']) {
    assert.ok(text.includes(needle), `obsidian 读点 ${needle}`)
  }
  assert.equal(cliff.code, '11655')
  assert.match(fs.readFileSync(findEntry('11651'), 'utf8'), /cannotLeavePlay|cannotBeMoved/, '11651 不能移动/离场声明')
})

test('验收 11651/11652 缺陷复现：撤退行动无读点（11652 条目自述未接）', () => {
  const text = obsidianText()
  assert.equal(/resignAvailable|retreat/i.test(text), false, '黑曜石峡谷 behavior 无撤退/撤离行动读点')
  assert.match(fs.readFileSync(findEntry('11652'), 'utf8'), /撤退未接/, '11652 条目自述撤退未接')
})
