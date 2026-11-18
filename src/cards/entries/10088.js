// 10088 流脓腐烂（Putrescent Rot）· 秘术（Mystic）事件 · 绑定（卡纳玛戈斯之杖）· [[法术]]/[[腐烂]]/[[诅咒萦绕]]
//
// 卡面：
//   绑定（卡纳玛戈斯之杖）。
//   所附属的敌人得到 -1 攻击值和 -1 躲避值。
//   强制 - 在所附属敌人离场时：将流脓腐烂放在一边，位于场外。
//
// 读点（卡面 → 引擎）：
//   · 「绑定（卡纳玛戈斯之杖）」：cards-data 的 bondedTo / bondedCount（bonded.js 的绑定组数据源），
//     由 10085 的 [fast] 能力从绑定组里随机找出并附属到敌人身上。
//   · 「离场时放到一边（场外）」：条目声明 `zoneReplacement: { discard: 'bonded' }` ——
//     player-zones.js#replacePlayerZoneCards 是该声明的唯一引擎读点：这张牌若被送去弃牌堆，
//     直接收回场外绑定集合。
//   · 「-1 攻击值 / -1 躲避值」：引擎的敌人数值修正读点 entityModifierTotal 只读「敌人自己的卡号条目、
//     它所在地点、幕/议程、敌方光环」，**不读敌人身上的附属**。由 10085 条目在附属时按
//     ROT_RULES 里 10088 声明的 `enemyStatModifiers` 调 api.addEnemyStatModifier 写入
//     （读点 enemies.js#runtimeEnemyStat，无 until = 持续到敌人离场；与 09025 绊脚索 -1 躲避同源）。
//     该修正不随附属被移除而撤销（目前没有卡能把 [[腐烂]] 从敌人身上取走）。
//   · 缺口见 primitive-requests/10088.json（附属驱动的敌人数值修正读点 + 按来源撤销）。
//
// 显式简化（simplified）：-1/-1 是「附属时写入的持久修正」；「离场」只覆盖被击败路径；
// 杖离场后新附属不再写入修正（已写入的仍在）。
export default {
  code: '10088',
  name: 'Putrescent Rot',
  simplified: true,
  note: 'simplified: 「-1 攻击/-1 躲避」由 10085 在附属时按 ROT_RULES 写 api.addEnemyStatModifier（持久修正，不随附属移除撤销）；「离场时放到一边」只在被击败路径结算；本条的 zoneReplacement 是「放到一边」的引擎读点；见 primitive-requests/10088.json',
  zoneReplacement: { discard: 'bonded' },
}
