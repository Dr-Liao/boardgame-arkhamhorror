// 诡镇奇谈：卡牌版 · 声明式卡牌能力（聚合入口）
//
// 行为条目已经拆到 src/cards/entries/<code>.js：一张卡一个文件。
// 本文件只做聚合与公开导出，不再放任何条目；不要在这里加卡。
//
// 新增/修改一张卡：
//   1. 打开或创建 src/cards/entries/<code>.js（新卡用 node tools/scaffold-card.mjs <code> --entry）；
//   2. 修改 export default 的条目；
//   3. 运行 node tools/build-card-index.mjs 更新 entries/index.js；
//   4. 跑 npm run test:fast，并用 replay 基线证明行为零变化。
//
// 规矩由 tests/card-entries.test.mjs 与 architecture-guard 守住。

import { CARD_ENTRY_LIST } from './entries/index.js'

// 已进入能力层的卡号集合。构筑层、图鉴与审计用它判断「这张卡有没有行为实现」。
export const CARD_ABILITY_ENTRIES = CARD_ENTRY_LIST
export const CARD_ABILITY_CODES = new Set(CARD_ABILITY_ENTRIES.map(entry => entry.code))

// Phase 5 迁走的卡号（数据从 EFFECTS 搬进能力层，形状不变）。
export { PHASE5_MIGRATED_CODES } from './phase5-codes.js'
