// 08133 麻木（Stupor）
// 卡面：显现 - 将麻木放置入场，放到你的威胁区域。
//        麻木可被治愈，如同是你身上的 1 点恐惧（如果它被治愈，将其弃掉）。
//        强制 - 在你执行谈判、抽取或调查行动后：本回合剩余时间内，你不能再进行任何这些类型的行动。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：弱点模板 kind:'weakness'（type:'threat' + horror:1）；「可如同 1 点恐惧被治愈」复用引擎
//       threatHorrorSink + redirectHeal；actionResolvedAtLocation 窗口 + api.addEffect
//       （capability:parley / draw / investigate，duration:'endOfTurn'）。
// approximation: 动作后锁近似为任意行动后锁住印刷三类行动至回合结束。
const code = '08133'

export default {
  code,
  threatHorrorSink: true,
  redirectHeal: { optional: true },
  note: 'approximation: 动作后锁近似为任意行动后锁住印刷行动类型至回合结束。',
  abilities: [
    {
      kind: 'weakness',
      label: '显现：放入威胁区域（1 点「恐惧」计数器）',
      weakness: { type: 'threat', horror: 1 },
    },
    {
      kind: 'forced',
      trigger: 'actionResolvedAtLocation',
      label: '执行行动后：本回合不能谈判、抽取或调查',
      criteria: [({ state, inv }) => !(state.effects || []).some(effect => effect.sourceCode === code
        && effect.duration === 'endOfTurn' && effect.controllerSeat === inv.seat)],
      resolve: ({ inv, api }) => {
        api.addEffect({
          sourceCode: code,
          controllerSeat: inv.seat,
          duration: 'endOfTurn',
          label: '麻木：本回合不能谈判、抽取或调查',
          modifiers: [
            { target: 'capability:parley' },
            { target: 'capability:draw' },
            { target: 'capability:investigate' },
          ],
        })
        api.info(`😵 「麻木」：${inv.name} 本回合不能再谈判、抽取或调查。`)
      },
    },
  ],
  modifiers: [],
}
