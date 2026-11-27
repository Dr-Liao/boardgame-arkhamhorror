// 09651 亚历山大地下陵墓 · 地点（dogsOfWar）
// 印刷数据由章节 definition 的 location() 从卡表读取；地点能力由章节 behavior 承接。
// 未揭示面限制由调查员及敌人移动共用读点处理；毁灭标记达到 6 个时由章节揭示。
export default {
  code: '09651',
  scope: 'location',
  implemented: true,
  flags: { victory: 1, printedShroud: 5, printedClues: 2, },
  locationRule: {
    unrevealedRestrictions: {
      investigatorsCannotEnter: true,
      enemyCodesCannotLeave: ['09655a'],
    },
  },
  abilities: [],
}
