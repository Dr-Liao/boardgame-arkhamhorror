// 06203 月石
// 卡面：你得到 +1[willpower] 和 +1[agility]。
//       你不能从手牌中打出月石，也不能将其从手牌中投入检定。
//       [reaction] 你从手牌中弃掉月石后：将其打出（支付其费用）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 常驻 +1/+1 走 modifiers（skill:willpower / skill:agility）；
//   · 「不能从手牌打出」用 playCondition 恒假拒绝普通出牌路径（反应结算走 api.playCard，
//     不经过 playCondition，因此不会被自己挡住）；「不能投入检定」由印刷无技能图标自然成立；
//   · 反应挂在 wouldDiscardFromHand 窗口（弃牌效果结算前的唯一窗口）：把月石打出并取消这次弃牌。
// 已知简化：取消的是整次弃牌效果——「弃 1 张」时与印刷等价，「弃 N 张」时少弃其余牌（见 note）。

export default {
  code: '06203',
  simplified: true,
  note: '未实现/简化：「你从手牌中弃掉月石后」没有「某张手牌被弃掉后」的窗口；改用弃牌前的 wouldDiscardFromHand 窗口，把月石从手牌打出并取消这次弃牌效果。弃 1 张时与印刷等价；弃 N（>1）张时其余弃牌也被取消。',
  playCondition: [{ when: () => false, message: '月石不能从手牌中打出，只能通过其[reaction]效果打出' }],
  modifiers: [
    { target: 'skill:willpower', amount: 1 },
    { target: 'skill:agility', amount: 1 },
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'wouldDiscardFromHand',
      label: '弃掉手牌时：改为从手牌打出月石（支付费用）',
      criteria: [({ inv, context }) => Boolean(context) && (inv.hand || []).includes('06203')
        && (inv.resources || 0) >= 3],
      resolve: ({ inv, api, context }) => {
        if (!api.playCard(inv.seat, '06203')) return
        context.cancelled = true
        api.info(`${inv.name} 在弃牌时改为打出「月石」并取消这次弃牌。`)
      },
    },
  ],
}
