// 09511 大本钟 · 地点（riddlesAndRain）
// 印刷数据由章节 definition 的 location() 从卡表读取；地点能力由章节 behavior 承接。
// approximation: P7 数据型条目（地点/幕/议程/剧情/密钥数据由章节 definition 与 behavior 承接，逐卡动作/显现由场景测试与 P8 逐卡验收覆盖）
export default {
  code: '09511',
  scope: 'location',
  implemented: true,
  flags: { victory: 1, printedShroud: 4, printedClues: 1, },
  note: 'approximation: P7 数据型条目（地点/幕/议程/剧情/密钥数据由章节 definition 与 behavior 承接，逐卡动作/显现由场景测试与 P8 逐卡验收覆盖）',
  abilities: [],
}
