// 05117 田纳西酸麦芽威士忌
// 卡面：使用(2补给)
// 卡面：[free]横置田纳西酸麦芽威士忌并花费1补给：你在诡计卡牌的一次技能检定中得到+2[willpower]。
// 卡面：[action]弃掉田纳西酸麦芽威士忌：攻击。你本次攻击得到+3[combat]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7：第一条是「检定进行中」的 [free] 触发。规则允许插入的玩家窗口是投入前/投入后
// （test.beforeCommit / test.afterCommit），因此按 05190/05191 同一写法挂两个玩家窗口，
// 不再只在 testBegins（审计 R2：窗口比卡面「任意时点」窄）。
// 是否「诡计卡牌的检定」读 state._treacheryResolving（引擎在显现检定期间写入的结算上下文），
// +2 只对意志检定有意义，所以只在本次检定用意志时提供；duringOwnSkillTest 限定本人的检定。
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
      // 卡面 [free] 是「检定进行中」的免费触发；可插入时点=投入前/投入后两个玩家窗口。
      kind: 'free', trigger: ['test.beforeCommit', 'test.afterCommit'],
      duringOwnSkillTest: true,
      label: '横置并花费 1 补给：本次诡计检定 +2 意志',
      criteria: [({ state }) => Boolean(state._treacheryResolving) && usesWillpower(state)],
      cost: { action: false, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        // 检定期间的加值走「待决加值」账本：tests.js 在投入前/投入后两个窗口各消费一次
        // （tests.js 的 183-184 与 347-349），因此两个窗口都能真正影响检定值。
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
