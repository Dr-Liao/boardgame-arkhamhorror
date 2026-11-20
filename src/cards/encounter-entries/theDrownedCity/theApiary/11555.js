// 11555 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11555',
  scope: 'agenda',
  implemented: true,
  flags: {"spawnEnemyOnDoom":"noNonElite","backDefeatsAll":true},
  note: "data-type：阈值 doom=6。正面强制在 behavior.doomPlaced（没有非精英敌人时从遭遇牌库顶翻到一名敌人生成）；背面在 behavior.agendaReveal（每位未撤退调查员被击败）。",
  abilities: [],
}
