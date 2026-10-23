// 05013 银暮匕首
// 卡面：黛安娜·史丹利牌库专用。
// 卡面：[action]：攻击。你本次攻击可以不使用[combat]，改为使用[willpower]。
// 卡面：你可以打出或投入黛安娜·史丹利底下的事件和技能，如同其在你的手牌中。作为以此方式打出或
//       投入卡牌的额外费用，横置银暮匕首。以此方式打出或投入卡牌时，你不能触发黛安娜·史丹利的
//       [reaction]能力。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// simplified：「把黛安娜底下的卡牌当作手牌打出/投入」需要一条通用的『从 beneath 打出』通道
// （现有 cardBackpack 只覆盖支援的 attached），本批只实现意志攻击。

export default {
  code: '05013',
  simplified: true,
  note: '「可以把黛安娜底下的事件/技能当作手牌打出或投入」未实现（需要 beneath 打出通道），其余效果已实现。',
  abilities: [
    {
      kind: 'action',
      label: '攻击（用意志代替战斗）',
      cost: { action: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, api, targetId }) => {
        if (!targetId) return
        api.fight(inv.seat, targetId, { skill: 'willpower' })
      },
    },
  ],
  modifiers: [],
}
