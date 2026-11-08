// 08663 大封印（The Great Seal）· 幕 2
// 正面目标：把尽可能多的激活封印放到伊夸之门；五枚全部放上则推进（→R1）。
export default {
  code: '08663',
  scope: 'act',
  implemented: true,
  actRule: {
    objective: { type: 'allSealsOnGate' },
  },
}
