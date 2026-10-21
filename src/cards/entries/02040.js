// 02040 亨利·阿米蒂奇博士
// 卡面：[reaction]在你抽取一张非弱点卡牌后，弃掉该卡牌并横置亨利·阿米蒂奇博士：获得3资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02040 亨利·阿米蒂奇博士：[反应]抽到非弱点牌后，弃掉该牌并横置：获得 3 资源。

import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '02040',
  abilities: [
    {
      kind: 'reaction', trigger: 'cardDrawn', label: '弃掉刚抽到的牌并横置：获得 3 资源',
      criteria: [ownSeat(), ctx => Boolean(ctx.context?.cardCode)
        && ctx.context.cardCode !== '02040'
        && !ctx.helpers.isWeakness(ctx.context.cardCode)],
      cost: { exhaust: true },
      resolve: ({ inv, context, api }) => {
        if (!api.discardFromHand(inv.seat, context.cardCode)) return
        api.gainResources(inv.seat, 3)
      },
    },
  ],
  modifiers: [

  ],
}
