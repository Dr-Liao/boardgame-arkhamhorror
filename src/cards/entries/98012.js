// 98012 对抗黑风（To Fight the Black Wind）· 中立 · 诡计/弱点 · 任务/幻梦境 · 替换（卡洛琳·弗恩）。
// 卡面（cards-data 98012）：
//   卡洛琳·弗恩牌库专用。替换。
//   显现 - 将对抗黑风附属到当前密谋。卡洛琳·弗恩受到 1 点直接恐惧。
//   强制 - 在回合结束时，如果本回合有任意数量的恐惧被分配给一位调查员且没有被治愈：
//     在所附属的密谋上放置 1 个毁灭标记。
//
// 引擎读点：
//   · 「附属到当前密谋」= api.scenario.attachToAgenda（scenario-runtime.js#attachToAgenda，
//     attachCardTo 统一附属入口，宿主 = state.agendas[state.agendaIndex]）；
//   · 「1 点直接恐惧」= api.directHorror（applyHorror 的 direct 通道）。
// 缺原语：「本回合有恐惧被分配且未被治愈」的跨窗口记账（引擎没有 horrorAssignedThisRound /
//   horrorHealedThisRound 的公开读点，sampleRoundEvents 只记 EotE 事件）→
//   primitive-requests/core-cards-a-98012-horror-assigned-round.json；
//   因此回合结束的强制放毁灭暂未接线（不在条目里声明无法生效的能力）。
const code = '98012'

export default {
  code,
  abilities: [{
    kind: 'weakness',
    label: '对抗黑风：附属到当前密谋；卡洛琳受到 1 点直接恐惧',
    weakness: { type: 'custom' },
    resolve: ({ inv, api }) => {
      const attached = api.scenario?.attachToAgenda?.(code)
      api.directHorror(inv.seat, 1)
      api.info(attached
        ? '「对抗黑风」附属到当前密谋；卡洛琳受到 1 点直接恐惧。'
        : '「对抗黑风」无法附属到密谋；卡洛琳受到 1 点直接恐惧。')
    },
  }],
  modifiers: [],
  note: '待原语：回合结束时「本回合有恐惧被分配且未被治愈 → 在附属密谋上放 1 毁灭」需要跨窗口的恐惧分配/治疗记账读点 → primitive-requests/core-cards-a-98012-horror-assigned-round.json；显现（附属到密谋 + 1 直接恐惧）已接线。',
}
