// 08050 欺骗制度（Cheat the System）· 游荡者（Rogue）事件 · 1 经验。
//
// 卡面：快速。可在任意 [fast] 时间段期间打出。
//       你每控制一张不同职阶的卡牌，获得 1 资源。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 「不同职阶」按你控制的支援（asset）的卡面职业去重计数；职阶从 cards-data 读取（与
// 05279 读取卡面数据同一口径）。本事件本身打出时还在手牌，不计入。
import { ALL_CARDS } from '../../cards/cards-data.js'

const distinctClassCount = inv => {
  const classes = new Set()
  for (const asset of inv.assets || []) {
    const klass = ALL_CARDS[asset.code]?.klass
    if (klass) classes.add(String(klass).toLowerCase())
  }
  return classes.size
}

export default {
  code: '08050',
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '快速打出：你每控制一种不同职阶的卡牌，获得 1 资源',
      resolve: ({ inv, api }) => {
        const count = distinctClassCount(inv)
        if (count <= 0) {
          api.info('「欺骗制度」：你没有控制任何卡牌，未获得资源。')
          return
        }
        api.gainResources(inv.seat, count)
        api.info(`「欺骗制度」：你控制了 ${count} 种不同职阶的卡牌，获得 ${count} 资源。`)
      },
    },
  ],
  modifiers: [],
}
