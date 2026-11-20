// 11573 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11573',
  scope: 'enemy',
  implemented: true,
  note: "印刷：巨大、无情；生命 8/人；另一名[[偷渡者]]敌人被击败时把伤害移到主母上（有毁灭则洗回遭遇牌库）。行为在 behavior.spawnEnemy（生命 8/人）、enemyDefeated / relocateStowawayDamageToMother、checkObjectives（被击败 → 推进蜂巢思维幕，记 apiaryMotherDefeated）。",
  abilities: [],
}
