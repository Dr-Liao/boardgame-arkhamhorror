// 06204 目力敏锐
// 卡面：每次技能检定最多投入 1 张。
//       将目力敏锐在基础调查行动期间投入时，其获得[intellect][intellect]和以下文本：
//       “如果这次检定成功且超过难度至少 2 点，发现本地点的额外 1 个线索。”
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 已实现：每次检定最多 1 张（commit 档案 maxPerTest: 1）；成功超过难度 2 点额外发现 1 个线索
//   （commit 档案 successBy → clueBonus，由调查流程的线索发现读点统一结算，非调查检定自然无效）。
// 未实现（显式简化）：「基础调查行动期间获得 [intellect][intellect]」——条件技能图标
//   （conditionalIcons）没有「本次检定来自基础调查」的条件键，跨到检定来源的读点不存在。

export default {
  code: '06204',
  simplified: true,
  note: '未实现：「在基础调查行动期间投入时获得 [intellect][intellect]」——commit 档案的 conditionalIcons 没有「检定来自基础调查行动」的条件键（只有生命/手牌/资源/毁灭/控制特性等条件）；已实现：每次检定最多投入 1 张 + 成功超过难度 2 点时额外发现 1 个线索。',
  abilities: [
    {
      kind: 'commit',
      label: '目力敏锐：调查成功超过 2 点额外发现 1 个线索',
      skill: {
        maxPerTest: 1,
        successBy: { threshold: 2, clueBonus: 1 },
      },
    },
  ],
  modifiers: [],
}
