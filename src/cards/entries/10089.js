// 10089 猩红腐烂（Scarlet Rot）· 潜修者 · 事件 · 绑定（卡纳玛戈斯之杖）· 法术/腐烂/诅咒
// 卡面：
//   绑定（卡纳玛戈斯之杖）。
//   强制 - 当一轮结束时：所附属敌人受到 1 点伤害。
//   强制 - 在所附属敌人离场时：将猩红腐烂放在一边，位于场外。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 这张卡永远不从手牌打出（dependencyOnly + 绑定面）：它由 10085 / 10098 卡纳玛戈斯之杖查找后
// 附属到非精英敌人身上。玩家卡附属在敌人身上**不是能力窗口来源**（ability-rules.js#nonPlayerAbilitySources
// 只收非玩家 scope 条目，window-listeners.js#hasWindowListener 也不扫 enemy.attachments），
// 所以两条强制效果按「卡面数据 + 持杖者读点」的形状声明（与 10086/10087/10088 同一套约定）：
//
//   · treacheryRule.rotRule.roundEndDamage = 1
//     读点：10098（以及 10085 的同一套腐烂实现）的 forced/roundEnds —— 轮末扫描敌人身上带该字段的
//     [[腐烂]]附属，用 api.damageEnemy 对其宿主造成等量伤害。数据在腐烂卡上，结算在持杖者上。
//   · zoneReplacement.discard = 'bonded'
//     读点：player-zones.js#replacePlayerZoneCards；持杖者在 'defeatEnemy' 窗口用 api.putIntoDiscard
//     把腐烂推进弃置通道，这张牌不进弃牌堆而是直接收回场外绑定集合（＝「放在一边，位于场外」）。
//
// 近似披露（simplified）：「轮末伤害」挂在持杖者上而不是本条目自己的 forced 描述子（见
// primitive-requests/10089.json）；「放在一边」只覆盖"被击败"这一条离场路径（其它离场没有玩家卡窗口）；
// 杖离场后轮末伤害停止（印刷上腐烂仍留在敌人身上）。
export default {
  code: '10089',
  name: '猩红腐烂',
  simplified: true,
  note: 'simplified: 「轮末 1 点伤害」由持杖者（10098/10085）读本条的 treacheryRule.rotRule.roundEndDamage 结算'
    + '（玩家卡附敌不是窗口来源）；本轮分片只接到 10098，等级 0 的 10085（M2-7 分片）需要主进程补同一分支；'
    + '「离场放在一边」走 zoneReplacement.discard=bonded，只覆盖被击败路径；杖离场后轮末伤害停止。'
    + '见 primitive-requests/10089.json。',
  treacheryRule: { rotRule: { roundEndDamage: 1 } },
  zoneReplacement: { discard: 'bonded' },
  abilities: [],
  modifiers: [],
}
