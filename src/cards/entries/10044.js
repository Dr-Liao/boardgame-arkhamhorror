// 10044 饥饿霉菌（Ravenous Myconid）· 未识别 · 探寻者支援 · 无槽位 ·
// [[生物]]/[[怪物]]/[[植物]]/[[科学]] · 每套牌库仅限 1 张 · 绑定（诡异疯长）
// 卡面：
//   每套牌库仅限 1 张。
//   [action]：查找你的绑定卡牌，找出诡异疯长，并将其加入你的手牌。
//   [action]：如果饥饿霉菌上有至少 3 个生长：将每个生长移动到你的资源池，作为资源。
//   在剧本日志中，记录下「你识别了新的物种」。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 绑定关系来自卡面数据 `bondedCards: [{ code: '10045' }]`（src/engine/bonded.js），
//     条目不需要额外字段；「查找绑定卡牌并加入手牌」= api.bonded.retrieve(seat, '10044', { handCount: 1 })
//     （场外集合 → 手牌的唯一检索入口，副本不在场外时返回空数组）。
//   · 「每套牌库仅限 1 张」= 卡面数据 deckLimit（构筑层读点），条目不需要额外字段。
//   · 生长 = 本卡实例上的 uses（usesType 'growth'）；10045 结算成功时用 api.addUses 放置。
//   · 第二个 [action]：3 个生长以上 = 描述子 criteria；「移动到资源池」= api.gainResources + 清零
//     api.setAssetUses；「在剧本日志记录」= api.recordResearch('classifiedNewSpecies')
//     （harm-threat.js#recordResearch 写 state.campaign.records + 每位调查员的 record.research，
//     与升级前置 researchRequirement 的读点同源）。
//
// 口径说明：FHV 战役日志的 recordSchema 目前为空，尚无「你识别了新的物种」的印刷日志条目；
// 本卡用 recordResearch 的键 'classifiedNewSpecies' 记账，FHV 升级卡（10059–10061「Researched.」）
// 的 researchRequirement 应采用同一个键。
const CODE = '10044'
const BONDED_COPY = '10045' // 诡异疯长

export default {
  code: CODE,
  name: '饥饿霉菌',
  uses: 0,
  usesType: 'growth',
  abilities: [
    {
      kind: 'action',
      id: 'ravenousMyconidSearchGrowth',
      label: '查找绑定卡牌，把「诡异疯长」加入手牌',
      cost: { action: true },
      criteria: [({ inv, helpers }) => helpers.bondedAvailable(inv.seat, CODE, BONDED_COPY) > 0],
      resolve: ({ inv, api }) => {
        const taken = api.bonded.retrieve(inv.seat, CODE, { handCount: 1 })
        api.info(taken.length
          ? `🍄 「饥饿霉菌」：把「诡异疯长」加入 ${inv.name} 的手牌。`
          : '🍄 「饥饿霉菌」：场外没有可查找的「诡异疯长」。')
      },
    },
    {
      kind: 'action',
      id: 'ravenousMyconidClassify',
      label: '3 个以上生长：把所有生长作为资源，并在剧本日志记录「你识别了新的物种」',
      cost: { action: true },
      criteria: [({ source }) => Boolean(source) && (Number(source.uses) || 0) >= 3],
      resolve: ({ inv, source, api }) => {
        const card = (inv.assets || []).find(asset => asset.id === source?.id)
        if (!card) return
        const growth = Number(card.uses) || 0
        if (growth < 3) return
        api.gainResources(inv.seat, growth)
        api.setAssetUses(card, 0)
        api.recordResearch('classifiedNewSpecies')
        api.info(`🍄 「饥饿霉菌」：${growth} 个生长变成资源；剧本日志记录「你识别了新的物种」。`)
      },
    },
  ],
  modifiers: [],
}
