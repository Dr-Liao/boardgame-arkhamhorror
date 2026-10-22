// 04026 彩饰骷髅
// 卡面：使用(0充能)。
// 卡面：[reaction]在你所在地点有调查员、[[盟友]]支援或敌人被击败后：在彩饰骷髅上放置1资源(从供应堆拿取)，作为充能。
// 卡面：[action]花费1充能：抽取1张卡牌并获得1资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04026 华饰头骨：击败敌人后放 1 充能（每阶段一次）；花 1 充能抽 1 并获得 1 资源。

import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '04026',
  uses: 0,
  usesType: 'charges',
  abilities: [
    {
      kind: 'reaction', trigger: ['defeatEnemy', 'defeatAtLocation'], label: '本地点的调查员/盟友/敌人被击败后放置 1 充能',
      criteria: [ownSeat()], limit: { scope: 'perWindow', owner: 'instance' },
      resolve: ({ source, api }) => {
        if (!source) return
        api.addUses(source, 1)
        api.info(`「${api.cardName('04026')}」获得 1 充能（${source.uses}）。`)
      },
    },
    {
      kind: 'action', label: '花费 1 充能：抽 1 张牌并获得 1 资源', cost: { action: true, uses: 1 },
      resolve: ({ inv, api }) => { api.drawCards(inv.seat, 1); api.gainResources(inv.seat, 1) },
    },
  ],
  modifiers: [

  ],
}
