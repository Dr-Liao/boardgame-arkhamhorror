// 09669 雪兰莪俱乐部 · 地点（shadesOfSuffering）
// 印刷数据由章节 definition 的 location() 从卡表读取；地点能力由章节 behavior 承接。
// 重整收入由 phases.js 读取地点规则；谈判治疗由章节 behavior 承接。
export default {
  code: '09669',
  scope: 'location',
  implemented: true,
  flags: { printedShroud: 2, printedClues: 1, },
  locationRule: { noUpkeepResources: true },
  abilities: [],
}
