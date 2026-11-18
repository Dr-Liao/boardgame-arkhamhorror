// 10090 霉绿腐烂（Virescent Rot）· 潜修者 · 事件 · 绑定（卡纳玛戈斯之杖）· 法术/腐烂/诅咒
// 卡面：
//   绑定（卡纳玛戈斯之杖）。
//   所附属敌人不能移动。
//   强制 - 在所附属敌人离场时：将霉绿腐烂放在一边，位于场外。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 这张卡永远不从手牌打出（dependencyOnly + 绑定面）：由 10085 / 10098 卡纳玛戈斯之杖查找后
// 附属到非精英敌人身上（见 10085 / 10098 的 resolve）。
//
// 读点 / 缺口（逐条）：
//   1. 「附属到敌人」：持杖者的 attach 流程（api.moveCard 的 attached 通道 / api.attachPlayerCardToAsset
//      写 enemy.attachments）。
//   2. 「所附属敌人不能移动」：**没有读点**。引擎的敌人移动拦截只有 `enemy.immobile` 一个布尔读点
//      （movement.js#relocateEnemy / enemy-keyword-movement.js / turn.js 的猎手移动），而它不能由卡面声明：
//        · modifiers.ENTITY_RULE_TARGETS 没有 cannot:move（只有 cannot:attack / cannot:parley / loses:aloof …）；
//        · entityModifierRows 只读实体自己的条目、所在地点、幕/议程、敌人光环与旁置卡，**不读 enemy.attachments**；
//        · enemy.attachments 的现存读点只有 treacheryRule.attackBonus / enemyKeywordAura / restrainsReady /
//          restrainsDoom / attachmentAbilities —— 都不表达「禁止移动」。
//      因此本条目**不声明**无人读取的字段（「声明即接线」），只保留身份 + 披露，
//      「不能移动」作为缺读点在 primitive-requests/10090.json 排队（通用原语：敌人附属卡的规则读点）。
//   3. 「离场时放在一边」：zoneReplacement.discard = 'bonded'（读点 player-zones.js#replacePlayerZoneCards）；
//      持杖者在 'defeatEnemy' 窗口用 api.putIntoDiscard 触发，这张牌直接回到场外绑定集合。
//
// 近似披露（simplified）：「所附属敌人不能移动」尚未接线（缺敌人附属的实体规则读点）；
// 「放在一边」只覆盖被击败这一条离场路径。
export default {
  code: '10090',
  name: '霉绿腐烂',
  simplified: true,
  note: 'simplified: 「所附属敌人不能移动」未接线——引擎的移动拦截只有 enemy.immobile，且 enemy.attachments '
    + '不是实体规则/修正来源（entityModifierRows 不扫敌人附属）；缺通用原语「敌人附属卡规则读点」'
    + '（primitive-requests/10090.json）。「离场放在一边」走 zoneReplacement.discard=bonded（被击败路径）。',
  zoneReplacement: { discard: 'bonded' },
  abilities: [],
  modifiers: [],
}
