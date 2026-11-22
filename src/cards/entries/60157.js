// 60157 新手警察（Rookie Cop）
// 卡面：你所在地点其他调查员受到的伤害和/或恐惧，可以分配给新手警察。
// [reaction] 新手警察被击败时：发现你所在地点的 1 个线索。
// 读点：passive.assignHarmAtLocation（harm-threat.js#assignHarm 读点，Brother Xavier 同原语）；
// assetDefeated 窗口 + api.discoverClue。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60157',
  passive: { assignHarmAtLocation: true },
  abilities: [{
    kind: 'reaction',
    trigger: 'assetDefeated',
    label: '新手警察被击败时：发现你所在地点的 1 个线索',
    criteria: [ownSeat(), ({ context, source }) => context?.assetId === source?.id],
    resolve: ({ inv, api }) => api.discoverClue(inv.seat, 1, inv.location),
  }],
  modifiers: [],
}
