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
// 第七轮（2026-10-25）：beneath 通道已接引擎——
//   · 打出：legalMoves 为「持有未横置通道支援」的调查员生成 {action:'play', fromBeneath:true}
//     （moves.js:255-270），validateMove 校验通道/卡在底下（:569-575）；dispatch 横置通道支援、
//     从 beneath 取出、置 state._playedFromBeneath 后走 doPlay（dispatch.js:436-450）；
//   · 投入：技能检定投入候选包含 beneath 的 event/skill（tests.js:278-322），选中后横置通道支援、
//     从 beneath 移出并进入正常投入/弃牌流程；
//   · 以此方式结算期间 05004 的 reaction criteria 排除（state._playedFromBeneath）。

export default {
  code: '05013',
  // R7 beneath 通道：引擎读点已落地（见文件头注释）；额外费用=横置本卡，
  // 结算期间 state._playedFromBeneath 供 05004 排除 reaction。
  beneathPlayAsIfInHand: true,
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
