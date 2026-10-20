import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { CORE_INVESTIGATOR_CODES, PLAYABLE_INVESTIGATOR_CODES, CORE_PLAYER_CODES, PLAYER_CARD_CODES, CORE_UPGRADE_CODES, CORE_SIGNATURE_CODES, CORE_BASIC_WEAKNESS_CODES, SIGNATURES_BY_INVESTIGATOR, canSelectInvestigator, isCardAvailable, getAvailability } from '../src/deck/availability.js'
import { corePlayablePool, isPlayable, buildDeck, buildDeckFromList, deckBuilderData } from '../src/deck/deckbuilding.js'

const roland = INVESTIGATORS['01001']
const list = () => buildDeck(roland, { seed: 'n1' }).playerCards

test('不可变清单固定核心五人、58玩家卡及完整依赖，严格模式开放', () => {
  assert.equal(CORE_INVESTIGATOR_CODES.length, 5)
  assert.equal(CORE_PLAYER_CODES.length, 58)
  assert.equal(CORE_SIGNATURE_CODES.length, 10)
  assert.equal(CORE_BASIC_WEAKNESS_CODES.length, 8)
  assert.deepEqual(corePlayablePool().map(card => card.code), CORE_PLAYER_CODES)
  assert.ok(Object.isFrozen(CORE_PLAYER_CODES))
  assert.ok(CORE_INVESTIGATOR_CODES.every(code => canSelectInvestigator(code) && canSelectInvestigator(code, 'strict')))
  assert.ok(CORE_PLAYER_CODES.every(code => isCardAvailable(code) && isCardAvailable(code, 'strict')))
  assert.equal(getAvailability('02001').availability, 'strict')
  assert.equal(getAvailability('03001').availability, 'strict')
  assert.equal(getAvailability('03020').availability, 'strict')
  for (const code of ['09001', '10001', 'unknown']) assert.equal(getAvailability(code).availability, 'catalog-only')
  assert.equal(CORE_UPGRADE_CODES.length, 22)
  assert.ok(CORE_UPGRADE_CODES.every(code => getAvailability(code).upgradeOnly && isCardAvailable(code)))
  assert.equal(isPlayable({ code: 'unimplemented-skill', type: 'skill', icons: { wild: 2 } }), false)
  assert.equal(isPlayable({ ...ALL_CARDS['01025'], dataStatus: 'quarantined' }), false)
  assert.equal(getAvailability('01117').scenarioOnly, true)
})

test('五名调查员自动及手动开局均包含30玩家卡、签名卡和两个弱点', () => {
  for (const code of CORE_INVESTIGATOR_CODES) {
    const inv = INVESTIGATORS[code]
    const built = buildDeck(inv, { seed: 'repeatable' })
    assert.equal(built.playerCards.length, 30)
    assert.equal(built.deck.length, 33)
    assert.equal(built.basicWeaknesses.length, 1)
    assert.deepEqual([...built.signatureCards, ...built.signatureWeaknesses].sort(), [...SIGNATURES_BY_INVESTIGATOR[code]].sort())
    assert.ok(built.playerCards.every(card => PLAYER_CARD_CODES.includes(card)))
    const manual = buildDeckFromList(inv, built.playerCards)
    assert.deepEqual(manual.errors, [])
    assert.equal(manual.deck.length, 33)
    assert.deepEqual(buildDeck(inv, { seed: 'repeatable' }), built)
  }
})

test('传入 playerPool 只能收窄许可范围，不接受池外卡及伪造元数据', () => {
  const cards = list()
  const removed = cards[0]
  const narrowed = corePlayablePool().filter(card => card.code !== removed)
  const manual = buildDeckFromList(roland, cards, { playerPool: narrowed })
  assert.ok(manual.errors.some(error => error.includes('playerPool')))
  assert.deepEqual(manual.deck, [])
  const automatic = buildDeck(roland, { playerPool: narrowed })
  assert.ok(!automatic.playerCards.includes(removed))
  const forged = [{ code: '02001', type: 'asset', klass: 'guardian', xp: 0, deckLimit: 30 }]
  assert.throws(() => buildDeck(roland, { playerPool: forged }), /不足/)
  assert.ok(buildDeckFromList(roland, cards, { playerPool: [] }).errors.length)
  assert.throws(() => buildDeck(roland, { playerPool: null }), /playerPool/)
})

test('拒绝签名、弱点、遭遇、目录调查员、升级卡及无效输入', () => {
  const cards = list()
  for (const code of ['01006', '01096', '01119', '09001', '01026', '__proto__', 'missing']) {
    const result = buildDeckFromList(roland, [code, ...cards.slice(1)])
    assert.ok(result.errors.length, code)
    assert.deepEqual(result.deck, [])
  }
  assert.ok(buildDeckFromList(roland, Array(30).fill('01016')).errors.some(error => error.includes('张数上限')))
  assert.ok(buildDeckFromList(roland, [1, ...cards.slice(1)]).errors.length)
  assert.ok(buildDeckFromList(roland, 'invalid').errors.length)
  assert.ok(buildDeckFromList(roland, cards.slice(1)).errors.length)
  assert.equal(buildDeck(INVESTIGATORS['03001'], { seed: 'carcosa' }).playerCards.length, 30)
})

test('XP 默认0且预算必须合法，不能通过调用参数开放升级池', () => {
  const cards = list()
  for (const budget of [-1, 0.5, NaN, Infinity, '10']) {
    assert.throws(() => buildDeck(roland, { xpBudget: budget }), /XP/)
    assert.ok(buildDeckFromList(roland, cards, { xpBudget: budget }).errors.length)
  }
  assert.ok(buildDeckFromList(roland, ['01026', ...cards.slice(1)], { xpBudget: 999, playerPool: [...corePlayablePool(), ALL_CARDS['01026']] }).errors.length)
  const card = ALL_CARDS[cards[0]]
  const xp = card.xp
  try {
    card.xp = 1
    const result = buildDeckFromList(roland, cards)
    assert.ok(result.errors.some(error => error.includes('XP')))
  } finally { card.xp = xp }
})

test('缺少签名、效果或基础弱点依赖时明确失败，不静默省略', () => {
  const cards = list()
  const signature = ALL_CARDS['01006']
  try {
    delete ALL_CARDS['01006']
    assert.throws(() => buildDeck(roland), /签名/)
    assert.ok(buildDeckFromList(roland, cards).errors.some(error => error.includes('签名')))
  } finally { ALL_CARDS['01006'] = signature }
  // 两条通道各挑一张：01021 看门狗（Phase 5 起在能力层）与 01079 体能训练（仍在旧 DSL 里）。
  const effect = EFFECTS['01079']
  try {
    delete EFFECTS['01079']
    assert.equal(isPlayable(ALL_CARDS['01079']), false)
    assert.throws(() => corePlayablePool(), /效果/)
  } finally { EFFECTS['01079'] = effect }
  // 能力层的卡不再依赖 EFFECTS：删掉 EFFECTS 条目仍可打出（读点是注册表）。
  assert.equal(isPlayable(ALL_CARDS['01021']), true)
  assert.equal(EFFECTS['01021'], undefined)
  assert.throws(() => buildDeck(roland, { basicWeaknessPool: [] }), /基础弱点/)
  assert.throws(() => buildDeck(roland, { basicWeaknessPool: ['02001'] }), /基础弱点/)
  const incomplete = { ...roland, deckRequirements: { ...roland.deckRequirements, signatureCards: ['01006'] } }
  assert.throws(() => buildDeck(incomplete), /构筑依赖/)
})

test('界面构筑元数据与服务端清单一致', () => {
  const data = deckBuilderData()
  assert.deepEqual(data.investigators.map(inv => inv.code), PLAYABLE_INVESTIGATOR_CODES)
  assert.deepEqual(data.cardPool.map(card => card.code), PLAYER_CARD_CODES)
  assert.equal(data.size, 30)
  const roland = data.investigators.find(inv => inv.code === '01001')
  assert.equal(roland.pack, 'core')
  assert.equal(roland.subname, '联邦调查员')
  assert.deepEqual(roland.traits, ['特工', '侦探'])
  assert.match(roland.abilityText, /击败一个敌人/)
  assert.equal(roland.deckSize, 30)
  assert.equal(roland.signatureCards[0].code, '01006')
})
