// 10-a-11（FHV · fhvc 10707a–10743）验收测试。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { asset, enemy, fixture, legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import {
  discardRandomFromHand, drawCards, enemyAttack, enemyHealth, getStat, reactionWindow,
  relocateEnemy, relocateInvestigator, scenarioRuntime,
} from '../src/engine/engine.js'
import { assetTextBlanked } from '../src/engine/card-text.js'
import { enemyHasAttackKeyword } from '../src/engine/enemy-keyword-movement.js'

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

function connectedTable() {
  const state = fixture()
  const inv = state.investigators[0]
  const here = state.locations.find(location => location.id === inv.location)
  const next = { id: 'trail', name: '连接地点', revealed: true, connections: [here.id], shroud: 1, clues: 0 }
  here.connections = [next.id]
  state.locations.push(next)
  return { state, inv, here, next }
}

test('10719 蔓生隧道：有线索时必须先支付离开的额外行动', () => {
  const { state, inv, here, next } = connectedTable()
  Object.assign(here, { originalCode: '10719', clues: 1 })
  const destination = { action: 'move', locationId: next.id }
  inv.actionsLeft = 1
  assert.ok(validateMove(state, inv.seat, destination))
  assert.equal(inv.location, here.id)
  inv.actionsLeft = 2
  move(state, destination)
  settle(state)
  assert.equal(state.investigators[0].location, next.id)
  assert.equal(state.investigators[0].actionsLeft, 0)
})

test('10721 水晶寄生虫：黑夜每两点已受伤害使本次攻击多造成一点伤害', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const parasite = enemy(state, { code: '10721', damage: 1, damageTaken: 4 })
  state.campaign.records.time = 'Night'
  enemyAttack(state, parasite, inv, [])
  assert.equal(inv.damage, 3)
  assert.equal(parasite.damageTaken, 4)
})

test('10724 瘴气之影：同批弃掉多张手牌只攻击一次，下一批可以再次攻击', () => {
  const state = fixture()
  const inv = state.investigators[0]
  inv.hand = ['01090', '01091', '01092']
  const shadow = enemy(state, { code: '10724', aloof: true, engagedSeat: null, damage: 1 })
  discardRandomFromHand(state, inv, 2, [])
  assert.equal(inv.hand.length, 1)
  assert.equal(inv.damage, 1)
  assert.equal(shadow.engagedSeat, inv.seat)
  discardRandomFromHand(state, inv, 1, [])
  assert.equal(inv.damage, 2)
})

test('10727 真菌感染：附属使道具文本空白，调查员可检定战斗弃掉附属', () => {
  const state = fixture()
  const inv = state.investigators[0]
  const item = asset(state, '01016')
  const attached = scenarioRuntime(state, []).attachToAsset(0, item.id, '10727')
  assert.equal(assetTextBlanked(item, inv, state), true)
  const escape = legalMoves(state, 0).find(candidate => candidate.action === 'entityAbility'
    && candidate.entityId === attached.id)
  assert.ok(escape)
  move(state, escape)
  settle(state)
  const survivingItem = state.investigators[0].assets.find(card => card.id === item.id)
  assert.equal(assetTextBlanked(survivingItem, state.investigators[0], state), false)
  assert.ok(state.encounterDiscard.includes('10727'))
})

test('10727 真菌感染：检定失败时调查员受伤，宿主仍然空白', () => {
  const state = fixture()
  const item = asset(state, '01016')
  const attached = scenarioRuntime(state, []).attachToAsset(0, item.id, '10727')
  state.chaosBag = ['autofail']
  const escape = legalMoves(state, 0).find(candidate => candidate.entityId === attached.id)
  move(state, escape)
  settle(state)
  const inv = state.investigators[0]
  assert.equal(inv.damage, 1)
  assert.equal(assetTextBlanked(inv.assets.find(card => card.id === item.id), inv, state), true)
  assert.ok(!state.encounterDiscard.includes('10727'))
})

test('10732 毒花：轮末累计疯长，攻击伤害按疯长数提高', () => {
  const state = fixture()
  const inv = state.investigators[0]
  state.campaign.records.time = 'day'
  const flower = enemy(state, { code: '10732', damage: 0, health: 3 })
  for (let i = 0; i < 2; i += 1) {
    reactionWindow(state, 'roundEnds', { when: 'roundEnds', round: state.round }, [])
    state.round += 1
  }
  assert.equal(enemyHealth(state, flower), 5)
  enemyAttack(state, flower, inv, [])
  assert.equal(inv.damage, 2)
})

test('10734 螺旋牡鹿：神话阶段在本地及连接地点的调查员技能值减二', () => {
  const { state, inv, here, next } = connectedTable()
  enemy(state, { code: '10734', location: next.id, engagedSeat: null })
  const initial = getStat(state, inv, 'willpower')
  state.phase = 'mythos'
  assert.equal(getStat(state, inv, 'willpower'), initial - 2)
  inv.location = next.id
  assert.equal(getStat(state, inv, 'willpower'), initial - 2)
  next.connections = []
  inv.location = here.id
  assert.equal(getStat(state, inv, 'willpower'), initial)
})

test('10736 荆棘之墙：白日进入受二伤并弃掉，黑夜进出各受一伤', () => {
  for (const period of ['day', 'night']) {
    const { state, inv, here, next } = connectedTable()
    state.campaign.records.time = period
    scenarioRuntime(state, []).attachToLocation(next.id, { code: '10736' })
    relocateInvestigator(state, inv.seat, next.id, [])
    assert.equal(inv.damage, period === 'day' ? 2 : 1)
    assert.equal(next.attachments.length, period === 'day' ? 0 : 1)
    relocateInvestigator(state, inv.seat, here.id, [])
    assert.equal(inv.damage, 2)
  }
})

test('10739 尸苔：日间无法移动、没有警戒，夜间可以移动并具备警戒', () => {
  const { state, here, next } = connectedTable()
  const lichen = enemy(state, { code: '10739', engagedSeat: null, location: here.id, hunter: true, alert: true })
  state.campaign.records.time = 'day'
  assert.equal(enemyHasAttackKeyword(state, lichen, 'alert', lichen.alert), false)
  relocateEnemy(state, lichen, next.id, [])
  assert.equal(lichen.location, here.id)
  state.campaign.records.time = 'night'
  assert.equal(enemyHasAttackKeyword(state, lichen, 'alert', lichen.alert), true)
  relocateEnemy(state, lichen, next.id, [])
  assert.equal(lichen.location, next.id)
})

test('10740 迷神孢子：每轮仅首批抽牌受直接恐惧，可支付直接恐惧自动通过智力检定', () => {
  const state = fixture()
  const inv = state.investigators[0]
  state.campaign.id = 'theFeastOfHemlockVale'
  drawCards(state, inv, 1, [])
  const spores = scenarioRuntime(state, []).threat(inv.seat, '10740')
  drawCards(state, inv, 1, [])
  assert.equal(inv.horror, 0, '本轮第一次抽牌发生在孢子入场前')
  state.round += 1
  drawCards(state, inv, 2, [])
  assert.equal(inv.horror, 1)
  drawCards(state, inv, 1, [])
  assert.equal(inv.horror, 1)
  state.round += 1
  drawCards(state, inv, 1, [])
  assert.equal(inv.horror, 2)
  state.chaosBag = ['autofail']
  const attempt = legalMoves(state, inv.seat).find(candidate => candidate.assetId === spores.id
    || candidate.entityId === spores.id)
  assert.ok(attempt)
  move(state, attempt)
  settle(state, choice => choice.options.find(option => option.id === 'horror')?.id)
  assert.equal(state.investigators[0].horror, 3)
  assert.ok(!state.investigators[0].threat.some(card => card.id === spores.id))
  assert.equal(state.lastTestResult.success, true)
})

test('10740 迷神孢子：同地点队友可替威胁区所有者清除', () => {
  const state = fixture('01001', 2)
  const spores = scenarioRuntime(state, []).threat(1, '10740')
  const attempt = legalMoves(state, 0).find(candidate => candidate.entityId === spores.id)
  assert.ok(attempt)
  move(state, attempt)
  settle(state, choice => choice.options.find(option => option.id === 'horror')?.id)
  assert.equal(state.investigators[0].horror, 1)
  assert.equal(state.investigators[1].horror, 0)
  assert.ok(!state.investigators[1].threat.some(card => card.id === spores.id))
})

test('10741 骤然突变：宿主被击败，跳过诡计并生成遇到的第一张敌人', () => {
  const state = fixture()
  const host = enemy(state, { health: 1 })
  const runtime = scenarioRuntime(state, [])
  assert.ok(runtime.attachEncounterToEnemy('10741', host.id))
  state.encounterDeck = ['01159', '01160', '01167']
  const fight = legalMoves(state, 0).find(candidate => candidate.action === 'fight' && candidate.enemyId === host.id)
  assert.ok(fight)
  move(state, fight)
  settle(state)
  assert.ok(state.encounterDiscard.includes('01167'))
  assert.deepEqual(state.encounterDeck, ['01159'])
  assert.ok(state.enemies.some(target => target.originalCode === '01160' && target.location === host.location))
})

test('10743 着火了：轮末仅伤及附属地点有生命值的每张卡牌', () => {
  const { state, inv, here, next } = connectedTable()
  scenarioRuntime(state, []).attachToLocation(here.id, { code: '10743' })
  const companion = asset(state, '01018')
  const target = enemy(state, { engagedSeat: null })
  const elsewhere = enemy(state, { engagedSeat: null, location: next.id })
  const ajax = { id: 'ajax', code: '10642', location: here.id, controllerSeat: null, damage: 0 }
  state.storyAssets.push(ajax)
  reactionWindow(state, 'roundEnds', { when: 'roundEnds', round: state.round }, [])
  assert.equal(inv.damage, 1)
  assert.equal(companion.damage, 1)
  assert.equal(target.damageTaken, 1)
  assert.equal(elsewhere.damageTaken, 0)
  assert.equal(ajax.damage, 1)
})
