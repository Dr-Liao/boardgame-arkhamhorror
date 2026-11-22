// 60351 安德烈·帕特尔（André Patel，入门包 and）
// 卡面：[reaction] 你在自己回合期间技能检定成功且超过难度至少 2 点后：你本回合可以进行额外一个行动。（每轮仅限一次）
//       [elder_sign] 效果：+2。获得 1 资源。
import { ownSeat, ownTurn } from '../../engine/matcher.js'

export default {
  code: '60351',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 2 } },
  elderSign: {
    id: '60351-eldersign',
    label: '旧印：+2，获得 1 资源',
    resolve: ({ inv, api }) => {
      api.gainResources(inv.seat, 1)
      return { delta: 2 }
    },
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'skillTestSuccess',
    label: '成功且超过难度至少 2 点：获得 1 个额外行动（每轮一次）',
    limit: 'oncePerRound',
    criteria: [
      ownSeat(),
      ownTurn(),
      ({ context }) => {
        const margin = context?.successBy ?? (context?.value ?? 0) - (context?.difficulty ?? 0)
        return margin >= 2
      },
    ],
    resolve: ({ inv, api }) => api.gainAction(inv.seat, 1),
  }],
}
