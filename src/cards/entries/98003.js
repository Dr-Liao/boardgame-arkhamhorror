// 98003 献祭野兽（Sacrificial Beast）· 中立 · 敌人/弱点 · 替换（珍妮·巴恩斯）。
// 卡面（cards-data 98003）：
//   珍妮·巴恩斯牌库专用。替换。
//   生成 - 离你最远的地点。
//   珍妮·巴恩斯不能通过玩家卡牌效果获得资源。
//
// 引擎读点：
//   · 「生成 - 离你最远的地点」= 条目级 weaknessSpawnsAtFarthestLocation（weakness.js 的敌人弱点分支
//     读取该标记，按 api.farthestLocations 生成；与 03042/06012/12099 同一读点）。
//   · 敌人基础关键词（prey/猎手等）走 entry.enemyWeakness（card-lookup.js#enemyDef 合并）。
// 缺原语：「不能通过玩家卡牌效果获得资源」是敌人对调查员施加的持续限制；引擎的
//   capability:gainResources 只能由调查员自己的支援/威胁声明（无法从敌人投射），也没有
//   「仅限玩家卡牌效果」的区分 → primitive-requests/core-cards-a-98003-resource-gain-lock.json。
//   当前条目先接线生成规则（弱点的战斗/结算仍可正常进行），限制效果待原语。
const code = '98003'

export default {
  code,
  weaknessSpawnsAtFarthestLocation: true,
  enemyWeakness: {},
  abilities: [],
  modifiers: [],
  note: '近似：「生成 - 离你最远的地点」已接线（weaknessSpawnsAtFarthestLocation 读点）；「珍妮不能通过玩家卡牌效果获得资源」缺敌人向调查员投射的持续限制读点 → primitive-requests/core-cards-a-98003-resource-gain-lock.json。',
}
