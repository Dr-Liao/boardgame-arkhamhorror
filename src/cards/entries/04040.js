// 04040 厄运降临
// 卡面：剧本模式专用。
// 卡面：显现 - 受到1点恐惧。在剧本日志中，你的调查员取得的剧情支援/弱点下方，记录“厄运降临”。如果已经有此条记录，将厄运降临从你的牌库中移除，查找收藏，找出被诅咒的命运并将它放到你的牌库底。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04040 厄运降临：显现由弱点描述子的 resolve 接管（读点 src/engine/weakness.js:51-55）。
// 记录写进剧本日志 state.campaign.records（跨剧本持久），不再只写局内 inv.weaknessCounters；
// 计数器保留为旧存档兼容镜像。参考实现：Arkham/Treachery/Cards/Doomed.hs:17-37
// （CampaignLogKey.DoomApproaches；已记录则受 1 恐惧 + 移除本卡 + 把 AccursedFate 放到牌库底）。
// 卡面上的“从你的牌库中移除”在引擎里无法持久生效（无内容层可调用的战役牌组移除接口），
// 已用 records 标记避免重复加入后续弱点卡；根治建议见 primitive-requests/player-1-04040.json。

const UPGRADE_CODE = '04041' // 被诅咒的命运（与 upgradesFrom: 'impendingDoom' 一致）

export default {
  code: '04040',
  abilities: [
    {
      kind: 'weakness', label: '厄运降临', weakness: { type: 'impendingDoom' },
      resolve: ({ state, inv, api }) => {
        // 显现：受到 1 点恐惧（可分配给支援吸收）。
        api.horror(inv.seat, 1)
        const records = (state.campaign.records ||= {})
        const already = records.doomApproaches === true
          || Number(inv.weaknessCounters?.impendingDoom || 0) > 0 // 旧存档兼容：只有计数器没有日志记录
        // 局内计数器保留为兼容镜像（旧存档/旧测试读取）。
        inv.weaknessCounters ||= {}
        inv.weaknessCounters.impendingDoom = (inv.weaknessCounters.impendingDoom || 0) + 1
        if (!already) {
          records.doomApproaches = true
          api.info('📜 剧本日志：在你的调查员取得剧情支援/弱点处记录“厄运降临”。')
          return
        }
        // 已有记录：把本卡从牌库移除，并把「被诅咒的命运」放到牌库底（牌库底是 deck[0]，抽牌从末端 pop）。
        inv.deck = (inv.deck || []).filter(code => code !== '04040')
        if (records.accursedFateAdded !== true) {
          records.accursedFateAdded = true // 防止本卡被重洗回牌库后重复加入副本
          inv.deck.unshift(UPGRADE_CODE)
          api.info('📜 已有“厄运降临”记录：移除厄运降临，查找收藏把「被诅咒的命运」放到你的牌库底。')
        } else {
          api.info('📜 已有“厄运降临”记录：移除厄运降临（「被诅咒的命运」此前已加入牌库）。')
        }
      },
    },
  ],
  modifiers: [

  ],
}
