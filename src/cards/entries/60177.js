// 60177 警探谢尔曼（Detective Sherman，3 级）
// 卡面：你得到 +1[combat]。你所在地点其他调查员受到的伤害/恐惧可以分配给谢尔曼。
// [reaction] 伤害放置到谢尔曼后，横置他：发现你所在地点的 1 个线索。
// 读点：modifiers skill:combat +1；passive.assignHarmAtLocation；reaction trigger assetHarmPlaced（enemies.js 窗口）+ api.discoverClue。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60177',
  passive: { assignHarmAtLocation: true },
  modifiers: [{ target: 'skill:combat', amount: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: 'assetHarmPlaced',
    label: '谢尔曼受到伤害/恐惧后横置：发现你所在地点 1 个线索',
    cost: { exhaust: true },
    criteria: [ownSeat(), ({ context, source }) => context?.assetId === source?.id
      && (Number(context?.damage) > 0 || Number(context?.horror) > 0)],
    resolve: ({ inv, api }) => api.discoverClue(inv.seat, 1, inv.location),
  }],
}
