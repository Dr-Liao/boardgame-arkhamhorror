// 05341 · 敌人 05341 盲目舞者：生成于离调查员最远的在场地点（虚空格子近似的 spawnLocation）；
// 「经猎手关键词进入虚空格子后再次结算猎手（每轮一次）」由 behavior.hunterMove 用「进入非枢纽宇宙地点」
// 近似实现。卡面规则的唯一实现位置见注释；本文件负责归属与 implemented 审计读点。
export default {
  code: '05341',
  scope: 'enemy',
  implemented: true,
}
