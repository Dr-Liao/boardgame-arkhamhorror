// 重印别名表（P2-4，2026-10-28）：同一张印刷卡只保留 01xx canonical 实现，
// 015xx（Revised Core）/ 60xxx 等重印号在注册期生成「只改 code 的别名条目」。
//
// 数据约束（tests/reprint-aliases.test.mjs 守卫）：
//   · cards-data 的 duplicateOfCode / duplicatedBy 是唯一事实源；
//   · 别名号没有自己的条目文件（一卡一文件：实现只在 canonical 文件里）；
//   · 别名号在运行时门槛（stats.runtimeCardAvailable）沿用 canonical 的可用性；
//     构筑/牌池可用性仍在 deck 层判定，不受影响。
//
// 为什么是白名单：cards-data 有 160+ 个未实现的重印/推广号（015xx/120xx/60xxx），
// 全量自动生成会与测试的 test-only 条目撞号，也会把「未实现」误登记成「已实现」。
// 文件放在 entries/ 下是因为硬编码守卫只允许卡号出现在 entries/**、encounter-entries/** 与
// cards-data.js；本文件不 import 任何模块，卡文件与索引生成器把它当 _shared.js 一样忽略。
export const REPRINT_ALIASES = Object.freeze({
  // 巡警 Beat Cop
  '01018': Object.freeze(['01518']),
  // 证据！Evidence!
  '01022': Object.freeze(['01522']),
  // 闪躲 Dodge（60113 是后续产品的同卡重印）
  '01023': Object.freeze(['01523', '60113']),
  // 警徽 Police Badge
  '01027': Object.freeze(['01527']),
  // 米兰·克里斯托弗博士 Dr. Milan Christopher
  '01033': Object.freeze(['01533']),
})

export function reprintAliasesFor(code) {
  return REPRINT_ALIASES[code] || null
}
