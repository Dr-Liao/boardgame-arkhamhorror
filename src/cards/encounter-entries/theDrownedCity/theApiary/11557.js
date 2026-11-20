// 11557 · 养育场（theApiary）单卡条目。
// 归属：关卡专用 · theDrownedCity/theApiary（P7 养育场，参考卡 11553）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11557',
  scope: 'act',
  implemented: true,
  flags: {"parley":{"skills":["intellect","combat"],"difficulty":2},"objective":"cultistCardsAtLeast","amount":5,"enemyPhaseEndCultistDamage":"perStowawayAtLocation"},
  note: "行为在 behavior.actions「apiaryParleyCultist」（谈判：成功超出难度 n 点 → 让 n 名**不同**的所在地点[[异教徒]]敌人各移动一次，读 api.test 的 successBy/value 与 api.moveEnemy）、checkObjectives（轮末异教徒卡牌合计 ≥5 必须推进）、actReveal（背面按幕下异教徒 ≥3 张进入结局 1，否则结局 2）。敌军阶段结束的强制（每名[[异教徒]]每与一名[[偷渡者]]同地点受到 1 点伤害）在 behavior.enemyPhaseEnd（引擎既有读点 turn.js#resolveEnemyPhase、api.damageEnemy）。「每名[[异教徒]]敌人获得胜利 0 和冷漠」由 behavior.enemySpawned（enemies.js/turn-flow.js 既有生成后钩子）与 behavior.phaseBegan（阶段开始补写在场敌人）同步到实体：当前幕为 11557 时 enemy.aloof 置为 true、印刷胜利 > 0 的置为 0。全部子句已接线。",
  abilities: [],
}
