// 90052 彼端（The Beyond · Bleak Netherworld）· 中立 · 支援/圣堂/幽灵 · 吉姆牌库专用 · 永久。
//
// 卡面（cards-data 90052）：
//   Jim Culver deck only. Permanent.
//   Each attached spirit loses all printed traits and gains the [[Geist]] trait. When damage/horror
//     would be placed on an attached spirit, it must be placed on Jim Culver, instead.
//   Forced – When your turn begins: Attach the top card of the spirit deck to The Beyond, as a spirit.
//     If 4 or more spirits are attached, flip this card and resolve its text.
//
// 引擎读点与缺口（全部待原语，见 primitive-requests/core-inv-90052-spirit-deck.json）：
//   · 独立「灵体牌库」（spirit deck，10 张、单独升级、开局洗混面朝下放在 90052 旁）：引擎没有
//     「第二个玩家牌库」的存储/构筑/升级读点；构筑接线另需 Lead 的 deckbuilding 改动（SCOPE §5）。
//   · 「把灵体牌库顶的牌作为灵体附属到本卡」：`api.attachCardFromDeck(host, code)`（api-misc.js）只能从
//     调查员主牌库取牌，不能从独立灵体牌库取；且「附属的灵体」需要实例化 + 特性覆盖
//     （loses printed traits / gains Geist）与伤害/恐惧重定向，均无读点。
//   · 「4 张以上附属则翻面」：`api.flipAsset(asset, nextCode)`（api-misc.js）可翻物理面，但 90052b
//     （背面）不在 cards-data（linkedCardCode 指向的隐藏面数据缺失）→ 需 Lead 先补卡面数据。
//
// 因此本条目当前只有永久卡身份（setup.js 按 cardDef.permanent 开局入场）+ note；行为等原语落地。

const code = '90052'

export default {
  code,
  abilities: [],
  modifiers: [],
  note: '待原语：独立灵体牌库（存储/构筑/升级）、灵体附属与特性覆盖、附属灵体承受伤害/恐惧时重定向到吉姆、4+ 灵体翻面（90052b 背面卡面数据也需补齐）。primitive-requests/core-inv-90052-spirit-deck.json。',
}
