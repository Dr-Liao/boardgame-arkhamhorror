// 12008 隐秘行动（Covert Ops）· 流浪者 · 天赋/非法 · 2 资源。（特里希·斯卡波罗签名卡）
//
// 卡面：特里希·斯卡波罗牌库专用。
//   [reaction] 你躲避敌人后，横置隐秘行动：抽取 1 张卡牌，或移动到一个连接地点。
//
// 引擎读点：
//   · `evadeSuccess` 窗口（combat.js 在躲避成功后开窗，context 带 seat/enemy）；资产反应描述子
//     用 cost.exhaust 横置自身。
//   · 「移动到一个连接地点」用 api.moveDestinations（investigatorMoveDestinations 的唯一 API 面）
//     + api.moveInvestigator（relocateInvestigator，不消耗行动点、按普通效果移动）。

import { ownSeat } from '../../engine/matcher.js'

const code = '12008'

export default {
  code,
  abilities: [{
    kind: 'reaction',
    trigger: 'evadeSuccess',
    label: '你躲避敌人后，横置：抽 1 张牌，或移动到一个连接地点',
    criteria: [ownSeat()],
    cost: { exhaust: true },
    resolve: ({ inv, api }) => {
      const destinations = api.moveDestinations(inv.seat) || []
      const options = [
        { id: 'draw', label: '抽取 1 张卡牌' },
        ...(destinations.length ? [{ id: 'move', label: '移动到一个连接地点' }] : []),
      ]
      const answer = options.length === 1 ? options[0].id : api.choice({
        kind: 'effect', source: code, seat: inv.seat,
        prompt: '「隐秘行动」：抽取 1 张卡牌，还是移动到一个连接地点？',
        options,
      })
      if (answer !== 'move') { api.drawCards(inv.seat, 1); return }
      const targets = api.moveDestinations(inv.seat) || []
      if (!targets.length) { api.drawCards(inv.seat, 1); return }
      const id = targets.length === 1 ? targets[0] : api.choice({
        kind: 'move', source: code, seat: inv.seat,
        prompt: '「隐秘行动」：选择要移动到的连接地点。',
        options: targets.map(locationId => ({ id: locationId, label: api.locationName(locationId) })),
      })
      if (targets.includes(id)) api.moveInvestigator(inv.seat, id)
    },
  }],
  modifiers: [],
}
