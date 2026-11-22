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
  '12062': Object.freeze(['60460']),
  '12059': Object.freeze(['60459']),
  '12019': Object.freeze(['60155']),
  '60305': Object.freeze(['60361']),
  '08073': Object.freeze(['12073']),
  '08058': Object.freeze(['60384']),
  '08057': Object.freeze(['60379']),
  '05278': Object.freeze(['12056']),
  '05276': Object.freeze(['12042']),
  '05114': Object.freeze(['12077']),
  '05024': Object.freeze(['12031']),
  '04199': Object.freeze(['12064']),
  '04103': Object.freeze(['12024']),
  '03235': Object.freeze(['60469']),
  '03233': Object.freeze(['60371']),
  '03040': Object.freeze(['12100']),
  '03031': Object.freeze(['60372']),
  '02299': Object.freeze(['60176']),
  '02268': Object.freeze(['12069']),
  '02158': Object.freeze(['12095']),
  '02157': Object.freeze(['12096']),
  '02150': Object.freeze(['60275']),
  '01097': Object.freeze(['12101']),
  '01096': Object.freeze(['12097']),
  '01093': Object.freeze(['12094']),
  '01092': Object.freeze(['12091']),
  '01091': Object.freeze(['12092']),
  '01090': Object.freeze(['12093']),
  '01089': Object.freeze(['12090']),
  '01088': Object.freeze(['12089']),
  '01065': Object.freeze(['12065']),
  '01063': Object.freeze(['60455']),
  '01040': Object.freeze(['60270']),
  '01037': Object.freeze(['12038']),
  '01030': Object.freeze(['12034']),
  '01020': Object.freeze(['12020']),
  '07114': Object.freeze(['12050']),
  '07004': Object.freeze(['98016']),
  // 批次 4：小说/纪念印刷的调查员正面是原版重印号（只改 code，行为复用 canonical）。
  '01001': Object.freeze(['98004']),
  '05001': Object.freeze(['98010']),
  '05006': Object.freeze(['99001']),
  // 扒手行窃工具 Thieves' Kit：12049 是 09064 的跨循环重印号（cards-data duplicatedBy）。
  '09064': Object.freeze(['12049']),
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
  '01017': Object.freeze(['60108']),
  '01025': Object.freeze(['60119', '12025']),
  '02020': Object.freeze(['60212', '12032']),
  '02186': Object.freeze(['60218', '60263']),
  '01039': Object.freeze(['60219', '12039', '60267']),
  '01044': Object.freeze(['60307']),
  '04107': Object.freeze(['60308', '12044']),
  '03194': Object.freeze(['60312']),
  '03030': Object.freeze(['60313']),
  '04232': Object.freeze(['60314']),
  '01053': Object.freeze(['60319']),
  '02029': Object.freeze(['60405']),
  '03034': Object.freeze(['60413']),
  '02153': Object.freeze(['60414']),
  '04032': Object.freeze(['60417']),
  '02190': Object.freeze(['60418']),
  '01075': Object.freeze(['60510', '60560']),
  '04034': Object.freeze(['60514']),
  '04200': Object.freeze(['60516']),
  '01079': Object.freeze(['60517', '12078']),
  '02113': Object.freeze(['60518']),
  '04201': Object.freeze(['60519']),
  '60227': Object.freeze(['01685']),
  '51007': Object.freeze(['01689']),
})

export function reprintAliasesFor(code) {
  return REPRINT_ALIASES[code] || null
}
