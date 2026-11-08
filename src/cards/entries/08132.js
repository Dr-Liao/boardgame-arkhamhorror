// 08132 惊慌（Panic）
// 卡面：显现 - 将惊慌放置入场，放到你的威胁区域。
//        惊慌可被治愈，如同是你身上的 1 点恐惧（如果它被治愈，将其弃掉）。
//        强制 - 在你执行打出、资源或交战行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：弱点模板 kind:'weakness'（type:'threat' + horror:1）；「可如同 1 点恐惧被治愈」复用引擎
//       threatHorrorSink + redirectHeal（05008「理性思考」同一原语：治疗自己恐惧时可改为治愈本卡，
//       治满后移除并弃掉）；actionResolvedAtLocation 窗口 + api.addEffect
//       （capability:play / engage / gainResources，duration:'endOfTurn'）。
// approximation: 「资源行动」用 capability:gainResources 近似（会同时禁止卡牌效果获得资源，略偏严）；
//       动作后锁近似为任意行动后锁住印刷类型至回合结束。
const code = '08132'

export default {
  code,
  threatHorrorSink: true,
  redirectHeal: { optional: true },
  note: 'approximation: 资源行动用 capability:gainResources 近似；动作后锁近似为任意行动后锁住印刷行动类型至回合结束。',
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入威胁区域（1 点「恐惧」计数器）',
      weakness: { type: 'threat', horror: 1 },
    },
    {
      kind: 'forced',
      trigger: 'actionResolvedAtLocation',
      label: '执行行动后：本回合不能打出、获得资源或交战',
      criteria: [({ state, inv }) => !(state.effects || []).some(effect => effect.sourceCode === code
        && effect.duration === 'endOfTurn' && effect.controllerSeat === inv.seat)],
      resolve: ({ inv, api }) => {
        api.addEffect({
          sourceCode: code,
          controllerSeat: inv.seat,
          duration: 'endOfTurn',
          label: '惊慌：本回合不能打出、获得资源或交战',
          modifiers: [
            { target: 'capability:play' },
            { target: 'capability:gainResources' },
            { target: 'capability:engage' },
          ],
        })
        api.info(`😱 「惊慌」：${inv.name} 本回合不能再打出、获得资源或交战。`)
      },
    },
  ],
  modifiers: [],
}
