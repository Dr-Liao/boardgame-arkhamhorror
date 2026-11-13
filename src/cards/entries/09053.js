// 09053 指导（Guidance）· 探寻者（Seeker）事件 · 1 经验。
//
// 卡面：选择你所在地点的另一位本轮尚未进行其回合的调查员。该调查员在本轮自己回合期间得到
//       每项技能 +1，且可以进行额外一次行动。打出指导不会触发借机攻击。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「每项技能 +1」→ api.addEffect（duration:'endOfRound'，controllerSeat=被选座位，
//     modifiers skill:* +1；读点是 modifiers 的统一管线）。
//   · 「额外一次行动」→ api.grantExtraActionNextTurn（引擎在目标的下个回合开始时发这一次行动；
//     卡面写「本轮自己回合」，两者在常规轮次里是同一次回合，已在本卡 note 里披露）。
//   · 「不会触发借机攻击」→ played 描述子 noOpportunityAttack。
const CODE = '09053'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'played',
      noOpportunityAttack: true,
      label: '选择同地点另一位尚未进行回合的调查员：本轮其回合每项技能 +1，并额外一次行动',
      resolve: ({ state, inv, api }) => {
        const targets = api.investigatorsAt(inv.location)
          .filter(other => other.seat !== inv.seat && !other.defeated && !other.resigned && !other.turnEnded)
        if (!targets.length) {
          api.info('「指导」：你所在地点没有本轮尚未行动的调查员。')
          return
        }
        const seatId = targets.length === 1 ? targets[0].seat : Number(api.choice({
          kind: 'investigator', source: CODE, seat: inv.seat,
          prompt: '「指导」：选择获得指导的调查员。',
          options: targets.map(other => ({ id: String(other.seat), label: other.name })),
        }))
        const target = state.investigators[seatId]
        if (!target) return
        api.addEffect({
          duration: 'endOfRound', sourceCode: CODE, controllerSeat: target.seat,
          label: `${target.name} 本轮自己回合期间每项技能 +1`,
          modifiers: [{ target: 'skill:*', amount: 1 }],
        })
        api.grantExtraActionNextTurn(target.seat)
        api.info(`🧭 「指导」：${target.name} 本轮自己回合期间每项技能 +1，并获得额外一次行动。`)
      },
    },
  ],
  modifiers: [],
}
