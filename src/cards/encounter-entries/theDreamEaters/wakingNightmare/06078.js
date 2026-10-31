// 06078 蛛群入侵（The Infestation Begins...）· 剧本参考/故事卡
// 归属：关卡专用 · theDreamEaters/wakingNightmare（P8-1 w-p8-a）。
// 卡面（正面）：在目前线索最多的地点放置 1 个伤害标记（3–4 人局为线索最多的 2 个地点）。
//   本局余下时间，地点上的伤害标记表示蔓延的寄生；带伤害标记的地点是「寄生地点」。
//   建立一个独立袋：skull、tablet×4、cultist×2（滋生袋/滋生标记，不是混乱标记）。
//   有些能力会让玩家进行「蛛群滋生检定」：从滋生袋随机揭示 1 个标记并结算另一面（本卡背面）的结果。
// 卡面（背面）：仅用于滋生检定：[skull] 从遭遇牌库/弃牌堆找 1 个[[蜘蛛]]敌人生成在最近的寄生地点；
//   [tablet] 无事；[cultist] 选择与寄生地点相邻的地点变为寄生，然后若已放置 2 个 [cultist] 则把所有滋生标记放回袋。
// 读点（Lead 口径 3）：storyAsset scope + flags。章节 behavior 的滋生袋机械（建袋/标记寄生/滋生检定/
//   蔓延与重置）用 entryFlags('06078') 读取这里的袋内容与 token 效果；「在攻击/躲避检定中把 tablet 当一个
//   skull 结算」的临时修改由 Outbreak 条目声明（06083），behavior 读取。
export default {
  code: '06078',
  scope: 'storyAsset',
  implemented: true,
  flags: {
    infestationReference: true,
    infestationBag: {
      id: 'infestation',
      tokens: ['skull', 'tablet', 'tablet', 'tablet', 'tablet', 'cultist', 'cultist'],
    },
    infestationTokenEffects: {
      skull: 'spawnSpiderNearestInfested',
      tablet: 'nothing',
      cultist: 'spreadToAdjacentThenResetOnSecondCultist',
    },
    // 「伤害标记代表寄生」：引擎用 tokenBag 的 infestedLocations 承载寄生地点（P3 原语），
    // behavior 在放标记/替代表记时以 markInfested/clearInfested 与之对应。
    locationMarker: 'damageToken',
  },
}
