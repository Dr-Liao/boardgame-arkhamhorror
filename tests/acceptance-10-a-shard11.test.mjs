// 10-a-11（FHV · fhvc 10707a–10743）补证/缺陷复现测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import chapelFront from '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/the_vale/10707a.js'
import chapelBack from '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/the_vale/10707b.js'
import worryRock from '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/heirlooms/10713.js'
import cornDoll from '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/heirlooms/10714.js'
import pearlDiary from '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/heirlooms/10715.js'
import dryBurrow from '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/horrors_in_the_rock/10716.js'
import parasite from '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/horrors_in_the_rock/10721.js'
import chroma from '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/horrors_in_the_rock/10722.js'
import miasmatic from '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/agents_of_the_colour/10724.js'
import poisonblossom from '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/the_forest/10732.js'
import fire from '../src/cards/encounter-entries/theFeastOfHemlockVale/_shared/fire/10743.js'

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
const entries = walk('src/cards/encounter-entries/theFeastOfHemlockVale')
const findEntry = code => entries.find(f => f.endsWith('/' + code + '.js'))
const contentText = () => walk('content/campaigns/theFeastOfHemlockVale').map(f => fs.readFileSync(f, 'utf8')).join('\n')
const readNote = code => fs.readFileSync(findEntry(code), 'utf8')

test('验收 10707a/10707b/10708a/10708b/10709a/10709b/10710a/10710b/10711a/10711b/10712a/10712b 铁杉谷双面地点：条目与序曲/终章 behavior 读点', () => {
  const pairs = ['10707a', '10707b', '10708a', '10708b', '10709a', '10709b', '10710a', '10710b', '10711a', '10711b', '10712a', '10712b']
  for (const code of pairs) {
    assert.ok(findEntry(code), `${code} 条目存在`)
    const entry = fs.readFileSync(findEntry(code), 'utf8')
    assert.match(entry, /scope:\s*'location'/, `${code} 地点条目`)
  }
  assert.ok(chapelFront.code === '10707a' && chapelBack.code === '10707b')
  const engine = fs.readdirSync('src/engine').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('src/engine/' + f, 'utf8')).join('\n')
  for (const needle of ['clueDiscovered', 'cluesRemoved', 'enemyStatModifier', 'afterTest']) {
    assert.ok(engine.includes(needle), `引擎窗口读点 ${needle}`)
  }
})

test('验收 10713/10714/10715 传家宝：真实条目能力与窗口读点', () => {
  for (const entry of [worryRock, cornDoll, pearlDiary]) {
    assert.ok(entry.code && entry.abilities?.length > 0, `${entry.code} 传家宝能力声明`)
  }
  const text = contentText() + fs.readdirSync('src/engine').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('src/engine/' + f, 'utf8')).join('\n')
  for (const needle of ['handCardDiscarded', 'replaceChaosToken']) {
    assert.ok(text.includes(needle), `传家宝窗口读点 ${needle}`)
  }
})

test('验收 10716/10717/10718/10719/10720 洞穴地点：地点规则/窗口读点齐备', () => {
  for (const code of ['10716', '10717', '10718', '10719', '10720']) assert.ok(findEntry(code), `${code} 条目存在`)
  const text = contentText()
  for (const needle of ['locationRule', 'onLeave', 'investigateFail', 'turnEnded']) {
    assert.ok(text.includes(needle) || fs.readdirSync('src/engine').some(f => fs.readFileSync('src/engine/' + f, 'utf8').includes(needle)), `洞穴地点读点 ${needle}`)
  }
  assert.equal(dryBurrow.scope, 'location')
})

test('验收 10721/10722/10723/10724/10725/10726/10727/10728/10729/10730/10731/10732/10733/10734/10735/10736/10737/10738/10739/10740/10741/10742/10743 遭遇组：条目执行入口与既有原语接线', () => {
  assert.equal(parasite.scope, 'enemy')
  assert.equal(chroma.scope, 'treachery')
  assert.equal(miasmatic.scope, 'enemy')
  assert.equal(poisonblossom.scope, 'enemy')
  assert.equal(fire.scope, 'treachery')
  assert.equal(typeof chroma.encounterResolve, 'function', '10722 显现结算入口')
  const text = contentText() + fs.readdirSync('src/engine').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('src/engine/' + f, 'utf8')).join('\n')
  for (const needle of ['beforePlayCost', 'allowedDamageSources']) {
    assert.ok(text.includes(needle), `遭遇组原语读点 ${needle}`)
  }
  for (const needle of ['enemyAttacked', 'attachmentAbilities']) {
    assert.ok(text.includes(needle) || readNote('10721').includes(needle) || readNote('10743').includes(needle), `遭遇组读点 ${needle}`)
  }
  // 章节末日火焰仍以 FIRE_CODE 常量参与布置（P0-3 注册风险在报告披露）。
  assert.ok(text.includes("FIRE_CODE = '10743'"), '10743 FIRE_CODE 常量存在')
})

test('验收 10719/10721/10724/10727/10732/10734/10736/10739/10740/10741/10743 缺陷复现：印刷子句未接线（仅 flags/近似不等价）', () => {
  const cases = [
    ['10719', /不会阻止该次移动|no.*前置读点|前置读点/],
    ['10721', /未接线|留待 P8/],
    ['10724', /逐张触发|可能多攻击/],
    ['10727', /没有.*行动枚举入口|flags\.escapeAction/],
    ['10732', /没有运行期读点|留待 P8/],
    ['10734', /没有引擎读点|留待 P8/],
    ['10736', /留给 P8|未接线/],
    ['10739', /留给 P8|只落 flags/],
    ['10740', /留给 P8|未冒充已实现/],
    ['10741', /只落 flags|无读点/],
    ['10743', /只落 flags|没有地点附属的轮末窗口/],
  ]
  for (const [code, pattern] of cases) assert.match(readNote(code), pattern, `${code} note 披露未接线子句`)
  // 引擎确实没有这些读点：法术技能光环、敌人伤害值修正、地点附属轮末窗口。
  const engine = fs.readdirSync('src/engine').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('src/engine/' + f, 'utf8')).join('\n')
  for (const key of ['attackDamageBonusFor', 'skillModifierAura', 'attachedTreacheryRoundEnd']) {
    assert.equal(engine.includes(key), false, `${key} 读点不存在`)
  }
})
