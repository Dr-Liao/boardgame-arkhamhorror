// 05033 恐怖灵感
// 卡面：快速。在你将要结算一张[mystic]卡牌上的效果，且该卡牌有以下触发条件时打出：
//       在[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号揭示时；
//       如果揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号；
//       在[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号揭示后。
//       取消该效果，或额外结算一次该效果。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05033 恐怖灵感：symbolRevealed 窗口的快速事件。
// 显式简化：引擎没有「符号触发的卡牌效果」通用取消/重复窗口（见
// artifacts/migration/tcu/primitive-requests/w-m2-1-cancel-or-repeat-symbol-effect.json）。
// 已实现：在符号揭示窗口打出，取消该符号标记本次的效果（包括它的修正值）；[auto_fail] 没有对应窗口。

export default {
  code: '05033',
  simplified: true,
  note: '未实现：① 「额外结算一次该效果」；② 「取消该效果」近似为取消该符号标记本次的效果（含修正值）——没有「卡牌符号触发效果」的通用取消窗口；③ [auto_fail] 符号没有可打出的窗口。',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'symbolRevealed',
      label: '恐怖灵感：取消该符号标记本次的效果',
      effect: { type: 'cancelSymbolToken', code: '05033' },
    },
  ],
  modifiers: [

  ],
}
