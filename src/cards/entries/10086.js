// 10086 深渊腐烂（Abyssal Rot）· 秘术（Mystic）事件 · 绑定（卡纳玛戈斯之杖）· [[法术]]/[[腐烂]]/[[诅咒萦绕]]
//
// 卡面：
//   绑定（卡纳玛戈斯之杖）。
//   所附属的敌人不能攻击。
//   强制 - 在所附属敌人离场时：将深渊腐烂放在一边，位于场外。
//
// 读点（卡面 → 引擎）：
//   · 「绑定（卡纳玛戈斯之杖）」：cards-data 的 bondedTo / bondedCount（bonded.js 的绑定组数据源），
//     本卡不进牌库、不参与构筑；由 10085 的 [fast] 能力从绑定组里随机找出并附属到敌人身上。
//   · 「离场时放到一边（场外）」：条目声明 `zoneReplacement: { discard: 'bonded' }` ——
//     player-zones.js#replacePlayerZoneCards 是该声明的唯一引擎读点：这张牌若被送去弃牌堆，
//     直接收回场外绑定集合（10085 在被击败窗口调 api.putIntoDiscard，见下）。
//   · 「所附属的敌人不能攻击」：玩家卡附属在敌人身上**不是窗口来源**
//     （ability-rules.js#nonPlayerAbilitySources 只枚举非玩家 scope 条目），引擎也没有实例级
//     `cannot:attack` 的写入口，因此这条被动力由 10085 条目代为结算（10085 的 ROT_RULES 里
//     10086 声明 `enemyCannotAttack`，forced + trigger 'enemyAttack' 取消该敌人的攻击）。
//     同一条 ROT_RULES 也负责在本卡离场时把本卡送回场外。
//   · 缺口见 primitive-requests/10086.json（把敌人附属玩家卡纳入窗口来源 + 实例级 cannot:attack）。
//
// 显式简化（simplified）：被动力挂在 10085 上，杖离场后失效；「离场」只覆盖被击败路径。
export default {
  code: '10086',
  name: 'Abyssal Rot',
  simplified: true,
  note: 'simplified: 「所附属的敌人不能攻击」与「离场时放到一边」由 10085 的 ROT_RULES 代算（玩家卡附敌不是窗口来源，无实例级 cannot:attack 写入口）；「离场」只覆盖被击败路径，杖离场后被动力失效；本条的 zoneReplacement 是「放到一边」的引擎读点；见 primitive-requests/10086.json',
  // 「强制 - 在所附属敌人离场时：放到一边，位于场外」：弃置通道把它收回场外绑定集合。
  zoneReplacement: { discard: 'bonded' },
}
