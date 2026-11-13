// 09586c 邪恶野心家（C）（Sinister Aspirant (C)）· 敌人 · dealings_in_the_dark
// 卡面：警戒。
//   强制 - 当敌军阶段结束时，如果邪恶野心家处于重整状态：在上面放置 1 个毁灭标记。
// 读点：
//   · 警戒（Alert）来自定义表 keyword 解析（card-data 读取卡文）。
//   · 「敌军阶段结束时」没有可枚举的非玩家强制窗口（playerWindow 只对玩家卡开窗）；
//     本条目用 enemyRule 声明数据，由本章 behavior.enemyPhaseEnd 统一执行
//     （读点 card-rules.enemyRuleFor）。A/B/C 三面同一段卡文、同一读点。
const CODE = '09586c'

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  enemyRule: { enemyPhaseEndDoomIfReady: 1 },
  note: '敌军阶段结束的结算在 behavior.enemyPhaseEnd（读 enemyRule.enemyPhaseEndDoomIfReady）；'
    + 'A/B 三面共用同一段卡文与同一读点。',
}
