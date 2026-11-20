// 11663 · storyAsset · obsidianCanyons
//
// 天空遗物[rune_f]（放一边）。[action][敏捷](8)，投入卡牌的技能图标翻倍；成功翻面结算故事面（近似：behavior.events.obsidianErodedFrieze 未覆盖本卡，翻面/检定未接线，仅数据）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11663',
  scope: 'storyAsset',
  implemented: true,
  flags: { skyRelic: true, glyph: 'rune_f', glyphWord: 'Stars', flipsToStory: true },
  
  note: "天空遗物[rune_f]（放一边）。[action][敏捷](8)，投入卡牌的技能图标翻倍；成功翻面结算故事面（近似：behavior.events.obsidianErodedFrieze 未覆盖本卡，翻面/检定未接线，仅数据）。",
}
