// 批次 4：调查员套件的可用性数据（Lead 维护）。
//
// - 挑战平行套件 / 独立平行版本 / 书籍替换签名 通过 `alternate-investigator-build.js` 的家族表
//   自动进入可选池与签名依赖；这里只登记「非平行家族」的 Subject 5U-21 套件。
// - 本批没有普通玩家牌池新卡（全部是签名/专属弱点），因此不改 PLAYER_CARD_CODES。
export const BATCH4_INVESTIGATORS = Object.freeze(['89001'])

// Subject 5U-21：永久 Ravenous（双面，89002b 为背面/失控面）+ 签名事件 + 专属弱点。
export const BATCH4_DEPENDENCY_CODES = Object.freeze(['89002', '89002b', '89003', '89004'])

export const BATCH4_SIGNATURES_BY_INVESTIGATOR = Object.freeze({
  89001: Object.freeze(['89002', '89003', '89004']),
})
