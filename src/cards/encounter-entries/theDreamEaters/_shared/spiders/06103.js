// 06103 恶心蛛网（Sickening Webs，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：spiders（WOC）。
// 卡面：Revelation - 附属到你所在地点。
//       位于附属地点的每个[[蜘蛛]]敌人获得反击与警戒。调查员不能移动离开附属地点。
//       [action]：检定[combat](3) 或 [agility](3)。成功则弃掉恶心蛛网。
// 实现：附属地点走 api.attachToLocation；引擎实时读取 enemyKeywordAura 授予蜘蛛敌人
//   反击与警戒，TDE 共享层读取 blocksMovementOut/discardAction 处理移动限制与摆脱行动。
export default {
  code: '06103',
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    enemyKeywordAura: { trait: 'Spider', keywords: ['retaliate', 'alert'] },
  },
  encounterResolve(state, inv, card, api) {
    api.attachToLocation?.(inv.location, { code: '06103', originalCode: '06103' })
    api.info?.(`🕸️ 「恶心蛛网」附属到「${api.locationName?.(inv.location) || inv.location}」。`)
    return true
  },
  flags: {
    blocksMovementOut: true,
    discardAction: { skills: ['combat', 'agility'], difficulty: 3 },
  },
}
