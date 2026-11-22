// 12004 乔·戴蒙德（Joe Diamond）· 探求者 · 私家侦探（2026 核心盒）。
//
// 卡面：
//   [reaction] 你成功调查后：抽取 1 张卡牌。（每轮仅限一次）
//   [elder_sign] 效果：+1。如果你检定成功，抽取 1 张卡牌并获得 1 资源。
//
// 引擎读点：
//   · 调查成功窗口 `investigateSuccess`（actions.js 在调查检定成功后开窗，context 带 seat/location/
//     successBy）；反应用 limit:'oncePerRound'。
//   · 旧印：`elderSign` 描述子返回 `{ delta, onSuccess }`；onSuccess 是效果 DSL，
//     tests.js 在成败判定后用 resolveEffect 结算（sequence → draw + gainResource）。

import { ownSeat } from '../../engine/matcher.js'

const code = '12004'

export default {
  code,
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    id: '12004-eldersign',
    label: '旧印：+1。若检定成功，抽 1 张牌并获得 1 资源',
    resolve: () => ({
      delta: 1,
      onSuccess: {
        type: 'sequence',
        effects: [{ type: 'draw', amount: 1 }, { type: 'gainResource', amount: 1 }],
      },
    }),
  },
  abilities: [{
    kind: 'reaction',
    trigger: 'investigateSuccess',
    label: '你成功调查后：抽 1 张牌',
    limit: 'oncePerRound',
    criteria: [ownSeat()],
    resolve: ({ inv, api }) => api.drawCards(inv.seat, 1),
  }],
}
