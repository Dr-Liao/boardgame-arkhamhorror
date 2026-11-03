// 06166 蛮力
// 卡面：每次技能检定最多投入1张。
// 卡面：将蛮力在基础攻击行动期间投入时，其获得[combat][combat]和以下文本：
//       “如果本次检定成功且超过难度至少2点，本次攻击造成+2伤害。”
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现：commit 描述子
//   · maxPerTest: 1（「每次技能检定最多投入1张」）；
//   · 印刷 1 个[combat]图标来自卡面数据；
//   · successBy: { threshold: 2, damageBonus: 2 }（成功超出难度 ≥2 时本次攻击 +2 伤害，
//     读点 skill-effects.js 的 applySkillOnSuccess → skillFx.damageBonus → doFight 伤害合计）。
// 额外图标和成功差值伤害均限定基础攻击行动。

export default {
  code: '06166',
  abilities: [
    {
      kind: 'commit',
      label: '蛮力',
      skill: {
        maxPerTest: 1,
        iconBonus: ({ skill, test }) => test?.basicAction === 'fight'
          && (Array.isArray(skill) ? skill.includes('combat') : skill === 'combat') ? 2 : 0,
        successBy: { threshold: 2, damageBonus: 2, when: ({ test }) => test?.basicAction === 'fight' },
      },
    },
  ],
  modifiers: [],
}
