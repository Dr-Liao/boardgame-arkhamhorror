// 60480 终极牺牲（Ultimate Sacrifice，Marie Lambeau，4 XP）· 事件（快速，0 费）
// 卡面：快速。在调查阶段结束时打出。
//       重复调查阶段。当该阶段结束时，你被击败并承受 1 点肉体创伤。每场游戏最多 1 次。
//
// 读点（批次 3 原语）：
//   · 打出时机：played 描述子 + fast + trigger investigationPhaseEnds（turn.js#runBetweenInvestigationPhases
//     在调查阶段收尾开窗，快速事件由 reactionWindow 的快速事件出口枚举）；
//   · api.repeatInvestigationPhase({ seat, physicalTrauma })：登记 state.investigationRepeat；回合结束推进会
//     消费它并 beginInvestigationPhase(state, events, true) 重开调查阶段（turn-flow.js#advanceInvestigator 尾部）；
//   · 重复阶段结束时：turn.js#runBetweenInvestigationPhases 消费 state.investigationRepeatEnd，
//     对该调查员调用 eliminateInvestigator（击败链路按战役规则自行结算创伤）；
//   · 每场游戏一次：limit:'oncePerGame' + 调查员级 gameFlag 双重防重复。
import { ownSeat } from '../../engine/matcher.js'

const CODE = '60480'

export default {
  code: CODE,
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'investigationPhaseEnds',
      limit: 'oncePerGame',
      label: '重复调查阶段；该阶段结束时你被击败并承受 1 点肉体创伤（每场游戏 1 次）',
      criteria: [ownSeat(), ({ state, inv }) => !state.investigators[inv.seat]?.gameFlags?.ultimateSacrificeUsed],
      resolve: ({ inv, api }) => {
        if (api.gameFlag(inv.seat, 'ultimateSacrificeUsed')) return
        api.setGameFlag(inv.seat, 'ultimateSacrificeUsed', true)
        const ok = api.repeatInvestigationPhase({ seat: inv.seat, physicalTrauma: 1 })
        api.info(ok
          ? '终极牺牲：本次调查阶段结束后重复一次；该阶段结束时你被击败并承受 1 点肉体创伤。'
          : '终极牺牲：当前无法重复调查阶段。')
      },
    },
  ],
  modifiers: [],
}
