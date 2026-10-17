// develop/smoke-p6.mjs —— Phase 6 冒烟测试：验证「前端升级」的后端支撑。
//
// 覆盖：
//   1. Mod 导出 deckBuilder / campaigns 元数据（供 /api/catalog 下发前端）；
//   2. deckBuilderData 结构（5 名核心调查员 + 核心 0 级卡池）；
//   3. buildDeckFromList 校验（合法 30 张通过 / 非法拒绝）；
//   4. createGameState 接受 settings.playerDeck（人类自定义卡组，AI 自动）；
//   5. 非法自定义卡组回退自动构筑（不崩溃 + 记录日志）。
import mod from '../games/arkhamhorror/index.js'
import { createGameState } from '../games/arkhamhorror/engine.js'
import {
  deckBuilderData, buildDeck, buildDeckFromList, corePlayablePool,
} from '../games/arkhamhorror/deckbuilding.js'
import { INVESTIGATORS } from '../games/arkhamhorror/cards-data.js'

let failures = 0
function check(cond, msg) {
  if (cond) console.log('✔ ' + msg)
  else { failures++; console.log('✘ ' + msg) }
}

const roland = INVESTIGATORS['01001']

// ===========================================================================
// 1. Mod 导出
// ===========================================================================
{
  check(!!mod.deckBuilder, 'Mod 导出 deckBuilder')
  check(Array.isArray(mod.campaigns) && mod.campaigns.length === 1, 'Mod 导出 campaigns（1 个战役）')
  check(mod.campaigns[0].scenarios.length === 3, 'campaigns 含 3 关剧本')
}

// ===========================================================================
// 2. deckBuilderData 结构
// ===========================================================================
{
  const db = deckBuilderData()
  check(db.investigators.length === 5, 'deckBuilder 含 5 名核心调查员')
  check(db.cardPool.length >= 50, 'deckBuilder 含核心 0 级卡池（实际 ' + db.cardPool.length + '）')
  check(db.investigators.every((i) => i.deckOptions && i.deckOptions.length > 0), '每名调查员都有构筑限制 deckOptions')
  check(db.investigators.every((i) => i.signatureCards.length + i.signatureWeaknesses.length >= 2), '每名调查员含签名卡/专属弱点')
}

// ===========================================================================
// 3. buildDeckFromList 校验
// ===========================================================================
{
  const auto = buildDeck(roland, { seed: 'p6', playerPool: corePlayablePool() })
  check(auto.playerCards.length === 30, '自动构筑 playerCards 恰为 30 张')

  const built = buildDeckFromList(roland, auto.playerCards, { seed: 'p6' })
  check(Array.isArray(built.errors) && built.errors.length === 0, 'buildDeckFromList 合法卡组无错误')
  check(built.deck.length >= 30, '自定义牌库含签名卡/弱点（' + built.deck.length + ' 张）')

  const bad = buildDeckFromList(roland, ['99999', ...auto.playerCards.slice(0, 29)], { seed: 'p6' })
  check(bad.errors.length > 0, 'buildDeckFromList 拒绝未知卡（' + bad.errors.join('；') + '）')

  // 超张数上限：同一张非唯一卡塞 3 张应报错。
  const dup = auto.playerCards.slice(0, 29)
  dup.push(dup[0], dup[0]) // 前 29 + 首卡×2 额外 → 首卡共 3 张
  const dupBuilt = buildDeckFromList(roland, dup, { seed: 'p6' })
  check(dupBuilt.errors.some((e) => e.includes('张数上限')), 'buildDeckFromList 拒绝超张数上限')
}

// ===========================================================================
// 4. createGameState 接受 settings.playerDeck
// ===========================================================================
{
  const auto = buildDeck(roland, { seed: 'p6custom', playerPool: corePlayablePool() })
  const settings = { difficulty: 'standard', playerInvestigator: '01001', playerDeck: auto.playerCards }
  const players = [{ seat: 0 }, { seat: 1 }]
  const state = createGameState(settings, players)
  const human = state.investigators[0]
  check(state.customPlayerDeck && state.customPlayerDeck.length === 30, 'createGameState 记录 customPlayerDeck')
  const humanAll = human.deck.concat(human.hand)
  check(auto.playerCards.every((c) => humanAll.includes(c)), '人类牌库（含手牌）包含全部自定义卡')
  const aiAll = state.investigators[1].deck.concat(state.investigators[1].hand)
  check(aiAll.length >= 30, 'AI 牌库自动构筑（牌库+手牌 ' + aiAll.length + ' 张）')
  const logText = state.log.join(' ')
  check(logText.includes('自定义卡组'), '开局日志记录「自定义卡组」')
}

// ===========================================================================
// 5. 非法自定义卡组回退自动构筑
// ===========================================================================
{
  const settings = { difficulty: 'standard', playerInvestigator: '01001', playerDeck: ['99999', '99999'] }
  const players = [{ seat: 0 }, { seat: 1 }]
  const state = createGameState(settings, players)
  const all = state.investigators[0].deck.concat(state.investigators[0].hand)
  check(all.length >= 30, '非法自定义卡组回退自动构筑（无崩溃，' + all.length + ' 张）')
  check(state.log.join(' ').includes('回退自动构筑'), '回退时记录日志')
}

if (failures) {
  console.log('\n❌ Phase 6 冒烟测试失败：' + failures + ' 项未通过。')
  process.exit(1)
}
console.log('\n✅ Phase 6 冒烟测试全部通过。')
