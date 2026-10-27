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
//
// 2026-10-26 修复（借机攻击判定）：卡面「攻击。」是 Fight 行动关键字。旧实现只用 resolve 结算，
// 没有声明「按哪种行动结算」，被 actionKind 归为普通行动 → 发动攻击前先吃一次借机攻击。
// 补 countsAs:'fight' + noOpportunityAttack（与 05114 切肉刀同一写法；读点见 actionKind /
// dispatch.js 的 abilityNoAoO，规则见 docs/card-model.md §5b）。
//
// 2026-10-27 修复（反应窗口通道）：卡面「如同其在你的手牌中」此前只在三条路径接了 beneath：
// 普通行动打出（moves.js）、技能检定投入（tests.js）、旧印加入手牌（05004）。玩家实际最常用的
// 两条窗口没有接——
//   · 快速事件的反应窗口（encounter.js 的 reactionWindow）：底下的 05014 黑暗洞察 / 01023 闪躲
//     等取消卡永远不出现在窗口候选里；现在候选带 fromBeneath，选中后横置匕首、从底下移进手牌、
//     走 playReactionCard 的同一套付费/结算/弃牌路径，期间置 state._playedFromBeneath；
//   · fromHand 反应描述子的能力窗口（ability-exec.js 的 openAbilityWindow / ability-rules.js 的
//     descriptorUsable）：05280 否决存在这类「快速。在遭遇/攻击造成伤害时打出」的卡只从手牌枚举，
//     现在同一通道补 beneath 候选，执行时把卡移进手牌走 executeDescriptor 的手牌口径。
// 界面侧 web/card-interactions.js 的 choicePresentation 把两类候选挂回牌桌「下方」的牌，
// 技能检定投入的 beneath 选项也带 cardCode（src/engine/tests.js），点下方的牌与点手牌同义。

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
      // 卡面「攻击。」= Fight 行动：本次行动按攻击结算，与敌人交战时发动不引发借机攻击。
      countsAs: 'fight',
      noOpportunityAttack: true,
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
