// 04041 被诅咒的命运
// 卡面：显现 - 受到2点恐惧。在剧本日志中，你的调查员取得的剧情支援/弱点下方，记录“时间到”。如果已经有此条记录，将被诅咒的命运从你的牌库中移除，查找收藏，找出丧钟敲响并将它放到你的牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04041 被诅咒的命运：显现由弱点描述子的 resolve 接管（读点 src/engine/weakness.js:51-55）。
// 记录写进剧本日志 state.campaign.records（跨剧本持久）；计数器保留为旧存档兼容镜像。
// 参考实现：Arkham/Treachery/Cards/AccursedFate.hs:17-38
// （CampaignLogKey.TheHourIsNigh；已记录则受 2 恐惧 + 移除本卡 + 把 TheBellTolls 放到牌库底）。

const UPGRADE_CODE = '04042' // 丧钟敲响（与 upgradesFrom: 'cursedFate' 一致）

export default {
  code: '04041',
  upgradesFrom: 'impendingDoom',
  abilities: [
    {
      kind: 'weakness', label: '被诅咒的命运', weakness: { type: 'cursedFate' },
      resolve: ({ state, inv, api }) => {
        // 显现：受到 2 点恐惧（可分配给支援吸收）。
        api.horror(inv.seat, 2)
        const records = (state.campaign.records ||= {})
        const already = records.theHourIsNigh === true
          || Number(inv.weaknessCounters?.cursedFate || 0) > 0 // 旧存档兼容：只有计数器没有日志记录
        inv.weaknessCounters ||= {}
        inv.weaknessCounters.cursedFate = (inv.weaknessCounters.cursedFate || 0) + 1
        if (!already) {
          records.theHourIsNigh = true
          api.info('📜 剧本日志：在你的调查员取得剧情支援/弱点处记录“时间到”。')
          return
        }
        // 已有记录：把本卡从牌库移除，并把「丧钟敲响」放到牌库底（牌库底是 deck[0]，抽牌从末端 pop）。
        inv.deck = (inv.deck || []).filter(code => code !== '04041')
        if (records.theBellTollsAdded !== true) {
          records.theBellTollsAdded = true // 防止本卡被重洗回牌库后重复加入副本
          inv.deck.unshift(UPGRADE_CODE)
          api.info('📜 已有“时间到”记录：移除被诅咒的命运，查找收藏把「丧钟敲响」放到你的牌库底。')
        } else {
          api.info('📜 已有“时间到”记录：移除被诅咒的命运（「丧钟敲响」此前已加入牌库）。')
        }
      },
    },
  ],
  modifiers: [

  ],
}
