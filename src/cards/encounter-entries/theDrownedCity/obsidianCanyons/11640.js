// 11640 · story · obsidianCanyons
//
// 双面风故事卡（背面 11640b 东风）。强制效果在 behavior.roundEnded：按风暴强度揭示标记，出现非[elder_sign]符号标记时按西风向右吹第 2/4 行并翻面。西征（v.I）Setup 用东风面（11640b），东征（v.II）用本卡面。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11640',
  scope: 'storyAsset',
  implemented: true,
  flags: { winds: 'western', direction: 'right', windRows: [2, 4] },
  
  note: "双面风故事卡（背面 11640b 东风）。强制效果在 behavior.roundEnded：按风暴强度揭示标记，出现非[elder_sign]符号标记时按西风向右吹第 2/4 行并翻面。西征（v.I）Setup 用东风面（11640b），东征（v.II）用本卡面。",
}
