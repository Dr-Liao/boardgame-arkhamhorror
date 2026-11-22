// 60362 马库斯·森斯塔克（Marcus Sengstacke，André Patel）
// 卡面：补给阶段期间你获得额外 1 资源。
//       强制 - 你技能检定失败后：对马库斯·森斯塔克造成 1 点恐惧。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60362',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'upkeepEnd',
      label: '补给阶段：获得 1 资源（近似：重整阶段结束时结算）',
      criteria: [ownSeat()],
      resolve: ({ inv, api }) => api.gainResources(inv.seat, 1),
    },
    {
      kind: 'forced',
      trigger: 'skillTestFailed',
      label: '检定失败后：对本支援造成 1 点恐惧',
      criteria: [ownSeat()],
      resolve: ({ inv, source, api }) => api.addAssetHorror(source, 1),
    },
  ],
}
