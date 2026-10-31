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
// 显式简化（simplified）：「基础攻击行动期间才获得[combat][combat]」——conditionalIcons 没有
// 「检定行动类型」条件（只支持手牌/资源/毁灭/某类支援数量），因此额外图标与 +2 伤害对任何战斗检定生效。

export default {
  code: '06166',
  simplified: true,
  note: '未实现：仅在「基础攻击行动期间投入」才获得 [combat][combat] 与 +2 伤害的限定'
    + '（conditionalIcons 没有检定行动类型条件）；额外图标未写，+2 伤害按「成功超出难度 ≥2」对所有战斗检定生效。'
    + '每次技能检定最多投入 1 张已由 maxPerTest 生效。',
  abilities: [
    {
      kind: 'commit',
      label: '蛮力',
      skill: { maxPerTest: 1, successBy: { threshold: 2, damageBonus: 2 } },
    },
  ],
  modifiers: [],
}
