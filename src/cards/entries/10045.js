// 10045 诡异疯长（Uncanny Growth）· 探寻者事件 · 1 资源 · [[洞见]]/[[科学]] ·
// 绑定（饥饿霉菌）
// 卡面：
//   绑定（饥饿霉菌）。
//   调查。本次检定结算后，你检定成功且每超过难度 1 点，在饥饿霉菌上放置 1 资源，作为生长。
//   将诡异疯长放在一旁，位于场外。如果你检定失败，将诡异疯长返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 绑定关系来自卡面数据 `bondedTo: 'Ravenous Myconid'`（bonded.js），条目不需要额外字段。
//   · 「调查。」= played 描述子 countsAs: 'investigate'；真实调查检定 = api.investigate。
//   · 生长 = 饥饿霉菌实例上的 uses（usesType 'growth'，与 10044 同一个 uses 读点），
//     按成功差值 api.addUses（目标按 [[饥饿霉菌]] 四个形态号之一查找：10044 未识别 / 10059-10061 培育形态）。
//   · 「放在一旁，位于场外」与「失败返回手牌」是结算后的两个去向：
//       - 条目级 zoneReplacement { discard: 'bonded' }：这张绑定副本离开弃牌堆时改为收回场外绑定集合
//         （player-zones.js#replacePlayerZoneCards 的唯一读点）；
//       - 成功 → api.putIntoDiscard（discardPlayerCards → 经 zoneReplacement 进入场外集合）；
//         失败 → api.putInHand（返回手牌）。
//     两个去向都由 resolve 显式写入，条目再声明 keepOnPlay，避免引擎的默认「事件进弃牌堆」覆盖它们。
const CODE = '10045'
const MYCONID_CODES = ['10044', '10059', '10060', '10061'] // 未识别 / 培育 / 食肉 / 有知觉

const myconidOf = inv => (inv.assets || []).find(asset => MYCONID_CODES.includes(asset.code)) || null

export default {
  code: CODE,
  name: '诡异疯长',
  keepOnPlay: true,
  zoneReplacement: { discard: 'bonded' },
  abilities: [
    {
      kind: 'played',
      id: 'uncannyGrowthInvestigate',
      label: '调查；成功后按差值在饥饿霉菌上放置生长，然后放在一边（失败返回手牌）',
      countsAs: 'investigate',
      resolve: ({ inv, api }) => {
        const result = api.investigate(inv.seat)
        const success = Boolean(result?.success)
        if (success) {
          const successBy = Math.max(0, Number(result.value || 0) - Number(result.difficulty || 0))
          const myconid = myconidOf(inv)
          if (myconid && successBy > 0) {
            api.addUses(myconid, successBy)
            api.info(`🍄 「诡异疯长」：在饥饿霉菌上放置 ${successBy} 个生长。`)
          } else if (successBy > 0) {
            api.info('🍄 「诡异疯长」：你没有控制饥饿霉菌，没有放置生长。')
          }
          api.putIntoDiscard(inv.seat, CODE)
          api.info('🍄 「诡异疯长」：放在一旁，位于场外。')
          return
        }
        api.putInHand(inv.seat, CODE)
        api.info('🍄 「诡异疯长」：检定失败，返回手牌。')
      },
    },
  ],
  modifiers: [],
}
