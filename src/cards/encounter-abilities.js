// 诡镇奇谈：卡牌版 · 非玩家卡能力（聚合入口 / facade）
//
// 行为条目已经拆到 src/cards/encounter-entries/<归属目录>/<code>.js：一条目一个文件。
// 本文件只做聚合与公开导出，不再放任何条目；不要在这里加卡。
//
// 新增/修改一张非玩家卡：
//   1. node tools/scaffold-card.mjs <code> --encounter   （按归属自动落点）
//   2. 修改落点的单卡文件；
//   3. node tools/build-encounter-index.mjs --write       （或 npm run cards:encounter-index）
//   4. npm run test:fast；行为改动先用 replay-fixtures --baseline / --compare 证明零变化。
//
// 规矩由 tests/encounter-entries.test.mjs 与 architecture-guard 守住。

import { NON_PLAYER_ENTRY_LIST } from './encounter-entries/index.js'
import { entryByCode } from './encounter-entries/_lookup.js'
import { originalOf, victoryVengeance } from './encounter-entries/_shared.js'

// 已进入能力层的非玩家条目（保持旧数组顺序；12 个 import 点读取这里）。
export const NON_PLAYER_ABILITY_ENTRIES = NON_PLAYER_ENTRY_LIST
export const NON_PLAYER_ABILITY_CODES = new Set(NON_PLAYER_ABILITY_ENTRIES.map(entry => entry.code))

// 内容层直接按卡号取非玩家条目，不依赖引擎注册表（单元测试可只 import behavior）。
export const nonPlayerEntryFor = entryByCode

// 供内容层复用的读点（避免在 behavior.js 里再写一遍「复仇点数」）。
export { originalOf, victoryVengeance }
