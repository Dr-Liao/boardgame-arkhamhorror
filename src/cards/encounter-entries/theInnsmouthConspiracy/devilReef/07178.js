// 07178 渔船 · 恶魔礁（载具剧情支援）
//
// 印刷（中文）：
//   载具。
//   你在本载具时，将你的地点视为如同未淹没。
//   [action]：将渔船移动到一个连接的[[海洋]]地点。
//
// 引擎读点：
//   · 「视为未淹没」不需要条目再声明：载具在 setup 里以 `protectsFromFlood: true` 注册
//     （middle-setup.js），`flood.effectiveFloodLevel` 会把该载具乘客的有效淹没等级压到 0，
//     求取空气也就不成立。
//   · [action] 走运行时既有的载具移动入口 `vehicles.move`：它按乘客逐个权威位移、要求
//     载具在运行中、目标必须是连接的相邻地点、并且每位乘客都要通过进入地点的权威校验
//     （`entryError`），任何一步失败整段不生效。故事支援的 [action] 由剧情资产条目枚举，
//     同地点的调查员都能触发。
//   · 「[[海洋]]地点」用 matcher 的 hasTrait 判定，不按卡号写死。

import { hasTrait } from '../../_shared.js'

export default {
  code: '07178', scope: 'storyAsset', implemented: true,
  abilities: [{
    kind: 'action', actionKind: 'activate',
    label: '将渔船移动到一个连接的[[海洋]]地点',
    target: {
      kind: 'location',
      query: ({ entity, source }) => entity.id !== source?.location && hasTrait(entity, 'Ocean'),
    },
    resolve: ({ state, source, target, api }) => api.vehicles.move(source.id, target.entity.id),
  }],
}
