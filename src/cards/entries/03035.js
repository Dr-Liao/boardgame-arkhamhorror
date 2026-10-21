// 03035 灵力祭祀刀
// 卡面：[free]在[[法术]]卡牌的技能检定期间，横置灵力祭祀刀：你本次检定得到+2技能值。
// 卡面：[action]横置灵力祭祀刀：攻击。你本次攻击得到+2[combat]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03035 灵力祭祀刀：任何技能 +2（法术检定），并带主动攻击能力。

export default {
  code: '03035',
  freeTriggers: [
    { skill: 'any', cost: { exhaust: true }, bonus: 2, requireTestTrait: 'Spell' },
  ],
  abilities: [
    { kind: 'action', label: '灵力祭祀刀攻击', cost: { action: true, exhaust: true },
    effect: { type: 'fight', combatBonus: 2 } },
  ],
  modifiers: [

  ],
}
