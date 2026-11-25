// 10-a-7（FHV · fhvc 10572–10605）补证/缺陷复现测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { behavior as lostSister } from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js'
import * as lostSisterDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/definition.js'
import { behavior as depthsBehavior } from '../content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/behavior.js'
import * as depthsDef from '../content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/definition.js'
import * as twisted from '../content/campaigns/theFeastOfHemlockVale/scenarios/theTwistedHollow/definition.js'
import akwan from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10575.js'
import hiddenCove from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10577.js'
import weedbeach from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10578.js'
import rocky from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10579.js'
import pools from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10580.js'
import openCave from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10581.js'
import fungal from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10582.js'
import reclaimed from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10586.js'
import luminous from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10587.js'
import moss from '../src/cards/encounter-entries/theFeastOfHemlockVale/theLostSister/10585.js'
import depths from '../src/cards/encounter-entries/theFeastOfHemlockVale/theThingInTheDepths/10600.js'

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
const files = walk('src/cards/encounter-entries/theFeastOfHemlockVale')
const findEntry = code => files.find(f => f.endsWith('/' + code + '.js'))
const contentText = () => walk('content/campaigns/theFeastOfHemlockVale').map(f => fs.readFileSync(f, 'utf8')).join('\n')

test('验收 10572/10573/10574/10588/10589/10590/10591 失踪的姐妹幕与场景参考卡：definition/behavior 读点齐备', () => {
  for (const code of ['10572', '10573', '10574', '10589', '10590', '10591']) {
    assert.ok(findEntry(code), `${code} 单卡条目存在`)
    assert.ok(fs.readFileSync(findEntry(code), 'utf8').includes('scope'), `${code} 条目导出`)
  }
  // 数据型幕/密谋：代码在 definition 中，behavior 有对应分派钩子。
  const defText = fs.readFileSync('content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/definition.js', 'utf8')
  const depthsDefText = fs.readFileSync('content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/definition.js', 'utf8')
  for (const code of ['10572', '10573', '10574']) assert.ok(defText.includes(code), `${code} 在 theLostSister definition`)
  for (const code of ['10589', '10590', '10591']) assert.ok(depthsDefText.includes(code), `${code} 在 theThingInTheDepths definition`)
  for (const hook of ['actReveal', 'agendaReveal', 'checkObjectives']) {
    assert.equal(typeof depthsBehavior[hook], 'function', `theThingInTheDepths behavior.${hook} 读点`)
  }
  for (const hook of ['actReveal', 'agendaReveal', 'checkObjectives', 'locationRevealed', 'actions', 'enemyDefeated']) {
    assert.equal(typeof lostSister[hook], 'function', `theLostSister behavior.${hook} 读点`)
  }
  // 10588 深沼之物 = 场景参考卡（无条目，按约定由 definition 承载）；10572 幕目标读点。
  assert.ok(/theThingInTheDepths|10588/.test(defText + fs.readFileSync('content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/definition.js', 'utf8')), '10588 场景数据存在')
  assert.ok(lostSisterDef, '章节定义可导入')
})

test('验收 10575/10576/10577/10578/10579/10580/10581/10582 岩穴地点：条目声明与 behavior 分派读点', () => {
  for (const entry of [akwan, hiddenCove, weedbeach, rocky, pools, openCave, fungal]) {
    assert.equal(entry.scope, 'location')
    assert.ok(entry.code)
  }
  const behavior = fs.readFileSync('content/campaigns/theFeastOfHemlockVale/scenarios/theLostSister/behavior.js', 'utf8')
  for (const needle of ['lostSisterAkwanParley', 'beforeMove', 'locationEntered', 'actions']) {
    assert.ok(behavior.includes(needle), `theLostSister ${needle} 读点存在`)
  }
  // 真实执行：地点行为读点函数为函数（按章分派）。
  assert.equal(typeof lostSister.actions, 'function')
  assert.equal(typeof lostSister.beforeMove, 'function')
  assert.equal(typeof lostSister.locationEntered, 'function')
})

test('验收 10583a/10583b/10584a/10584b/10585/10586/10587/10600/10601/10602 双面混种与深沼之物：条目/窗口声明齐备', () => {
  const texts = contentText()
  for (const needle of ['flipHybrid', 'syncHybrids', 'hybridFaceFor', 'lostSisterReclaimedByNature', 'groundDisturbanceResolve']) {
    assert.ok(texts.includes(needle), `${needle} 章节读点存在`)
  }
  for (const code of ['10583a', '10583b', '10584a', '10584b', '10601', '10602']) {
    assert.ok(findEntry(code), `${code} 条目存在`)
  }
  assert.equal(reclaimed.scope, 'treachery')
  assert.equal(typeof reclaimed.encounterResolve, 'function', '10586 显现结算入口')
  assert.equal(luminous.scope, 'treachery')
  assert.equal(moss.scope, 'enemy')
  assert.equal(depths.scope, 'enemy')
})

test('验收 10593a/10593b/10594a/10594b/10595a/10595b/10596a/10596b/10597a/10597b/10598a/10598b/10599a/10599b/10603/10604/10605 沉没地点与恐怖谷：数据/行为读点', () => {
  for (const code of ['10593a', '10593b', '10594a', '10594b', '10595a', '10595b', '10596a', '10596b', '10597a', '10597b', '10598a', '10598b', '10599a', '10599b', '10603', '10604']) {
    assert.ok(findEntry(code), `${code} 条目存在`)
  }
  const behavior = fs.readFileSync('content/campaigns/theFeastOfHemlockVale/scenarios/theThingInTheDepths/behavior.js', 'utf8')
  for (const needle of ['locationEntered', 'moveError', 'afterInvestigate', 'afterTest', 'groundDisturbanceResolve', 'sinkingSludgeResolve']) {
    assert.ok(behavior.includes(needle), `theLostSister ${needle} 读点`)
  }
  assert.ok(twisted && typeof twisted === 'object', '10605 扭曲空洞 definition 可导入')
  assert.ok(depthsDef && typeof depthsDef === 'object', '10588 深沼之物 definition 可导入')
})

test('验收 10575/10577/10578/10580/10581/10583b/10585/10586/10587/10592/10600 缺陷复现：旗标无读点/近似不等价', () => {
  const root = 'content/campaigns/theFeastOfHemlockVale'
  const texts = walk(root).map(f => fs.readFileSync(f, 'utf8')).join('\n')
  // 地点失败窗口只用旗标，P8 未接线。
  for (const flag of ['attackFailedDamage', 'evadeFailedLoseAction', 'investigateFailedHorror']) {
    assert.equal(texts.includes(flag), false, `${flag} 无行为读点（仅条目旗标）`)
  }
  // 10578 用不存在的 token API（runtime 只有 revealToken）。
  const runtime = fs.readFileSync('src/engine/scenario-runtime.js', 'utf8')
  assert.equal(/revealChaosToken\s*:/.test(runtime), false, '10578 依赖的 revealChaosToken 运行时不存在')
  assert.ok(texts.includes('revealChaosToken') || texts.includes('drawChaosToken'), '10578 仍调用不存在 token API')
  // 10586 昼夜判定依赖 isDarkLocationHere（运行时无该方法 → 恒为白日）。
  assert.equal(/isDarkLocationHere\s*:/.test(runtime), false, '10586 依赖的 isDarkLocationHere 运行时不存在')
  assert.match(fs.readFileSync(findEntry('10586'), 'utf8'), /isDarkLocationHere/, '10586 仍以 isDarkLocationHere 判昼夜')
  // 10587 无 encounterResolve（显现目标/弃卡留给 P8）。
  assert.equal(findEntry('10587') && fs.readFileSync(findEntry('10587'), 'utf8').includes('encounterResolve'), false, '10587 无显现结算入口')
  // 10575/10581/10592/10600 条目 note 披露未实现子句。
  assert.match(fs.readFileSync(findEntry('10575'), 'utf8'), /重排|P8|原顺序/, '10575 谈判重排未实现')
  assert.match(fs.readFileSync(findEntry('10581'), 'utf8'), /\[fast\]|近似/, '10581 fast 时机近似')
  assert.match(fs.readFileSync(findEntry('10592'), 'utf8'), /近似/, '10592 改巡逻近似')
  assert.match(fs.readFileSync(findEntry('10600'), 'utf8'), /未接线/, '10600 攻击后治愈未接线')
  assert.match(fs.readFileSync(findEntry('10583b'), 'utf8'), /P8|旗标/, '10583b 自伤窗口未接线')
  assert.match(fs.readFileSync(findEntry('10585'), 'utf8'), /未在 behavior 复写|旗标/, '10585 附属道具规则未接线')
})
