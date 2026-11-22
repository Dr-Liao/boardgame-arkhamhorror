import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { getAvailability } from '../src/deck/availability.js'
import { deckBuilderData, drawBasicWeaknesses } from '../src/deck/deckbuilding.js'
import { applyHarm, basicWeaknessPool, createGameState, damageEnemy, drawCards, enemyAttack, getStat, performTest, turnBeginningWindow } from '../src/engine/engine.js'
import { createEffect, expireEffects } from '../src/engine/effect-state.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { manifest as tfaPlayerPack } from '../content/packs/tfaPlayer/manifest.js'
import { purchaseCard, replacementOptions } from '../src/campaign/campaign.js'
import { canonicalCode } from '../src/integration/arkhamdb.js'
import { registeredEntry } from '../src/engine/ability.js'
import { asset, enemy, fixture, move, play, settle, use } from './core-fixture.mjs'

const owner = state => state.investigators[0]
const byCard = (pending, code) => pending.options.find(option => option.cardCode === code)?.id

function transact(state, execute, choose) {
  const command = { action: 'starterFixture' }
  resolveTransaction(state, 0, command, execute)
  for (let step = 0; state.pendingChoice; step++) {
    const pending = state.pendingChoice
    assert.ok(step < 25, pending.prompt)
    const optionId = choose?.(pending) ?? pending.options.find(option => option.id === 'skip')?.id ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

test('失落的时代已验收基础弱点可用于构筑的指定随机池', () => {
  const pool = tfaPlayerPack.basicWeaknessCodes
  assert.deepEqual(pool, ['04038', '04040'])
  for (const [index, code] of pool.entries()) {
    assert.ok(!basicWeaknessPool().includes(code))
    assert.deepEqual(drawBasicWeaknesses(INVESTIGATORS['01001'], () => index / pool.length, pool), [code])
    assert.equal(getAvailability(code).deckbuilding, false)
  }
})

test('饥饿霉菌从研究记录解锁，同名基础形态可升级，存档往返保留前置条件', () => {
  const state = fixture('01002')
  const campaign = state.campaign
  const record = campaign.investigators[0]
  const base = '10044'
  const upgrades = ['10059', '10060', '10061']
  const replaceIndex = record.deck.findIndex(code => ALL_CARDS[code]?.type === 'asset' && !ALL_CARDS[code]?.signatureFor)
  assert.ok(replaceIndex >= 0)
  record.deck.splice(replaceIndex, 1, base)
  record.xp = 6
  campaign.phase = 'interlude'
  const pool = deckBuilderData().cardPool

  for (const code of upgrades) {
    assert.equal(pool.find(card => card.code === code)?.upgradeOnly, true)
    assert.deepEqual(replacementOptions(record, code, campaign.records), [])
  }
  campaign.records.classifiedNewSpecies = true
  const restored = JSON.parse(JSON.stringify(campaign))
  for (const code of upgrades) {
    assert.deepEqual(replacementOptions(restored.investigators[0], code, restored.records).map(option => option.code), [base])
  }
  const purchase = purchaseCard(restored, 0, upgrades[0], base)
  assert.equal(purchase.cost, 4)
  assert.ok(restored.investigators[0].deck.includes(upgrades[0]))
  assert.deepEqual(replacementOptions(restored.investigators[0], upgrades[1], restored.records), [])
})

test('纳撒尼尔可以通过构筑目录开局，签名牌和敌人弱点各加入一张', () => {
  const builder = deckBuilderData()
  const investigator = builder.investigators.find(card => card.code === '60101')
  assert.ok(investigator.allowedCards.includes('60105'))
  assert.ok(investigator.allowedCards.includes('60115'))
  assert.deepEqual(investigator.signatureCards.map(card => card.code), ['60102'])
  assert.deepEqual(investigator.signatureWeaknesses.map(card => card.code), ['60103'])
  assert.equal(getAvailability('60106').deckbuilding, true)
  const state = fixture('60101')
  const deck = state.campaign.investigators[0].deck
  for (const code of ['60102', '60103']) assert.equal(deck.filter(item => item === code).length, 1)
  assert.ok(basicWeaknessPool(state, '60101').includes('60104'))
})

test('大厅保存纳撒尼尔的手动构筑时保留签名与弱点依赖', () => {
  const state = createGameState({ campaignHub: true, seed: 'starter-edit-deck' }, [{ seat: 0, role: 'human' }])
  move(state, { action: 'hubGoSetup' })
  move(state, { action: 'hubSelectInvestigator', code: '60101' })
  move(state, { action: 'hubAutoDeck' })
  const ordinary = state.campaign.investigators[0].deck.filter(code => getAvailability(code).deckbuilding)
  assert.equal(ordinary.length, 30)
  move(state, { action: 'hubSetDeck', codes: ordinary })
  move(state, { action: 'hubConfirmDeck' })
  const { deck } = state.campaign.investigators[0]
  assert.equal(deck.length, 33)
  assert.ok(deck.includes('60102') && deck.includes('60103'))
  assert.equal(deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness').length, 1)
})

test('兰德尔入场后从弃牌堆付费打出武器，查找时保留手里的武器', () => {
  const state = fixture('60101')
  owner(state).discard.push('01018', '01016')
  owner(state).hand.push('01046')
  const resources = owner(state).resources
  play(state, '60102')
  settle(state, pending => byCard(pending, '60102') ?? byCard(pending, '01016'))
  assert.deepEqual(owner(state).assets.map(card => card.code), ['60102', '01016'])
  assert.equal(owner(state).resources, resources - ALL_CARDS['60102'].cost - ALL_CARDS['01016'].cost)
  assert.deepEqual(owner(state).discard, ['01018'])
  assert.deepEqual(owner(state).hand, ['01046'])
})

test('事件增伤每阶段一次，弱点响应每个伤害包一次，敌人弱点逐包封顶', () => {
  const state = fixture('60101')
  const target = enemy(state, { health: 12 })
  const capped = enemy(state, { code: '60103', health: 8 })
  owner(state).threat.push({ id: 'starter-threat', code: '60104' })
  const hit = (id, amount, source) => transact(state,
    draft => damageEnemy(draft, draft.enemies.find(card => card.id === id), amount, 0, [], source),
    pending => byCard(pending, '60101'))
  hit(target.id, 2, '01024')
  assert.equal(state.enemies.find(card => card.id === target.id).damageTaken, 3)
  assert.equal(owner(state).damage, 1)
  hit(target.id, 2, '01024')
  assert.equal(state.enemies.find(card => card.id === target.id).damageTaken, 5)
  hit(capped.id, 3, '01016')
  assert.equal(state.enemies.find(card => card.id === capped.id).damageTaken, 1)
  assert.equal(owner(state).damage, 3)
})

test('拳击手套检索灵体事件，击败敌人后打出荣耀抽两张牌', () => {
  const state = fixture('60101')
  const gloves = asset(state, '60105')
  owner(state).deck = ['01088', '01086', '60115']
  const target = enemy(state, { health: 1, fight: 5 })
  move(state, { action: 'fight', enemyId: target.id })
  settle(state, pending => byCard(pending, '60105') ?? byCard(pending, '60115'))
  assert.equal(state.lastTestResult.success, true)
  assert.ok(owner(state).assets.find(card => card.id === gloves.id).exhausted)
  assert.equal(owner(state).hand.length + owner(state).deck.length, 3)
  assert.ok(owner(state).hand.includes('60115') || owner(state).discard.includes('60115'))
  if (owner(state).hand.includes('60115')) {
    const second = enemy(state, { health: 1, fight: 0 })
    move(state, { action: 'fight', enemyId: second.id })
    settle(state, pending => byCard(pending, '60115'))
  }
  assert.deepEqual(owner(state).hand.slice().sort(), ['01086', '01088'])
  assert.ok(owner(state).discard.includes('60115'))
})

test('哈维所在地点的抽牌反应每轮一次，基础弱点在回合开始只弃一张非弱点', () => {
  const state = fixture('60201', 2)
  state.investigators[1].location = owner(state).location
  transact(state, draft => drawCards(draft, draft.investigators[1], 2, []), pending => byCard(pending, '60201'))
  assert.equal(state.investigators[1].hand.length, 3)
  transact(state, draft => drawCards(draft, draft.investigators[1], 1, []), pending => byCard(pending, '60201'))
  assert.equal(state.investigators[1].hand.length, 4)

  owner(state).hand = ['01088', '01088', '60203']
  owner(state).deck.push('60204')
  transact(state, draft => drawCards(draft, owner(draft), 1, []))
  assert.ok(owner(state).threat.some(card => card.code === '60204'))
  state.currentSeat = 0
  transact(state, draft => turnBeginningWindow(draft, []))
  assert.deepEqual(owner(state).hand, ['01088', '60203'])
})

test('威妮弗雷德的专属弱点会投入并扣除技能值，成功后返回手牌', () => {
  const state = fixture('60301')
  owner(state).hand = ['60303']
  let result
  transact(state, draft => { result = performTest(draft, 0, 'agility', 1, {}, []) })
  assert.equal(state.lastTestResult.value, 4)
  assert.ok(result.committed.some(card => (card.code ?? card) === '60303'))
  assert.deepEqual(owner(state).hand, ['60303'])
})

test('斯特拉的三张签名技能随构筑加入，取消失败效果而且仍触发她的反应', () => {
  for (const token of ['-5', 'autofail']) {
    const state = fixture('60501')
    const deck = state.campaign.investigators[0].deck
    assert.equal(deck.filter(code => code === '60502').length, 3)
    assert.equal(deck.filter(code => code === '60503').length, 1)
    const foe = enemy(state, { fight: 8, retaliate: true, damage: 1 })
    state.chaosBag = [token]
    owner(state).hand = ['60502', '60526']
    const actions = owner(state).actionsLeft
    move(state, { action: 'fight', enemyId: foe.id })
    settle(state, pending => pending.kind === 'commit' ? pending.options.find(option => option.id === '0')?.id
      : byCard(pending, '60501'))
    assert.equal(state.lastTestResult.success, false)
    assert.equal(owner(state).damage, 0)
    assert.equal(owner(state).actionsLeft, actions)
    assert.deepEqual(owner(state).discard, ['60502', '60526'])
  }
})

test('血肉结界使用支援反应窗口的伤害上下文', () => {
  const state = fixture('60101')
  const ward = asset(state, '60106')
  const foe = enemy(state, { damage: 2 })
  transact(state, draft => enemyAttack(draft, draft.enemies.find(item => item.id === foe.id), owner(draft), []),
    pending => byCard(pending, '60106'))
  assert.equal(owner(state).damage, 1)
  assert.equal(owner(state).assets.find(item => item.id === ward.id).uses, 3)
})

test('快速事件按读点取有效智识，效果随存档往返并在轮末过期', () => {
  const state = fixture('60201')
  const combat = getStat(state, owner(state), 'combat')
  const agility = getStat(state, owner(state), 'agility')
  const intellect = getStat(state, owner(state), 'intellect')
  play(state, '60226')
  settle(state)
  assert.equal(owner(state).hand.length, 1)
  assert.equal(getStat(state, owner(state), 'combat'), combat + intellect)
  const restored = JSON.parse(JSON.stringify(state))
  createEffect(restored, { controllerSeat: 0, duration: 'endOfTurn', modifiers: [{ target: 'skill:intellect', amount: 2 }] })
  assert.equal(getStat(restored, owner(restored), 'agility'), agility + intellect + 2)
  expireEffects(restored, 'endOfRound')
  assert.equal(getStat(restored, owner(restored), 'combat'), combat)
  assert.equal(getStat(restored, owner(restored), 'agility'), agility)
})

test('考古基金限制同一伤害和恐惧包中所有密斯卡托尼克支援的分配总数', () => {
  const state = fixture('60201')
  asset(state, '60232')
  const librarian = asset(state, '01032')
  const student = asset(state, '60213')
  transact(state, draft => applyHarm(draft, owner(draft), 1, 1, [], false),
    pending => pending.options.find(option => option.id === librarian.id)?.id)
  assert.equal(owner(state).damage, 0)
  assert.equal(owner(state).horror, 1)
  assert.equal(owner(state).assets.find(item => item.id === student.id)?.horror, undefined)
  transact(state, draft => applyHarm(draft, owner(draft), 0, 1, [], false),
    pending => pending.options.find(option => option.id === student.id)?.id)
  assert.equal(owner(state).horror, 1)
})

test('修订核心的寻觅答案重印导入已开放的入门包原版', () => {
  const canonical = canonicalCode('01685')
  assert.equal(canonical, '60227')
  assert.equal(getAvailability(canonical).deckbuilding, true)
  assert.equal(registeredEntry('01685').abilities[0].resolve, registeredEntry(canonical).abilities[0].resolve)
})

test('德林加手枪失败后返还弹药，战斗加成只供同一件支援在当轮使用一次', () => {
  const state = fixture('60501')
  const firearm = asset(state, '60522')
  const other = asset(state, '60522')
  const foe = enemy(state, { fight: 6 })
  const ammo = () => owner(state).assets.find(card => card.id === firearm.id).uses
  const attack = () => {
    use(state, firearm, { targetId: foe.id })
    settle(state)
  }

  attack()
  assert.equal(state.lastTestResult.success, false)
  assert.equal(ammo(), 3)
  assert.ok(state.effects.some(effect => effect.sourceInstanceId === firearm.id))
  assert.ok(state.effects.every(effect => effect.sourceInstanceId !== other.id))
  attack()
  assert.equal(state.lastTestResult.success, true)
  assert.equal(ammo(), 2)
  assert.ok(state.effects.every(effect => effect.sourceInstanceId !== firearm.id))
  attack()
  expireEffects(state, 'endOfRound')
  assert.ok(state.effects.every(effect => effect.sourceInstanceId !== firearm.id))
})

test('杰奎琳的构筑依赖和额外揭示进真实对局，取消同面的两枚旧印逐枚抽牌', () => {
  const state = fixture('60401')
  const deck = state.campaign.investigators[0].deck
  assert.ok(deck.includes('60402') && deck.includes('60403'))
  assert.ok(basicWeaknessPool(state, '60401').includes('60404'))
  state.chaosBag = ['eldersign', 'eldersign', 'eldersign']
  const test = () => transact(state, draft => performTest(draft, 0, 'willpower', 6),
    pending => byCard(pending, '60401'))
  test()
  assert.equal(state.lastTestResult.success, true)
  assert.equal(owner(state).hand.length, 2)
  assert.deepEqual(state.chaosBag, ['eldersign', 'eldersign', 'eldersign'])
  test()
  assert.equal(owner(state).hand.length, 2)
})

test('格兰妮改写失败差值为零，自动失败仍保留失败结果', () => {
  const state = fixture('60501')
  asset(state, '60508')
  state.chaosBag = ['autofail']
  transact(state, draft => performTest(draft, 0, 'willpower', 1),
    pending => byCard(pending, '60508') ?? pending.options.find(option => option.id === 'less')?.id)
  assert.equal(state.lastTestResult.success, false)
  assert.equal(state.lastTestResult.autoFail, true)
  assert.equal(state.lastTestResult.failedBy, 0)
})
