// 60224 神秘文字
// 卡面：获得3资源(如果你手牌中有至少10张其它卡牌，改为获得4资源)。
// 卡面：[reaction]你在自己的回合抽到神秘文字后：将其打出。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownSeat, ownTurn } from '../../engine/matcher.js'

export default {
  code: '60224',
  abilities: [{
    kind: 'played',
    label: '获得 3 资源，其他手牌至少 10 张时改为获得 4',
    resolve: ({ inv, api }) => api.gainResources(inv.seat, inv.hand.length >= 10 ? 4 : 3),
  }, {
    kind: 'reaction', trigger: 'cardDrawn', fromHand: true, noPlayCost: true,
    limit: { scope: 'perWindow', owner: 'investigator' },
    label: '你的回合抽到本牌后：打出它',
    criteria: [ownSeat(), ownTurn(), ({ context }) => context.cardCode === '60224'],
    resolve: ({ inv, api, context }) => api.playAsEffect(inv.seat, '60224', {
      grantedEvent: true, handIndex: context.handIndex,
    }),
  }],
}
