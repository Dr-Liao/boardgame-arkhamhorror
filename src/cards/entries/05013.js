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
// 修复（task-22）：卡面「可以不使用[combat]改为使用[willpower]」是二选一，旧实现固定用意志
// （黛安娜基础意志 1、战斗 3，低底下牌数时是净亏）。现在 resolve 里先用 api.choice 询问技能，
// 默认战斗、可选意志，再按所选技能 api.fight。
//
// 剩余未实现（引擎原语，见 artifacts/tcu-fix/primitive-requests/fix-investigator.json）：
//   「可以打出或投入黛安娜底下的事件和技能，如同其在你的手牌中；额外费用横置银暮匕首；
//    以此方式打出/投入时不能触发黛安娜的[reaction]」——需要 beneath 区打出/投入通道
//   （现有 cardBackpack 只覆盖支援的 attached）。

export default {
  code: '05013',
  simplified: true,
  note: '「可以把黛安娜底下的事件/技能当作手牌打出或投入」未实现（需要 beneath 打出/投入通道，已登记 primitive request）；[action] 已按卡面支持战斗/意志二选一。',
  abilities: [
    {
      kind: 'action',
      label: '攻击（可选择用意志代替战斗）',
      cost: { action: true },
      target: { kind: 'enemy' },
      resolve: ({ inv, api, targetId }) => {
        if (!targetId) return
        const answer = api.choice({
          kind: 'effect', source: '05013', seat: inv.seat,
          prompt: '银暮匕首：本次攻击使用哪个技能？',
          options: [
            { id: 'combat', label: '使用[combat]' },
            { id: 'willpower', label: '使用[willpower]' },
          ],
        })
        const skill = answer === 'willpower' ? 'willpower' : 'combat'
        api.fight(inv.seat, targetId, { skill })
      },
    },
  ],
  modifiers: [],
}
