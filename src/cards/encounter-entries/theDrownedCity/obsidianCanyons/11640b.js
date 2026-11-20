// 11640b · story · obsidianCanyons
//
// 双面风故事卡（背面 11640 西风）。强制效果在 behavior.roundEnded：按风暴强度揭示标记，出现非[elder_sign]符号标记时按东风向左吹第 1/3 行并翻面。西征（v.I）Setup 用本卡面。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11640b',
  scope: 'storyAsset',
  implemented: true,
  flags: { winds: 'eastern', direction: 'left', windRows: [1, 3] },
  
  note: "双面风故事卡（背面 11640 西风）。强制效果在 behavior.roundEnded：按风暴强度揭示标记，出现非[elder_sign]符号标记时按东风向左吹第 1/3 行并翻面。西征（v.I）Setup 用本卡面。",
}
