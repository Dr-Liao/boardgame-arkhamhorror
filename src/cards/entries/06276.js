// 06276 空虚项链
// 卡面：每套牌库仅限1张。使用(0充能)。
//       [reaction]你击败一个敌人后：在空虚项链上放置1充能。
//       [free]如果空虚项链上有至少3充能：查找你的绑定卡牌，找出食愿项链，将其与空虚项链交换，
//       将空虚项链上的所有充能移动到食愿项链上。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06276 空虚项链（绑定主卡，绑定副本 06277 食愿项链）：
//   · 使用(0 充能)：条目级 uses:0 / usesType:'charges'（实例创建读点 newPlayerAssetInstance）；
//   · [reaction] 击败敌人后放 1 充能：trigger 'defeatEnemy' + context.seat 判定，api.addUses；
//   · [free] 至少 3 充能交换：绑定集合由 P2.8 原语 api.bonded 维护——retrieve 把食愿项链从
//     场外集合取到手、moveCard 入场、把充能搬到新实例；空虚项链本体经 moveCard 到 setAside
//     （「交换」的另一半，场外），食愿项链耗尽后会交换回来（见 06277 的强制描述子）。
// 显式简化（noted）：引擎没有「绑定主卡 ↔ 副卡互换」的单条原语；这里用
//   bonded.retrieve + moveCard(hand→play) + moveCard(play→setAside) 组合表达，等价于卡面的交换。

export default {
  code: '06276',
  uses: 0,
  usesType: 'charges',
  abilities: [
    {
      kind: 'reaction',
      trigger: 'defeatEnemy',
      id: 'emptyVesselCharge',
      // 旧式反应的结算窗口（triggerReaction）每场战斗只询问一次；用 legacyReaction + resolve
      // 保持「一次击败 = 一次放置」的频率（纯描述子反应在能力窗口里可被反复点击）。
      legacyReaction: true,
      label: '你击败一个敌人后：在空虚项链上放置 1 充能（本卡牌获得 1 充能）',
      resolve: ({ inv, source, api }) => {
        if (!source) return
        api.addUses(source, 1)
        api.info(`🔋 ${inv.name} 在「${api.cardName('06276')}」上放置 1 充能（当前 ${source.uses}）。`)
      },
    },
    {
      kind: 'action',
      label: '[free] 至少 3 充能：与食愿项链交换并转移全部充能',
      cost: { action: false },
      criteria: [({ source }) => (source?.uses || 0) >= 3],
      resolve: ({ inv, source, api }) => {
        const charges = Number(source?.uses) || 0
        if (charges < 3) { api.info('空虚项链上的充能不足 3 个，不能交换。'); return }
        // 从绑定集合取出食愿项链（默认 1 张加入手牌），再放入场。
        api.bonded.retrieve(inv.seat, '06276')
        if (!inv.hand.includes('06277')) {
          api.info('没有找到可交换的「食愿项链」。')
          return
        }
        api.moveCard({ code: '06277', from: 'hand', to: 'play' })
        const wishEater = (inv.assets || []).find(item => item.code === '06277')
        if (wishEater) api.addUses(wishEater, charges)
        // 交换的另一半：空虚项链离场，放到一边（场外）。
        api.moveCard({ code: '06276', from: 'play', to: 'setAside' })
        api.info(`🔄 ${inv.name} 将「空虚项链」与「食愿项链」交换，移动 ${charges} 充能。`)
      },
    },
  ],
  modifiers: [],
}
