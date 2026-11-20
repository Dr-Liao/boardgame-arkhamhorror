// 11663 · storyAsset · obsidianCanyons
//
// 天空遗物[rune_f]（放一边）。[action][敏捷](8)，投入卡牌的技能图标翻倍；成功翻面结算故事面（controlledAsset action：api.test 敏捷(8)，behavior.commitIconMultiplier 翻倍投入图标；成功 api.flipAsset → 11663b 并记录 rune_f「Stars」、api.addStoryToVictory）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11663',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  // 印刷「若天空遗物将离场，将它移出游戏」：读点 scenario-decks.js#discardEncounterAttachment。
  leavesPlayTo: 'removed',
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    label: '[action]：检定[敏捷](8)，本次检定中投入卡牌的技能图标翻倍；成功则翻面并结算故事面',
    criteria: ({ inv, source }) => inv.assets.includes(source),
    resolve: ({ state, inv, source, api }) => {
      const asset = inv.assets.find(item => item.id === source.id)
      if (!asset) return false
      api.setScenarioFlag?.('skyRelicTestSeat', inv.seat)
      api.test(inv.seat, 'agility', 8, result => {
        api.setScenarioFlag?.('skyRelicTestSeat', null)
        if (result?.success !== true) return
        api.flipAsset(asset, '11663b')
        const records = api.campaignRecord?.('discoveredGlyphs') || []
        if (!records.includes('rune_f')) api.setCampaignRecord?.('discoveredGlyphs', [...records, 'rune_f'])
        api.setScenarioFlag?.('glyphWords', { ...(api.scenarioFlag?.('glyphWords') || {}), rune_f: 'Stars' })
        api.addStoryToVictory?.('11663b', { sourceId: asset.id })
        api.info?.('天空遗物翻面：记录 [rune_f]「Stars」，并加入胜利区。')
      })
      void state
      return true
    },
  }],
  flags: { skyRelic: true, glyph: 'rune_f', glyphWord: 'Stars', flipsToStory: true },
  
  note: "天空遗物[rune_f]（放一边）。[action][敏捷](8)，投入卡牌的技能图标翻倍；成功翻面结算故事面（近似：behavior.events.obsidianErodedFrieze 未覆盖本卡，翻面/检定未接线，仅数据）。",
}
