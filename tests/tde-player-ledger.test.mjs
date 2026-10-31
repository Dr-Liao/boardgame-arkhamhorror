// 食梦者（第五循环）M2 玩家卡账本回归 —— P7。
//
// 这份测试守的是「账本与接线」而不是逐卡行为：逐卡证据由 4 个分片测试文件提供，
// tools/audit-tde-player.mjs 实跑它们后生成 audit/tde-player-acceptance.json 与
// src/cards/tde-player-acceptance.js。这里断言：
//   1. 包清单 87 条记录逐卡 verified：72 张可入牌组、15 张只作依赖
//      （11 张 deckLimit=0 的场外绑定卡/绑定弱点 + 06035–06038 基础弱点）；
//   2. 生成物与账本逐字节同源（模块里的 sha256 等于账本文件哈希），不手改；
//   3. availability 对 87 张全部 strict、72 张进 ALL_BUILDABLE_CODES、15 张 dependencyOnly，
//      且不混入核心+扩张的默认构筑池（PLAYER_CARD_CODES）；
//   4. P7 开放玩家池（EXPANDED_PLAYER_CARD_CODES）收录 72 张 06 可入牌组卡，默认池不变；
//   5. campaign 的升级池只在 06 调查员记录里可见，且 Researched（06236–06238）受
//      youHaveInterpretedTheDreams 记录门控；基础弱点永远不可购买；
//   6. Myriad（多重）同名至多 3 张在构筑校验与界面读数同源（n/3 显示的数据来自同一 helper）；
//   7. 玩家包没有 catalog-only 残留。
//
// 说明：本文件是「账本/接线」测试，导入 engine 只为让注册表可用（registeredEntry 读 researchRequirement）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import '../src/engine/engine.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { implementation } from '../src/cards/card-implementation.js'
import { buildDeck, buildDeckFromList, expandedPlayablePool, EXPANDED_PLAYER_CARD_CODES } from '../src/deck/deckbuilding.js'
import { replacementOptions } from '../src/campaign/campaign.js'
import { registeredEntry } from '../src/engine/ability.js'
import {
  MYRIAD_TITLE_LIMIT, myriadUsage, validateDeckRules,
} from '../web/deck-rules.js'
import {
  ALL_BASIC_WEAKNESS_CODES, ALL_BUILDABLE_CODES, PLAYER_CARD_CODES,
  getAvailability, isCardAvailable,
} from '../src/deck/availability.js'
import {
  PLAYER_CARD_CODES as TDE_PLAYER_CODES, TDE_PLAYER_BUILDABLE_CODES, TDE_PLAYER_DEPENDENCY_CODES,
  tdePlayerBuildable, tdePlayerCardVerified, manifest as playerPack,
} from '../content/packs/tdePlayer/manifest.js'
import {
  TDE_PLAYER_ACCEPTANCE_PROFILE, TDE_PLAYER_ACCEPTANCE_SHA256, TDE_PLAYER_BASIC_WEAKNESS_CODES,
  TDE_PLAYER_VERIFIED_CODES, tdePlayerCardVerified as tdePlayerCardVerifiedGenerated,
} from '../src/cards/tde-player-acceptance.js'

const ledgerBytes = readFileSync(new URL('../audit/tde-player-acceptance.json', import.meta.url))
const ledger = JSON.parse(ledgerBytes.toString('utf8'))
const ledgerSha = createHash('sha256').update(ledgerBytes).digest('hex')
const BASIC = ['06035', '06036', '06037', '06038']
const RESEARCH_RECORD = 'youHaveInterpretedTheDreams'

// 06 段「玩家包记录」口径（与包清单、审计工具同一过滤）：非战役遭遇、非调查员/专属，资产/事件/技能或弱点。
const scope = Object.values(ALL_CARDS)
  .filter(card => /^06\d{3}$/.test(card.code) && !card.encounterCode && !card.signatureFor
    && card.type !== 'investigator'
    && (['asset', 'event', 'skill'].includes(card.type) || ['weakness', 'basicweakness'].includes(card.subtype)))
  .map(card => card.code)
  .sort()
// 可入牌组 = 非基础弱点且印刷 deckLimit>0；其余只作依赖（含 11 张场外绑定卡/绑定弱点）。
const deckable = code => !BASIC.includes(code) && Number(ALL_CARDS[code].deckLimit ?? 0) > 0
const DEPENDENCY = scope.filter(code => !deckable(code))
const DECKABLE = scope.filter(deckable)

// 一个足以通过构筑校验的 06 调查员记录：0 XP 自动牌组 + 可升级的经验。
function recordFor(code, xp = 5) {
  const built = buildDeck(INVESTIGATORS[code], { seed: `p7-tde-ledger-${code}` })
  return {
    id: `ledger-${code}`, seat: 0, code, name: INVESTIGATORS[code].name,
    deck: [...built.playerCards].sort(), currentScenarioIndex: 0,
    xp, earnedXp: xp, spentXp: 0, trauma: { physical: 0, mental: 0 },
    status: 'active', purchases: [], removedCards: [],
  }
}

test('P7 食梦者玩家包：87 条记录全部登记并逐卡 verified，72 张可入牌组、15 张只作依赖', () => {
  assert.equal(TDE_PLAYER_CODES.length, 87, '玩家卡包应登记 87 条记录')
  assert.deepEqual([...TDE_PLAYER_CODES].sort(), scope, '包清单与 06 段玩家卡口径一致')
  assert.equal(scope.length, 87)
  assert.equal(playerPack.cards.length, 87)
  assert.equal(playerPack.status, 'playable')
  assert.match(playerPack.description, /87 条/)
  assert.match(playerPack.description, /72 张/)
  assert.deepEqual([...playerPack.basicWeaknessCodes].sort(), BASIC)
  assert.deepEqual([...TDE_PLAYER_BASIC_WEAKNESS_CODES].sort(), BASIC)
  for (const card of playerPack.cards) {
    assert.equal(card.cataloged, true, card.code)
    assert.equal(card.rulesImplemented, true, `未实现：${card.code}`)
    assert.equal(tdePlayerCardVerified(card.code), true, card.code)
    assert.equal(tdePlayerCardVerifiedGenerated(card.code), true, card.code)
    assert.equal(implementation(card.code).implemented, true, `没有行为通道：${card.code}`)
    assert.equal(tdePlayerBuildable(card.code), deckable(card.code), card.code)
    assert.equal(card.deckbuilding, deckable(card.code), card.code)
    assert.equal(Boolean(card.dependencyOnly), !deckable(card.code), card.code)
  }
  assert.equal(playerPack.cards.filter(card => card.deckbuilding).length, 72)
  assert.equal(TDE_PLAYER_BUILDABLE_CODES.length, 72)
  assert.equal(TDE_PLAYER_DEPENDENCY_CODES.length, 15)
  assert.deepEqual([...TDE_PLAYER_DEPENDENCY_CODES].sort(), DEPENDENCY)
  for (const code of DEPENDENCY) {
    assert.equal(TDE_PLAYER_BUILDABLE_CODES.includes(code), false, `依赖卡不得入构筑池：${code}`)
    assert.equal(playerPack.cards.find(card => card.code === code).dependencyOnly, true, code)
  }
  assert.equal(playerPack.behaviorIds.length, 87)
  for (const id of playerPack.behaviorIds) assert.match(id, /^tdePlayerCard06\d{3}$/)
})

test('P7 验收账本：87 条逐卡证据来自 4 个分片测试，生成模块与账本哈希一致', () => {
  assert.equal(ledger.profile.id, TDE_PLAYER_ACCEPTANCE_PROFILE.id)
  assert.equal(TDE_PLAYER_ACCEPTANCE_SHA256, ledgerSha, '生成模块必须与账本同源：先 --write 再 --check')
  assert.deepEqual(ledger.summary, {
    total: 87, constructible: 72, dependencyOnly: 15, basicWeaknesses: 4, verified: 87, unverified: 0,
    simplified: ledger.summary.simplified,
    testsPassed: ledger.summary.testsPassed,
  })
  assert.ok(ledger.summary.simplified >= 0 && ledger.summary.simplified <= 87)
  assert.equal(ledger.remaining.length, ledger.summary.simplified, 'remaining 与 simplified 数一致')
  for (const item of ledger.remaining) {
    assert.equal(item.kind, '显式简化')
    assert.ok(item.note && item.note.trim(), `${item.code} 的显式简化缺少 note`)
    assert.equal(ledger.entries.find(entry => entry.code === item.code)?.simplified, true, item.code)
  }
  assert.ok(ledger.summary.testsPassed >= 87, `逐卡测试至少 87 条，实际 ${ledger.summary.testsPassed}`)
  assert.equal(ledger.entries.length, 87)
  assert.deepEqual([...TDE_PLAYER_VERIFIED_CODES].sort(), scope)
  assert.deepEqual(ledger.entries.map(entry => entry.code), scope, '账本按卡号排序且覆盖全部 87 条记录')
  const shardFiles = new Set(ledger.testFiles.map(file => file.file))
  assert.deepEqual([...shardFiles].sort(), [
    'games/arkhamhorror/tests/tde-player-m2-1.test.mjs',
    'games/arkhamhorror/tests/tde-player-m2-2.test.mjs',
    'games/arkhamhorror/tests/tde-player-m2-3.test.mjs',
    'games/arkhamhorror/tests/tde-player-m2-4.test.mjs',
  ])
  for (const entry of ledger.entries) {
    const card = ALL_CARDS[entry.code]
    assert.equal(entry.name, card.nameZh || card.name, entry.code)
    assert.equal(entry.type, card.type, entry.code)
    assert.equal(entry.level, card.xp || 0, entry.code)
    assert.equal(entry.basicWeakness, BASIC.includes(entry.code), entry.code)
    assert.equal(entry.deckbuilding, deckable(entry.code), entry.code)
    assert.equal(entry.status, 'verified')
    assert.ok(entry.evidence.length >= 1, `${entry.code} 缺少逐卡行为证据`)
    for (const evidence of entry.evidence) {
      assert.match(evidence.test, new RegExp(`^TDE ${entry.code}\\b`), evidence.test)
      assert.match(evidence.file, /^games\/arkhamhorror\/tests\/tde-player-m2-/, evidence.file)
      // 目录级证据判定：去掉卡号前缀与卡名后再看描述（卡名本身含「存在」等字时不误伤）。
      const rest = evidence.test.replace(new RegExp(`^TDE ${entry.code}\\b`), '').replace(entry.name, '')
      assert.equal(/目录|存在|已登记|可构筑/.test(rest), false, `目录级证据：${evidence.test}`)
    }
  }
})

test('P7 availability：87 条 strict、72 张可入牌组、15 张只作依赖，且默认构筑池不变', () => {
  assert.deepEqual([...ALL_BASIC_WEAKNESS_CODES].filter(code => code.startsWith('06')).sort(), BASIC)
  for (const code of scope) {
    const availability = getAvailability(code)
    assert.equal(availability.availability, 'strict', code)
    assert.equal(availability.strictAccepted, true, code)
    assert.equal(availability.selectable, false, code)
    assert.match(availability.reason, /M2 食梦者玩家卡/, code)
    assert.equal(isCardAvailable(code), true, code)
    assert.equal(availability.deckbuilding, deckable(code), code)
    assert.equal(availability.dependencyOnly, !deckable(code), code)
    assert.equal(ALL_BUILDABLE_CODES.includes(code), deckable(code), code)
  }
  for (const code of DEPENDENCY) {
    assert.equal(ALL_BUILDABLE_CODES.includes(code), false, `依赖卡不得构筑：${code}`)
    assert.equal(getAvailability(code).dependencyOnly, true, code)
  }
  assert.equal(scope.filter(code => getAvailability(code).availability !== 'strict').length, 0,
    '玩家包没有 catalog-only 残留')
  // 默认构筑池（核心 + 既有扩张）不新增 06 卡：既有循环的自动牌组产出保持基线。
  for (const code of scope) assert.equal(PLAYER_CARD_CODES.includes(code), false, `默认池混入 ${code}`)
  // P7 起 06 可入牌组卡进入「开放玩家池」（构筑界面/已开放战役起始牌组），依赖卡不进。
  for (const code of DECKABLE) assert.ok(EXPANDED_PLAYER_CARD_CODES.includes(code), code)
  for (const code of DEPENDENCY) assert.equal(EXPANDED_PLAYER_CARD_CODES.includes(code), false, code)
  assert.equal(expandedPlayablePool().filter(card => card.code.startsWith('06')).length, 72)
})

test('P7 campaign：06 记录的升级池含食梦者玩家卡，既有循环看不到；基础弱点不可购买', () => {
  const tdeRecord = recordFor('06002', 20)
  // 06021 一瓣缟玛瑙是探求者 1 级资产：06 探求者记录应能作为升级购入。
  assert.ok(replacementOptions(tdeRecord, '06021', null).length > 0, '06 记录应能看到食梦者玩家卡的升级候选')
  assert.ok(TDE_PLAYER_BUILDABLE_CODES.includes('06021'))
  // 既有循环（核心 01001）的记录仍然只看得到原有池，06 卡不会出现在升级候选里。
  const coreRecord = recordFor('01001', 20)
  assert.deepEqual(replacementOptions(coreRecord, '06021', null), [], '既有循环记录不得看到 06 卡')
  assert.deepEqual(replacementOptions(coreRecord, '06020', null), [], '既有循环记录不得看到 06 资产')
  // 基础弱点永远不能作为升级目标。
  for (const code of BASIC) assert.deepEqual(replacementOptions(tdeRecord, code, null), [], code)
})

test('P7 Researched：三张梦境日记只在 youHaveInterpretedTheDreams 记录后进入升级池', () => {
  for (const code of ['06236', '06237', '06238']) {
    assert.equal(registeredEntry(code).researchRequirement, RESEARCH_RECORD, `${code} 缺少记录门控声明`)
  }
  const tdeRecord = recordFor('06002', 20)
  // 未记录研究：三张都不出现在升级候选（既不能替换也不能新增）。
  for (const code of ['06236', '06237', '06238']) {
    assert.deepEqual(replacementOptions(tdeRecord, code, null), [], `${code} 未记录研究时不应可购买`)
  }
  // 记录后：可见（换成任意可替换卡成立）。
  const records = { [RESEARCH_RECORD]: true }
  for (const code of ['06236', '06237', '06238']) {
    assert.ok(replacementOptions(tdeRecord, code, records).length > 0, `${code} 记录研究后应可购买`)
  }
  // 其它循环的 Research 记录不会解锁 06 卡。
  assert.deepEqual(replacementOptions(tdeRecord, '06236', { identifiedStrangeSolution: true }), [])
})

test('P7 Myriad：同名至多 3 张在构筑校验生效，界面读数与规则同一来源', () => {
  assert.equal(MYRIAD_TITLE_LIMIT, 3)
  const tommy = INVESTIGATORS['06001']
  const mandy = INVESTIGATORS['06002']
  const luke = INVESTIGATORS['06004']
  // 同名 4 张：超出「多重同名」上限（06020 每套牌限 3，第 4 张触发）。
  const over = validateDeckRules(tommy, ['06020', '06020', '06020', '06020'], ALL_CARDS, { partial: true })
  assert.ok(over.errors.some(error => /多重同名/.test(error)), '第 4 张同名多重卡必须被拦下')
  // 同名 3 张：在多重额度内（partial 模式不校验牌库张数）。
  const three = validateDeckRules(tommy, ['06020', '06020', '06020'], ALL_CARDS, { partial: true })
  assert.deepEqual(three.errors, [], '3 张同名多重卡合法')
  // 06241–06243 三张「增强自我」各限 1 张，合计 3 张共享多重额度：全部合法。
  const variants = validateDeckRules(luke, ['06241', '06242', '06243'], ALL_CARDS, { partial: true })
  assert.deepEqual(variants.errors, [], '三张不同版本的增强自我应合法（共 3 张）')
  // 单卡张数上限仍独立生效：同一版本 2 张违反该卡 deckLimit 1。
  const sameVariant = validateDeckRules(luke, ['06241', '06241'], ALL_CARDS, { partial: true })
  assert.ok(sameVariant.errors.some(error => /张数上限/.test(error)), '同一版本超 1 张必须被拦下')
  // 界面读数：按标题汇总 Myriad 份数与 3 张上限。
  const usage = myriadUsage(['06020', '06020', '06241', '06242', '06243'], ALL_CARDS)
  assert.deepEqual(usage.map(item => ({ name: item.name, count: item.count, limit: item.limit })), [
    { name: 'Solemn Vow', count: 2, limit: 3 },
    { name: 'Empower Self', count: 3, limit: 3 },
  ])
  // Node 侧手动构筑同样不可绕过：30 张同名多重卡在 buildDeckFromList 被拦。
  const built = buildDeckFromList(mandy, Array(30).fill('06021'),
    { playerPool: expandedPlayablePool(), xpBudget: 999 })
  assert.ok(built.errors.some(error => /多重同名/.test(error)), 'buildDeckFromList 必须拦截超过同名 3 张的 Myriad 牌组')
})
