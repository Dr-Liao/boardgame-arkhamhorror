// 07166 深海的魔鬼 · 魔鬼礁石（议程 2a）
//
// 印刷（中文）：
//   你不在载具上时，作为在[[海洋]]地点间移动的额外费用，你必须花费2行动。
//   强制 - 在你回合开始时，如果你位于完全淹没的地点，你奋力挣扎，求取空气：在你回合结束时，
//          如果你在自己回合期间没有进入过载具、未淹没或部分淹没的地点，受到5点直接伤害。
// 背面「浪涛得胜」：在剧本日志中，记录浪潮愈烈。(→结局1)
// 印刷（英文）：
//   Front: As an additional cost for you to move from one [[Ocean]] location to another while
//     not in a vehicle, you must spend 2 actions. / Forced - When your turn begins, if you are at a
//     fully flooded location, you struggle for air: ...
//   Back "Triumph of the Waves": Record in your Campaign Log the tide has grown stronger. (→R1)
//
// 引擎读点：
//   · 正面两句与 07164/07165 相同：步行额外费用走 `agendaRule.movementActionSurcharge`
//     （turn-flow.js，载具上不付）；求取空气由引擎的水位规则承担（turn.js 的 beginAirTurn /
//     endAirTurn 与 flood.js 的 effectiveFloodLevel），条目不再重复声明。
//   · 背面 = `agendaRule.onReveal`（读点 content/.../entry-rules.js#agendaReveal）：
//     `api.setCampaignRecord('TheTideHasGrownStronger', true)`（campaign/records.js 的 TIC 记录表
//     含该键）+ `api.finish('resolution1')`（content/.../resolutions.js#resolveChapter 的
//     devilReef 分支读取该记录）；与 07279 的「记录 + finish」同形。
//
// 共用模板位置：07164/07165/07166 三张「大海的秘密 / 深海的魔鬼」正面逐字相同，正面规则只写
// movementActionSurcharge；背面 07164/07165 生成魔鬼礁石的骇物，07166 记录浪潮愈烈进入结局 1。
//
// implemented：正面两句由引擎读点承担；背面 onReveal 已接线，测试见
//   tests/tic-middle-remaining.test.mjs。

export default {
  code: '07166', scope: 'agenda', implemented: true,
  agendaRule: {
    movementActionSurcharge: { amount: 2, betweenTraits: ['Ocean'] },
    onReveal(state, agenda, api) {
      api.setCampaignRecord('TheTideHasGrownStronger', true)
      api.finish('resolution1')
    },
  },
}
