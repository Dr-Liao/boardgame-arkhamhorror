// 11575 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
//
// P7 第四轮：「强制 - 本地点一张卡牌被放置毁灭标记时：重整养育场看守。其本轮失去冷漠。
// 如果其与一位调查员交战，该敌人立刻攻击。」由章节 behavior.doomPlaced（引擎既有
// act-agenda.js#placeDoomOnCard 读点，context { target, amount }）结算：
//   api.readyEnemy → api.setEnemyKeywords(['aloof'], { enabled:false, throughRound }) →
//   若已交战则 api.attack(enemy, 对应调查员)。
export default {
  code: '11575',
  scope: 'enemy',
  implemented: true,
  note: "印刷：冷漠、猎手；猎物 = 敏捷最低者；强制 - 本地点一张卡牌被放置毁灭标记时：重整养育场看守，其本轮失去冷漠，若与一位调查员交战则该敌人立刻攻击。已接线：触发在章节 behavior.doomPlaced（引擎既有 act-agenda.js#placeDoomOnCard 读点，context { target, amount }；目标卡的地点 = 看守所在地点），结算走 api.readyEnemy + api.setEnemyKeywords(['aloof'], { enabled:false, throughRound:state.round }) + api.attack；猎物 = 敏捷最低者由 preyRank/enemyRule 数据与引擎猎物读点处理。行为：data-type（遭遇牌库 ×3）。全部子句已接线。",
  abilities: [],
}
