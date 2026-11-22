// 98009 复仇猎犬（Vengeful Hound）· 中立 · 敌人/弱点 · 替换（诺曼·威瑟斯）。
// 卡面（cards-data 98009）：
//   诺曼·威瑟斯牌库专用。替换。
//   猎物 - 诺曼·威瑟斯。
//   当复仇猎犬与你交战时，你不能通过玩家卡牌效果抽牌或揭示卡牌。
//
// 引擎读点：
//   · 弱点敌人由引擎 weakness.js 的 enemy 分支生成（按调查员所在地出现并交战）；
//   · 猎物/基础关键词 = entry.enemyWeakness（card-lookup.js#enemyDef 合并的 prey: 'bearer'，
//     与 04014 同一读点）；
//   · 弱点敌人被击败后的去向由引擎的弱点归属处理（weaknessOwnerSeat）。
// 缺原语：「与你交战时不能通过玩家卡牌效果抽牌/揭示」是敌人向调查员投射的持续限制；
//   capability:drawCards 只能由调查员自己的支援/威胁声明，且不区分「玩家卡牌效果」
//   → primitive-requests/core-cards-a-98009-hound-draw-lock.json。当前条目先接线猎物/生成。
const code = '98009'

export default {
  code,
  enemyWeakness: { prey: 'bearer' },
  abilities: [],
  modifiers: [],
  note: '近似：猎物（诺曼）与弱点敌人的生成/结算由引擎弱点分支接线（enemyWeakness.prey 读点）；「交战时不能通过玩家卡牌效果抽牌或揭示」缺敌人向调查员投射的限制读点 → primitive-requests/core-cards-a-98009-hound-draw-lock.json。',
}
