// 10087 琥珀腐烂（Aember Rot）· 秘术（Mystic）事件 · 绑定（卡纳玛戈斯之杖）· [[法术]]/[[腐烂]]/[[诅咒萦绕]]
//
// 卡面：
//   绑定（卡纳玛戈斯之杖）。
//   强制 - 在所附属敌人被击败时：获得等于其印刷生命值的资源（最多 5）。
//   强制 - 在所附属敌人离场时：将琥珀腐烂放在一边，位于场外。
//
// 读点（卡面 → 引擎）：
//   · 「绑定（卡纳玛戈斯之杖）」：cards-data 的 bondedTo / bondedCount（bonded.js 的绑定组数据源），
//     由 10085 的 [fast] 能力从绑定组里随机找出并附属到敌人身上。
//   · 「离场时放到一边（场外）」：条目声明 `zoneReplacement: { discard: 'bonded' }` ——
//     player-zones.js#replacePlayerZoneCards 是该声明的唯一引擎读点：这张牌若被送去弃牌堆，
//     直接收回场外绑定集合。
//   · 「附属敌人被击败时获得资源（印刷生命值，最多 5）」：玩家卡附属在敌人身上**不是窗口来源**
//     （ability-rules.js#nonPlayerAbilitySources 只枚举非玩家 scope 条目），本卡自己收不到
//     'defeatEnemy' 窗口。由 10085 条目代为结算：10085 的 ROT_RULES 里 10087 声明
//     `gainResourcesOnDefeatMax: 5`，forced + trigger 'defeatEnemy' 取 min(5, enemy.health)
//     （enemy.health 是印刷生命值）后 api.gainResources，并在同一窗口把本卡收回场外。
//   · 缺口见 primitive-requests/10087.json（窗口来源 + 印刷生命值读数 + 移到一边的能力面写入）。
//
// 显式简化（simplified）：资源与放到一边都挂在 10085 上；「离场」只覆盖被击败路径。
export default {
  code: '10087',
  name: 'Aember Rot',
  simplified: true,
  note: 'simplified: 「附敌被击败获得资源（印刷生命值，≤5）」与「离场时放到一边」由 10085 的 ROT_RULES 代算（玩家卡附敌不是窗口来源）；数值取 min(5, enemy.health)，「离场」只覆盖被击败路径；本条的 zoneReplacement 是「放到一边」的引擎读点；见 primitive-requests/10087.json',
  zoneReplacement: { discard: 'bonded' },
}
