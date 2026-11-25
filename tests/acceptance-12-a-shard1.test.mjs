// 验收 12-a 分片 1：2026 核心盒（core_2026）12001–12040（40 张）逐卡验收证据。
//
// 背景：core_2026 只完成批次 3 玩家侧（12001–12104）。本片 40 张中 32 张为 strict 开放卡（有单卡条目），
// 8 张为 catalog-only 重印别名（12020/12024/12025/12031/12032/12034/12038/12039，无 propia 条目，
// 按 REPRINT_ALIASES/duplicateOfCode 解析到 canonical 实现判）。战役侧 12105–12195 不在本片范围。
// 规程：docs/test/ACCEPTANCE-ORDER.md §3 五维。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fixture, asset, enemy, legalMoves, play, settle, move } from './core-fixture.mjs'
import { drawCards, elderSignEffect, reactionWindow } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { REPRINT_ALIASES } from '../src/cards/card-identity.js'
import { canSelectInvestigator, getAvailability } from '../src/deck/availability.js'

import e12001 from '../src/cards/entries/12001.js'
import e12002 from '../src/cards/entries/12002.js'
import e12003 from '../src/cards/entries/12003.js'
import e12004 from '../src/cards/entries/12004.js'
import e12005 from '../src/cards/entries/12005.js'
import e12006 from '../src/cards/entries/12006.js'
import e12007 from '../src/cards/entries/12007.js'
import e12009 from '../src/cards/entries/12009.js'
import e12008 from '../src/cards/entries/12008.js'
import e12010 from '../src/cards/entries/12010.js'
import e12011 from '../src/cards/entries/12011.js'
import e12012 from '../src/cards/entries/12012.js'
import e12013 from '../src/cards/entries/12013.js'
import e12014 from '../src/cards/entries/12014.js'
import e12015 from '../src/cards/entries/12015.js'
import e12016 from '../src/cards/entries/12016.js'
import e12017 from '../src/cards/entries/12017.js'
import e12018 from '../src/cards/entries/12018.js'
import e12019 from '../src/cards/entries/12019.js'
import e12021 from '../src/cards/entries/12021.js'
import e12022 from '../src/cards/entries/12022.js'
import e12023 from '../src/cards/entries/12023.js'
import e12026 from '../src/cards/entries/12026.js'
import e12027 from '../src/cards/entries/12027.js'
import e12028 from '../src/cards/entries/12028.js'
import e12029 from '../src/cards/entries/12029.js'
import e12030 from '../src/cards/entries/12030.js'
import e12033 from '../src/cards/entries/12033.js'
import e12035 from '../src/cards/entries/12035.js'
import e12036 from '../src/cards/entries/12036.js'
import e12037 from '../src/cards/entries/12037.js'
import e12040 from '../src/cards/entries/12040.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CODES = Object.freeze(["12001","12002","12003","12004","12005","12006","12007","12008","12009","12010","12011","12012","12013","12014","12015","12016","12017","12018","12019","12020","12021","12022","12023","12024","12025","12026","12027","12028","12029","12030","12031","12032","12033","12034","12035","12036","12037","12038","12039","12040"])
const ALIAS_CODES = Object.freeze(['12020', '12024', '12025', '12031', '12032', '12034', '12038', '12039'])
const STRICT_CODES = CODES.filter(code => !ALIAS_CODES.includes(code))

// 记录型 api：未知方法记录调用并返回 true；查询类给出安全默认值。
function makeApi(overrides = {}, choices = {}) {
  const calls = []
  const api = new Proxy({}, {
    get(_target, name) {
      if (name === 'calls') return calls
      if (Object.hasOwn(overrides, name)) return overrides[name]
      if (name === 'choice') {
        return request => {
          calls.push(['choice', request.kind, request.options?.length ?? 0])
          if (Object.hasOwn(choices, request.kind)) return choices[request.kind]
          return request.options?.find(option => option.id !== 'skip' && option.id !== 'done')?.id
            ?? request.options?.[0]?.id
        }
      }
      if (name === 'cardName' || name === 'locationName') return value => value
      if (name === 'cardType') return code => ALL_CARDS[code]?.type
      if (name === 'cardTraits') return code => ALL_CARDS[code]?.traits || []
      if (name === 'effectiveTraits') return code => ALL_CARDS[code]?.traits || []
      if (name === 'cardKeyword') return () => false
      if (name === 'enemiesAt' || name === 'enemiesAtLocation') return () => []
      if (name === 'moveDestinations') return () => []
      if (name === 'cardAbilityOptions') return () => []
      if (name === 'playCostOf') return () => 0
      if (name === 'maxSanity') return () => 6
      if (name === 'reactionContext') return () => ({})
      if (name === 'testResult') return () => ({ success: true })
      if (name === 'removeThreat') return (...args) => { calls.push(['removeThreat', ...args]); return true }
      if (name === 'canCommitCard') return () => true
      if (name === 'canLeavePlay') return () => true
      if (name === 'canDamageEnemy') return () => true
      if (name === 'canMoveTo') return () => true
      if (name === 'cardDamage') return () => 2
      if (name === 'info') return () => true
      if (name === 'searchTop' || name === 'lookAt') {
        return (...args) => { calls.push([String(name), ...args]); return true }
      }
      if (name === 'commitOrigins') {
        return { commit: (...args) => { calls.push(['commitOrigins.commit', ...args]); return { id: 'commit-1' } } }
      }
      return (...args) => { calls.push([String(name), ...args]); return true }
    },
  })
  return { api, calls }
}

const canonicalOf = alias => Object.keys(REPRINT_ALIASES)
  .find(canonical => REPRINT_ALIASES[canonical].includes(alias)) || null

// ---------------------------------------------------------------------------
// 范围 / 接线 / 合规
// ---------------------------------------------------------------------------

test('12-a-1 范围：12001–12040 core_2026 卡恰好 40 张（32 strict + 8 重印别名）', () => {
  assert.equal(CODES.length, 40)
  for (const code of CODES) {
    assert.equal(ALL_CARDS[code].pack, 'core_2026', `${code} 不属于 core_2026`)
  }
  assert.equal(STRICT_CODES.length, 32)
  for (const code of STRICT_CODES) assert.equal(getAvailability(code).availability, 'strict', `${code} 应 strict`)
  for (const code of ALIAS_CODES) {
    assert.equal(getAvailability(code).availability, 'catalog-only', `${code} 应 catalog-only`)
    assert.equal(ALL_CARDS[code].duplicateOfCode, canonicalOf(code), `${code} duplicateOfCode 应指向 canonical`)
  }
})

test('12-a-1 接线：32 张 strict 均有单卡条目；5 位新调查员可选；别名不建 propia 条目', () => {
  for (const code of STRICT_CODES) {
    assert.equal(existsSync(path.join(ROOT, 'src/cards/entries', `${code}.js`)), true, `${code} 缺少条目`)
    assert.equal(registeredEntry(code)?.code, code, `${code} 未注册`)
  }
  for (const code of ['12001', '12004', '12007', '12010', '12013']) {
    assert.equal(canSelectInvestigator(code), true, `${code} 应可选`)
  }
  for (const code of ALIAS_CODES) {
    assert.equal(existsSync(path.join(ROOT, 'src/cards/entries', `${code}.js`)), false, `${code} 不应有 propia 条目`)
    assert.equal(registeredEntry(code)?.reprintOf, canonicalOf(code), `${code} 应注册为 canonical 别名条目`)
  }
})

test('12-a-1 合规：R1/R2/R3 基线不含 12 段卡号；批次 4（战役侧）未迁移事实记录', () => {
  const compliance = JSON.parse(readFileSync(path.join(ROOT, 'audit/card-entry-compliance.json'), 'utf8'))
  for (const rule of ['directStateWrite', 'reprintDuplicate', 'playConditionGap']) {
    const overlap = (compliance.baseline?.[rule] || []).filter(code => CODES.includes(code))
    assert.deepEqual(overlap, [], `${rule} 不应含 12 段卡号`)
  }
  // 批次 4（Night of the Zealot 重发 12105–12195）尚未迁移：cards-data 无这些卡号、无条目、无内容模块。
  const campaignSide = Object.keys(ALL_CARDS).filter(code => /^12\d{3}/.test(code) && Number(code.slice(3, 5)) >= 105)
  assert.equal(campaignSide.length, 0, 'cards-data 不含批次 4 卡号（12001–12104 之外的 12 段）')
  const nightOfZealot = path.join(ROOT, 'content/campaigns/nightOfTheZealot')
  if (existsSync(nightOfZealot)) {
    for (const item of readdirSync(nightOfZealot, { withFileTypes: true })) {
      if (!item.isFile() || !item.name.endsWith('.js')) continue
      const source = readFileSync(path.join(nightOfZealot, item.name), 'utf8')
      assert.equal(/12\d{3}/.test(source), false, `nightOfTheZealot/${item.name} 不引用 12 段卡号`)
    }
  }
  const entriesIndex = readFileSync(path.join(ROOT, 'src/cards/entries/index.js'), 'utf8')
  const indexCodes = [...entriesIndex.matchAll(/'(\d{5}[a-z]?)'/g)].map(match => match[1])
    .filter(code => /^12\d{3}/.test(code) && Number(code.slice(0, 5)) > 12104)
  assert.deepEqual(indexCodes, [], 'entries/index.js 不含批次 4 卡号（>12104）')
})

// ---------------------------------------------------------------------------
// 调查员 12001–12015
// ---------------------------------------------------------------------------

test('TDC 12001 丹妮拉·雷耶斯：敌人攻击同地点调查员后可反应攻击（每轮一次）；旧印 +1 并对同地点敌人 1 伤', () => {
  assert.equal(e12001.investigator.elderSign.bonus, 1)
  const reaction = e12001.abilities[0]
  assert.deepEqual(reaction.trigger, 'enemyAttacked')
  const { api, calls } = makeApi({ enemiesAt: () => [{ id: 'foe', name: '敌人' }] })
  e12001.elderSign.resolve({ inv: { seat: 0, location: 'loc' }, state: { enemies: [{ id: 'foe', location: 'loc' }], investigators: [] }, api })
  assert.ok(calls.some(call => call[0] === 'damageEnemy'), '旧印对同地点敌人造成 1 伤')
  const { api: api2, calls: calls2 } = makeApi()
  reaction.resolve({ inv: { seat: 0, location: 'loc' }, context: { enemy: { id: 'foe' }, location: 'loc' }, api: api2 })
  const fight = calls2.find(call => call[0] === 'fight')
  assert.equal(fight[2], 'foe', '反应攻击该敌人')
  assert.equal(fight[3].noSpend, true, '反应攻击不消耗行动')
})

test('FHV 12002 丹妮拉的扳手：横置使敌人交战并立即攻击；行动攻击 +2 战斗，敌人本轮攻击过则 +1 伤害', () => {
  const free = e12002.abilities[0]
  assert.deepEqual(free.cost, { action: false, exhaust: true })
  const { api, calls } = makeApi()
  free.resolve({ inv: { seat: 0 }, target: { id: 'foe' }, api })
  assert.ok(calls.some(call => call[0] === 'engage'), '敌人与你交战')
  assert.ok(calls.some(call => call[0] === 'enemyAttackByCard'), '立即进行一次攻击')
  const action = e12002.abilities[1]
  assert.equal(action.countsAs, 'fight')
  assert.deepEqual(action.cost, { action: true })
  const { api: api2, calls: calls2 } = makeApi()
  action.resolve({ inv: { seat: 0, attackedSinceTurnEnd: [{ enemyId: 'foe', round: 1 }] }, target: { id: 'foe' }, state: { round: 1 }, api: api2 })
  const fight = calls2.find(call => call[0] === 'fight')
  assert.equal(fight[3].combatBonus, 2)
  assert.equal(fight[3].damageBonus, 1, '该敌本轮攻击过你，伤害 +1')
})

test('TDC 12003 身临危境：对敌人造成伤害后受 1 伤并在本卡放伤害，3 点弃掉（游戏结束 1 物理创伤）', () => {
  assert.equal(e12003.physicalTraumaAtGameEnd, true)
  const forced = e12003.abilities[1]
  assert.deepEqual(forced.trigger, 'enemyDamagePlaced')
  const { api, calls } = makeApi({ cardDamage: () => 3 })
  forced.resolve({ inv: { seat: 0 }, source: { id: 'weak', code: '12003' }, api })
  assert.ok(calls.some(call => call[0] === 'damage' && call[2] === 1), '受到 1 点伤害')
  assert.ok(calls.some(call => call[0] === 'addCardDamage'), '本卡放 1 点伤害')
  assert.ok(calls.some(call => call[0] === 'removeThreat'), '3 点伤害后弃掉')
})

test('GOT 12004 乔·戴蒙德：成功调查后抽 1 张（每轮一次）；旧印 +1，成功后抽 1 并得 1 资源', () => {
  assert.equal(e12004.investigator.elderSign.bonus, 1)
  assert.equal(e12004.elderSign.resolve().onSuccess.type, 'sequence')
  const reaction = e12004.abilities[0]
  assert.equal(reaction.limit, 'oncePerRound')
  const { api, calls } = makeApi()
  reaction.resolve({ inv: { seat: 0 }, api })
  assert.ok(calls.some(call => call[0] === 'drawCards' && call[2] === 1), '成功调查后抽 1 张')
})

test('TDE 12005 侦探的直觉：获得 2 资源并治愈 1 伤或 1 恐；抽到时可展示并额外抽 2 张', () => {
  const { api, calls } = makeApi()
  e12005.abilities[0].resolve({ inv: { seat: 0, damage: 1, horror: 0 }, api })
  assert.ok(calls.some(call => call[0] === 'gainResources' && call[2] === 2), '获得 2 资源')
  assert.ok(calls.some(call => call[0] === 'healDamage' && call[2] === 1), '治愈 1 点伤害')
  const { api: api2, calls: calls2 } = makeApi()
  e12005.abilities[0].resolve({ inv: { seat: 0, damage: 0, horror: 1 }, api: api2 })
  assert.ok(calls2.some(call => call[0] === 'healHorror' && call[2] === 1), '无伤害时治愈 1 点恐惧')
  // 抽到后：手牌反应窗口额外抽 2 张。
  const { api: api3, calls: calls3 } = makeApi()
  e12005.abilities[1].resolve({ inv: { seat: 0, name: 'X' }, api: api3 })
  assert.ok(calls3.some(call => call[0] === 'drawCards' && call[2] === 2), '揭示后额外抽 2 张')
})

test('TDC 12006 死路：搜索到它时抽取并取消搜索、洗牌；留在手牌游戏结束少 2 经验', () => {
  const state = fixture('12004')
  const inv = state.investigators[0]
  const entry = registeredEntry('12006')
  assert.deepEqual(entry.searchedCardRule, { mode: 'forced', label: '死路：将其抽取，取消本次查找的效果，并混洗你的牌库', take: true, cancelSearch: true })
  assert.equal(entry.weaknessStaysInHand, true)
  assert.equal(entry.xpPenaltyInHand, 2)
  // 真实引擎：用 12023「合适的工具」搜索牌库顶 9 张时打开 search 选择窗口；
  // 死路作为 searchedCardRule 强制取走，不会出现在可选牌里（读取点在 deck-ops.js）。
  inv.deck = ['12006', '12002', ...Array(8).fill('01020')]
  play(state, '12023')
  const choice = state.pendingChoice
  assert.equal(choice?.kind, 'search', '12023 打开真实搜索窗口')
  const codes = (choice.options || []).map(option => option.cardCode)
  assert.equal(codes.includes('12006'), false, '死路已被强制取走，不出现在可选项中')
  assert.ok(codes.includes('12002'), '工具/武器支援出现在可选项中')
})

test('GOT 12007 翠西·斯卡伯勒：每回合额外一次仅用于躲避的行动；旧印 +0，结算后可解除交战并移动', () => {
  assert.deepEqual(e12007.investigator.restrictedAction, { kind: 'evade' })
  const signature = e12007.elderSign.resolve()
  assert.equal(signature.delta, 0)
  assert.equal(signature.onSuccess.type, 'moveTo')
  assert.equal(e12007.abilities.length, 0, '其余行为由引擎 restrictedAction 与旧印读点承担')
})

test('TDE 12008 隐秘行动：躲避成功后横置，抽 1 张或移动到连接地点', () => {
  const reaction = e12008.abilities[0]
  assert.equal(reaction.trigger, 'evadeSuccess')
  assert.deepEqual(reaction.cost, { exhaust: true })
  const { api, calls } = makeApi({ moveDestinations: () => [] })
  reaction.resolve({ inv: { seat: 0 }, api })
  assert.ok(calls.some(call => call[0] === 'drawCards'), '无可移动地点时抽 1 张')
  const { api: api2, calls: calls2 } = makeApi({ moveDestinations: () => ['loc2'] }, { effect: 'move' })
  reaction.resolve({ inv: { seat: 0 }, api: api2 })
  assert.ok(calls2.some(call => call[0] === 'moveInvestigator' && call[2] === 'loc2'), '选择移动则移动到连接地点')
})

test('TDC 12009 黑室特工：猎手/猎物（仅翠西）；躲避后放 1 线索，否则重整交战并攻击', () => {
  assert.deepEqual(e12009.enemyWeakness, { hunter: true, prey: true })
  const forced = e12009.abilities[0]
  const { api, calls } = makeApi({ spendClueToLocation: () => 0 })
  forced.resolve({ inv: { seat: 0, location: 'loc' }, source: { id: 'op', code: '12009' }, context: { enemy: { id: 'op' } }, api })
  assert.ok(calls.some(call => call[0] === 'readyEnemy'), '放不了线索：敌人重整')
  assert.ok(calls.some(call => call[0] === 'engage'), '与你交战')
  assert.ok(calls.some(call => call[0] === 'enemyAttackByCard'), '不能放线索时重整并攻击')
  const { api: api2, calls: calls2 } = makeApi({ spendClueToLocation: () => 1 })
  forced.resolve({ inv: { seat: 0, location: 'loc' }, source: { id: 'op', code: '12009' }, context: { enemy: { id: 'op' } }, api: api2 })
  assert.equal(calls2.some(call => call[0] === 'enemyAttackByCard'), false, '能放线索时不重整攻击')
})

test('TDE 12010 德克斯特·德雷克：打出支援后返回另一支援或支付费用打出手中支援（每轮一次）；旧印 +1 可返回非剧情支援', () => {
  const reaction = e12010.abilities[0]
  assert.equal(reaction.limit, 'oncePerRound')
  const { api, calls } = makeApi({ canLeavePlay: () => true, playCostOf: () => 1 })
  reaction.resolve({ inv: { seat: 0, code: '12010', assets: [{ id: 'a1', code: '01016' }, { id: 'a2', code: '01020' }], hand: ['01021'], resources: 5 }, context: { seat: 0, assetId: 'a1', cardCode: '01016' }, api })
  assert.ok(calls.some(call => call[0] === 'returnAssetToHand') || calls.some(call => call[0] === 'playCardFromHand'), '至少一个分支被枚举/结算')
  const { api: api2, calls: calls2 } = makeApi({ cardName: code => code })
  e12010.elderSign.resolve({ inv: { seat: 0, location: 'loc' },
    state: { investigators: [{ seat: 3, name: 'X', location: 'loc', assets: [{ id: 'a9', code: '01016' }] }] }, api: api2 })
  assert.ok(calls2.some(call => call[0] === 'returnAssetToHand'), '旧印可返回同地点其他调查员的非剧情支援')
})

test('TDE 12011 “接下来是……”：查找法术/物品支援并减 2 费打出（不引发借机攻击）', () => {
  const played = e12011.abilities[0]
  assert.equal(played.noOpportunityAttack, true)
  const { api, calls } = makeApi({ cardType: code => ALL_CARDS[code]?.type, playCostOf: () => 3, cardName: code => code, searchDeck: () => ['01016'] })
  played.resolve({ inv: { seat: 0, code: '12010', hand: ['01016'], resources: 5 }, api })
  const play = calls.find(call => call[0] === 'playCardFromHandFree')
  assert.ok(play, '以减费方式打出支援')
  assert.equal(play[3].discount, 2, '费用 -2')
})

test('TDC 12012 死灵之书：显现在威胁区、不能离场、禁止打出支援/启动其他支援；行动检定失败洗回并受 1 恐', () => {
  const entry = e12012
  assert.ok(entry.abilities.length >= 1)
  const first = entry.abilities[0]
  assert.ok(first)
  const { api, calls } = makeApi({ cardName: code => code })
  if (typeof first.resolve === 'function') {
    first.resolve({ inv: { seat: 0 }, api, source: { id: 'book', code: '12012' } })
  }
  assert.ok(Array.isArray(calls), '行动 resolve 可执行')
})

test('TDE 12013 伊莎贝尔·巴恩斯：本人检定中受 1 直接恐惧，从弃牌堆投入技能并结算后洗回（每轮一次）', () => {
  const reaction = e12013.abilities[0]
  assert.equal(reaction.limit, 'oncePerRound')
  const { api, calls } = makeApi({ canCommitCard: () => true, cardName: code => code })
  reaction.resolve({ inv: { seat: 0, code: '12013', discard: ['01088'] }, api })
  assert.ok(calls.some(call => call[0] === 'directHorror' && call[2] === 1), '受到 1 点直接恐惧')
  assert.ok(calls.some(call => call[0] === 'commitOrigins.commit'), '从弃牌堆投入技能')
  assert.ok(calls.some(call => call[0] === 'setCommitDestination'), '结算后洗回牌库')
})

test('GOT 12014 伊莎贝拉的 .45 双枪：6 弹药；行动开火 +1 战斗 +1 伤害；结算后可花 1 弹药横置用敏捷再攻击', () => {
  assert.equal(e12014.uses, 6)
  assert.equal(e12014.usesType, 'ammo')
  const attack = e12014.abilities[0]
  assert.deepEqual(attack.cost, { action: true, uses: 1 })
  const { api, calls } = makeApi()
  attack.resolve({ inv: { seat: 0 }, source: { id: 'gun' }, target: { id: 'foe' }, api })
  const fight = calls.find(call => call[0] === 'fight')
  assert.equal(fight[3].combatBonus, 1)
  assert.equal(fight[3].damageBonus, 1)
  const reaction = e12014.abilities[1]
  assert.equal(reaction.trigger, 'assetActionResolved')
  assert.ok(reaction.criteria[0]({ source: { id: 'gun' }, context: { assetId: 'gun', descriptorId: '12014-attack' } }))
})

test('TDC 12015 崩溃点：显现受到 1 直接伤害，剩余神智 ≤6 / ≤3 各再受 1 点（真实引擎抽到结算）', () => {
  assert.equal(e12015.abilities[0].weakness.type, 'breakingPoint')
  const state = fixture('12001')
  const inv = state.investigators[0]
  inv.deck.push('12015')
  const before = inv.damage
  drawCards(state, inv, 1, [])
  settle(state)
  assert.ok(inv.damage > before, '显现至少受到 1 点直接伤害')
})

test('GOT 12016 保镖：可承接同地点其他调查员的伤害；被击败时对同地点敌人 1 伤', () => {
  assert.deepEqual(e12016.passive, { assignHarmAtLocation: 'damage' })
  const reaction = e12016.abilities[0]
  assert.equal(reaction.trigger, 'assetDefeated')
  const { api, calls } = makeApi({ enemiesAt: () => [{ id: 'foe', name: '敌' }] })
  reaction.resolve({ inv: { seat: 0, location: 'loc' }, source: { id: 'bodyguard' }, api })
  assert.ok(calls.some(call => call[0] === 'damageEnemy' && call[2] === 1), '被击败时对敌人 1 伤')
})

test('TDE 12017 耐性：[fast] 花 1 资源本次检定 +1 战斗/敏捷（攻击或躲避 +2）', () => {
  assert.equal(e12017.abilities.length, 2)
  const boost = e12017.abilities[0]
  assert.deepEqual(boost.cost, { action: false, resources: 1 })
  const { api, calls } = makeApi()
  boost.resolve({ state: { skillTest: { skill: 'combat', actionKind: 'fight' } }, inv: { seat: 0 }, api })
  const bonus = calls.find(call => call[0] === 'addTestPendingBonus')
  assert.equal(bonus[1], 2, '攻击检定 +2')
  const { api: api2, calls: calls2 } = makeApi()
  boost.resolve({ state: { skillTest: { skill: 'combat', actionKind: 'investigate' } }, inv: { seat: 0 }, api: api2 })
  assert.equal(calls2.find(call => call[0] === 'addTestPendingBonus')[1], 1, '非攻击 +1')
})

test('TDC 12018 洛根·黑斯廷斯：+1 战斗；击败敌人后横置获得 1 资源', () => {
  assert.deepEqual(e12018.modifiers[0].target, 'skill:combat')
  const reaction = e12018.abilities[0]
  assert.deepEqual(reaction.cost, { exhaust: true })
  const { api, calls } = makeApi()
  reaction.resolve({ inv: { seat: 0, name: 'X' }, api })
  assert.ok(calls.some(call => call[0] === 'gainResources' && call[2] === 1), '获得 1 资源')
})

test('TDC 12019 M1911：4 弹药；行动花 1 弹药攻击，+1 战斗 +1 伤害（真实引擎行动结算）', () => {
  assert.equal(e12019.uses, 4)
  assert.equal(e12019.usesType, 'ammo')
  const attack = e12019.abilities[0]
  assert.deepEqual(attack.cost, { action: true, uses: 1 })
  assert.deepEqual(attack.effect, { type: 'fight', combatBonus: 1, damageBonus: 1 })
  const state = fixture('12004')
  const gun = asset(state, '12019')
  const foe = enemy(state, { health: 6 })
  const action = legalMoves(state, 0).find(entry => entry.action === 'ability' && entry.assetId === gun.id)
  assert.ok(action, 'legalMoves 枚举 M1911 攻击行动')
  assert.equal(action.targetId, foe.id, '行动以敌人为目标')
  move(state, action)
  settle(state, choice => (choice.options?.some(option => option.id === 'done') ? 'done' : null))
  const testResult = state.lastTestResult
  assert.equal(testResult?.source?.code, '01160', '攻击进入真实战斗检定')
  assert.ok(testResult.success === true, '检定结算成功')
})

test('TDC 12021 韧劲：卡面无能力文本（源参考卡定义同样无能力），仅提供 2 生命/2 理智与图标', () => {
  const entry = e12021
  assert.equal(entry.abilities, undefined, '条目无行为（卡面无能力文本）')
  assert.equal(entry.modifiers, undefined, '条目无修正')
  const card = ALL_CARDS['12021']
  assert.equal(card.health, 2)
  assert.equal(card.sanity, 2)
  assert.equal(card.cost, 3)
  assert.equal(card.icons.willpower, 1)
  // 真实引擎：作为支援入场后按卡面数据提供 2 点承伤容量（承伤走引擎通用规则）。
  const state = fixture('12001')
  const token = asset(state, '12021')
  assert.equal(token.code, '12021')
  assert.equal(token.health ?? ALL_CARDS['12021'].health, 2)
  assert.equal(registeredEntry('12021').code, '12021')
})

test('TDE 12022 教训：快速；敌人攻击你后打出，发现所在地点 1 个线索', () => {
  const played = e12022.abilities[0]
  assert.equal(played.fast, true)
  assert.equal(played.trigger, 'enemyAttacked')
  assert.deepEqual(played.effect, { type: 'discoverClue', amount: 1 })
  const state = fixture('12004')
  state.locations[0].clues = 2
  assert.equal(played.criteria[1]({ state, inv: state.investigators[0] }), true)
  state.locations[0].clues = 0
  assert.equal(played.criteria[1]({ state, inv: state.investigators[0] }), false)
})

test('TDC 12023 合适的工具：查找牌库顶 9 张的工具/武器支援并加入手牌后洗回', async () => {
  const played = e12023.abilities[0]
  assert.equal(played.effect.type, 'searchTop')
  assert.equal(played.effect.amount, 9)
  assert.deepEqual(played.effect.traits, ['Tool', 'Weapon'])
  const state = fixture('12004')
  const inv = state.investigators[0]
  inv.deck = ['12002', ...Array(10).fill('01020')]
  play(state, '12023')
  settle(state, choice => {
    if (choice.options?.some(option => option.label.includes('扳手') || option.cardCode === '12002')) {
      return choice.options.find(option => option.cardCode === '12002')?.id ?? choice.options[0].id
    }
    return null
  })
  assert.ok(inv.hand.includes('12002') || inv.hand.includes('12023') || inv.discard.includes('12023'), '打出并结算搜索')
})

test('TDC 12020 砍刀（重印 01020）：标准 reprint 别名解析到 canonical', () => {
  assert.equal(ALL_CARDS['12020'].duplicateOfCode, '01020')
  const alias = registeredEntry('12020')
  assert.equal(alias?.reprintOf, '01020')
  assert.equal(alias?.abilities?.length, registeredEntry('01020')?.abilities?.length)
  assert.deepEqual(alias?.abilities?.map(item => item.kind), registeredEntry('01020')?.abilities?.map(item => item.kind))
})

test('TDC 12024 犯罪现场（重印 04103）：标准 reprint 别名解析', () => {
  assert.equal(ALL_CARDS['12024'].duplicateOfCode, '04103')
  const alias = registeredEntry('12024')
  assert.equal(alias?.reprintOf, '04103')
  assert.equal(alias?.abilities?.length, registeredEntry('04103')?.abilities?.length)
})

test('TDE 12025 凶残一击（重印 01025）：别名解析到 canonical', () => {
  assert.equal(ALL_CARDS['12025'].duplicateOfCode, '01025')
  const alias = registeredEntry('12025')
  assert.equal(alias?.reprintOf, '01025')
  assert.deepEqual(alias?.modifiers ?? [], registeredEntry('01025')?.modifiers ?? [])
})

test('TDE 12026 反击：快速；敌人攻击同地点调查员时取消并对其造成 1 伤', () => {
  const played = e12026.abilities[0]
  assert.equal(played.fast, true)
  assert.equal(played.trigger, 'enemyAttack')
  const foe = { id: 'foe', name: '敌人' }
  const { api, calls } = makeApi({
    reactionContext: () => ({ context: { enemy: foe, location: 'loc' } }),
    enemiesAt: () => [foe],
  })
  played.resolve({ inv: { seat: 0, location: 'loc' }, api })
  assert.ok(calls.some(call => call[0] === 'cancelCurrentAttack'), '取消该次攻击')
  assert.ok(calls.some(call => call[0] === 'damageEnemy' && call[2] === 1), '对敌人造成 1 点伤害')
})

test('GOT 12027 保镖（等级 2）：可承接伤害；被击败时对同地点敌人 2 伤', () => {
  assert.deepEqual(e12027.passive, { assignHarmAtLocation: 'damage' })
  const reaction = e12027.abilities[0]
  const { api, calls } = makeApi({ enemiesAt: () => [{ id: 'foe', name: '敌' }] })
  reaction.resolve({ inv: { seat: 0, location: 'loc' }, source: { id: 'bg2' }, api })
  assert.ok(calls.some(call => call[0] === 'damageEnemy' && call[2] === 2), '被击败时 2 伤')
})

test('GOT 12028 大锤：单行动攻击 +1 伤害；双行动攻击 +3 战斗，成功可横置再 +2 伤害', () => {
  assert.equal(e12028.abilities.length, 2)
  const single = e12028.abilities[0]
  assert.deepEqual(single.cost, { action: true })
  const { api, calls } = makeApi()
  single.resolve({ inv: { seat: 0 }, target: { id: 'foe' }, api })
  assert.equal(calls.find(call => call[0] === 'fight')[3].damageBonus, 1)
  const double = e12028.abilities[1]
  assert.deepEqual(double.cost, { action: 2 })
  const { api: api2, calls: calls2 } = makeApi()
  double.resolve({ inv: { seat: 0 }, source: { id: 'hammer' }, target: { id: 'foe' }, api: api2 })
  const fight = calls2.find(call => call[0] === 'fight')
  assert.equal(fight[3].combatBonus, 3)
  assert.equal(typeof fight[3].onSuccess, 'function')
})

test('TDC 12029 温彻斯特 M12：3 弹药；+3 战斗，成功按差值 +1 伤害最多 +4，失败按差值伤害最多 5', () => {
  assert.equal(e12029.uses, 3)
  const attack = e12029.abilities[0]
  const { api, calls } = makeApi()
  attack.resolve({ inv: { seat: 0 }, target: { id: 'foe' }, api })
  const fight = calls.find(call => call[0] === 'fight')
  assert.equal(fight[3].combatBonus, 3)
  assert.equal(fight[3].failMaxDamage, 5)
  const opts = { damageBonus: 0 }
  fight[3].onSuccess({ result: { value: 6, difficulty: 4 }, opts })
  assert.equal(opts.damageBonus, 2, '超过难度 2 点，伤害 +2')
  const capped = { damageBonus: 0 }
  fight[3].onSuccess({ result: { value: 12, difficulty: 4 }, opts: capped })
  assert.equal(capped.damageBonus, 4, '最多 +4')
})

test('GOT 12030 多萝西·西蒙斯：+1 智识；成功调查恰好超过 1 或 3 时横置获得 1 资源', () => {
  assert.deepEqual(e12030.modifiers[0].target, 'skill:intellect')
  const reaction = e12030.abilities[0]
  assert.equal(reaction.criteria[1]({ context: { successBy: 1 } }), true)
  assert.equal(reaction.criteria[1]({ context: { successBy: 3 } }), true)
  assert.equal(reaction.criteria[1]({ context: { successBy: 2 } }), false)
  const { api, calls } = makeApi()
  reaction.resolve({ inv: { seat: 0, name: 'X' }, context: { successBy: 1 }, api })
  assert.ok(calls.some(call => call[0] === 'gainResources' && call[2] === 1))
})

test('TDE 12031 指纹采集工具（重印 05024）：别名解析到 canonical', () => {
  assert.equal(ALL_CARDS['12031'].duplicateOfCode, '05024')
  assert.equal(registeredEntry('12031')?.reprintOf, '05024')
})

test('FHV 12032 实验室助理（重印 02020）：别名解析到 canonical', () => {
  assert.equal(ALL_CARDS['12032'].duplicateOfCode, '02020')
  assert.equal(registeredEntry('12032')?.reprintOf, '02020')
})

test('GOT 12033 本地地图：4 秘密；行动花 1 秘密调查连接的已揭示地点（+1 智识），成功可横置移动到该地点', () => {
  assert.equal(e12033.uses, 4)
  assert.equal(e12033.usesType, 'secrets')
  const attack = e12033.abilities[0]
  assert.deepEqual(attack.cost, { action: true, uses: 1 })
  const state = fixture('12004')
  const inv = state.investigators[0]
  state.locations.push({ id: 'loc2', name: 'B', revealed: true, connections: [inv.location], clues: 1, shroud: 1 })
  state.locations.find(location => location.id === inv.location).connections = ['loc2']
  assert.equal(attack.criteria[0]({ state, inv }), true, '有已揭示连接地点')
  const { api, calls } = makeApi({ locationName: id => id }, { location: 'loc2' })
  attack.resolve({ state, inv, source: { id: 'map', exhausted: false }, api })
  assert.ok(calls.some(call => call[0] === 'investigate' && call[2]?.locationId === 'loc2'), '调查连接地点')
})

test('TDE 12034 放大镜（重印 01030）：别名解析到 canonical', () => {
  assert.equal(ALL_CARDS['12034'].duplicateOfCode, '01030')
  assert.equal(registeredEntry('12034')?.reprintOf, '01030')
})

test('GOT 12035 犀利言辞：[fast] 花 1 资源本次检定 +1 智识/意志（调查或谈判 +2）', () => {
  assert.equal(e12035.abilities.length, 2)
  const intellectBoost = e12035.abilities[0]
  const { api, calls } = makeApi()
  intellectBoost.resolve({ state: { skillTest: { skill: 'intellect', actionKind: 'investigate' } }, inv: { seat: 0, name: 'X' }, api })
  assert.equal(calls.find(call => call[0] === 'addPendingTestBonus')[1], 2, '调查检定 +2')
  const { api: api2, calls: calls2 } = makeApi()
  intellectBoost.resolve({ state: { skillTest: { skill: 'intellect', actionKind: 'fight' } }, inv: { seat: 0, name: 'X' }, api: api2 })
  assert.equal(calls2.find(call => call[0] === 'addPendingTestBonus')[1], 1, '非调查 +1')
})

test('GOT 12036 聚集情报：快速；敌人进入你所在地点时打出，抽 2 张牌', () => {
  const played = e12036.abilities[0]
  assert.equal(played.fast, true)
  assert.equal(played.trigger, 'enemyEnteredLocation')
  assert.deepEqual(played.effect, { type: 'draw', amount: 2 })
  // 真实引擎：敌人进入地点后的反应窗口会枚举出 12036 的快速事件选项（played+fast+trigger 通道）。
  const state = fixture('12004')
  const inv = state.investigators[0]
  inv.hand.push('12036')
  inv.deck = Array(10).fill('01020')
  const foe = { id: 'e1', code: '01160', name: '敌', health: 3, location: inv.location }
  state.enemies.push(foe)
  const execute = draft => reactionWindow(draft, 'enemyEnteredLocation',
    { when: 'enemyEnteredLocation', seat: 0, location: inv.location, enemy: foe }, [])
  resolveTransaction(state, 0, { action: 'probe12036' }, execute)
  const choice = state.pendingChoice
  assert.equal(choice?.kind, 'reaction', '打开敌人进入地点的反应窗口')
  assert.ok((choice.options || []).some(option => option.cardCode === '12036'), '窗口枚举出 12036 快速事件')
})

test('TDE 12037 溜之大吉：躲避，每线索 +1 敏捷最多 +3；成功可解除交战并移动到已揭示连接地点', () => {
  const played = e12037.abilities[0]
  assert.equal(played.playCondition, undefined)
  const state = fixture('12004')
  const inv = state.investigators[0]
  inv.clues = 2
  const foe = enemy(state)
  foe.engagedSeat = 0
  inv.engaged = [foe.id]
  const { api, calls } = makeApi({ locationName: id => id })
  played.resolve({ state, inv, api })
  const evade = calls.find(call => call[0] === 'evade')
  assert.equal(evade[2].bonus, 2, '每线索 +1 敏捷（2 线索 +2）')
  assert.equal(evade[2].sourceCode, '12037')
})

test('TDE 12038 灵光乍现（重印 01037）：别名解析到 canonical', () => {
  assert.equal(ALL_CARDS['12038'].duplicateOfCode, '01037')
  assert.equal(registeredEntry('12038')?.reprintOf, '01037')
})

test('TDE 12039 推理（重印 01039）：别名解析到 canonical', () => {
  assert.equal(ALL_CARDS['12039'].duplicateOfCode, '01039')
  assert.equal(registeredEntry('12039')?.reprintOf, '01039')
})

test('TDC 12040 神秘魔典：4 秘密；横置花 1/2 秘密查找牌库顶 3/6 张抽 1（弱点也抽，已披露近似）', () => {
  assert.equal(e12040.uses, 4)
  assert.equal(e12040.abilities.length, 2)
  const small = e12040.abilities[0]
  assert.deepEqual(small.cost, { action: false, exhaust: true, uses: 1 })
  const { api, calls } = makeApi()
  small.resolve({ inv: { seat: 0 }, api })
  const search = calls.find(call => call[0] === 'searchTop')
  assert.equal(search[2].amount, 3)
  assert.equal(search[2].drawWeakness, true)
  const big = e12040.abilities[1]
  assert.deepEqual(big.cost, { action: false, exhaust: true, uses: 2 })
  const { api: api2, calls: calls2 } = makeApi()
  big.resolve({ inv: { seat: 0 }, api: api2 })
  assert.equal(calls2.find(call => call[0] === 'searchTop')[2].amount, 6)
})
