// 06103 恶心蛛网（Sickening Webs，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：spiders（WOC）。
// 卡面：Revelation - 附属到你所在地点。
//       位于附属地点的每个[[蜘蛛]]敌人获得反击与警戒。调查员不能移动离开附属地点。
//       [action]：检定[combat](3) 或 [agility](3)。成功则弃掉恶心蛛网。
// 实现：附属地点走 api.attachToLocation；「蜘蛛敌人获得反击/警戒」「不能离开」「摆脱行动」
//   需要共享层对地点附属的数据分派（location.attachments → 关键字授予 / moveError / actions）→
//   已登记 coordinator request。数据写在 flags 上（条件 + 摆脱检定）。
export default {
  code: '06103',
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    api.attachToLocation?.(inv.location, { code: '06103', originalCode: '06103' })
    api.info?.(`🕸️ 「恶心蛛网」附属到「${api.locationName?.(inv.location) || inv.location}」。`)
    return true
  },
  flags: {
    spiderKeywords: ['retaliate', 'alert'],
    blocksMovementOut: true,
    discardAction: { skills: ['combat', 'agility'], difficulty: 3 },
  },
  simplified: true,
  note: '关键字授予/移动封锁/摆脱行动需要共享层地点附属数据分派；已登记 coordinator request。',
}
