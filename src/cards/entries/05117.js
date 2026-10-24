// 05117 田纳西酸麦芽威士忌
// 卡面：使用(2补给)
// 卡面：[free]横置田纳西酸麦芽威士忌并花费1补给：你在诡计卡牌的一次技能检定中得到+2[willpower]。
// 卡面：[action]弃掉田纳西酸麦芽威士忌：攻击。你本次攻击得到+3[combat]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：第一条是「检定进行中」的快速触发，挂在 testBegins 窗口上（05048 同一通道）；
// 是否「诡计卡牌的检定」读 state._treacheryResolving（引擎在显现检定期间写入的结算上下文），
// +2 只对意志检定有意义，所以只在本次检定用意志时提供。
// 第二条用效果的 fight + combatBonus 3，费用是弃掉自身（cost.discardSelf）。

const SYMBOLS = ['willpower']

function usesWillpower(state) {
  const skill = state.skillTest?.skill
  const list = Array.isArray(skill) ? skill : [skill]
  return list.some(name => SYMBOLS.includes(name))
}

export default {
  code: '05117',
  uses: 2,
  usesType: 'supplies',
  abilities: [
    {
      kind: 'reaction', trigger: 'testBegins',
      label: '横置并花费 1 补给：本次诡计检定 +2 意志',
      criteria: [({ state, inv, context }) => context?.seat === inv.seat
        && Boolean(state._treacheryResolving) && usesWillpower(state)],
      cost: { exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        // 检定期间的加值走「待决加值」账本：tests.js 在投入前把 pendingBonus 加进检定值。
        api.addPendingTestBonus(2)
        api.info(`${inv.name} 使用「田纳西酸麦芽威士忌」：本次诡计检定 +2 意志。`)
      },
    },
    {
      kind: 'action', label: '弃掉：攻击（战斗 +3）',
      cost: { action: true, discardSelf: true },
      effect: { type: 'fight', combatBonus: 3 },
    },
  ],
  modifiers: [],
}
