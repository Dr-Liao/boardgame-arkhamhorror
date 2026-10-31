// 06235 领导力
// 卡面：领导力投入到另一位调查员执行的技能检定中时，领导力获得[willpower][wild]。
//       如果本次检定成功，获得 2 资源。如果领导力投入到另一位调查员执行的技能检定，
//       该调查员也获得 2 资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 实现口径：
//   · 图标：引擎的 commit 档案已有 leadership 读点（tests.js：投入方能拿到
//     「检定技能含意志则 +2 图标，否则 +1 图标」），卡面这一句因此是纯数据；
//   · 成功获得资源：commit 档案的 onSuccess 读点目前没有「获得资源」字段（只有抽牌/伤害/线索等），
//     属引擎读点缺口（P10 前补原语）；在此之前用显式简化登记，不静默略过。

export default {
  code: '06235',
  simplified: true,
  note: '未实现：「如果本次检定成功，获得 2 资源；若领导力投入到另一位调查员的检定，该调查员也获得 2 资源」——commit 档案的 onSuccess 读点没有 gainResources 字段（P10 前补原语）；投入时获得 [willpower][wild] 的图标句已由引擎 leadership 读点实现。',
  abilities: [
    {
      kind: 'commit',
      label: '领导力：投入他人检定时获得 [willpower][wild]',
      skill: { leadership: true },
    },
  ],
  modifiers: [],
}
