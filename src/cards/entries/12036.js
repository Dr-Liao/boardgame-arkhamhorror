// 12036 搜集情报（Gather Intel）· 事件 · 探求者 0 经验 · 费用 1
// 卡面：快速。在一个敌人进入你所在地点时打出。抽取 2 张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 参考实现：Event/Events/GatherIntel.hs（PlayThisEvent → drawCards 2）；
//   快速窗口 EnemyEntersYourLocation #when AnyEnemy（= 引擎 enemyEnteredLocation 窗口）。
// 读点：played + fast + trigger 的快速事件统一通道（encounter.js#reactionWindow 候选，
//   窗口上下文 location 负责「你所在地点」过滤）；效果走效果 DSL 的 draw。
export default {
  code: '12036',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'enemyEnteredLocation',
      label: '敌人进入你所在地点时打出：抽 2 张牌',
      effect: { type: 'draw', amount: 2 },
    },
  ],
  modifiers: [],
}
