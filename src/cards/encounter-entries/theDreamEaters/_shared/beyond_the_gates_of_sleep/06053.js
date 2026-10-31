// 06053 魔幻森林·石制活板门（Enchanted Woods · Stone Trapdoor）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：当你调查本地点时，你手牌中每有 1 张卡牌，本地点帷幕 +1。
// 读点：条目只声明数据 flag；章节 behavior.locationShroudModifier 在 investigation 的帷幕修正里
//   查 entryFlags('06053').shroudPerHandCardWhileInvestigating，按 inv.hand 长度返回 +N。
export default {
  code: '06053',
  scope: 'location',
  implemented: true,
  flags: {
    shroudPerHandCardWhileInvestigating: true,
  },
}
