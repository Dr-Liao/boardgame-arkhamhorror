// 06223 地点「白船」（The White Ship · [[船舶]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：
// 你的警报等级至少为 5 时，你不能进入白船。
// 强制 - 白船揭示后：将放在一边的船长剧情支援放置入场，位于白船。
//
// 依据 Haskell Location/Cards/.../TheWhiteShip.hs（alarmLevel >= 5 → CannotEnter；RevealLocation #after →
// getSetAsideCard Assets.theCaptain → CreateAssetAt AtLocation）：
//   · 进入限制 → locationRule.entryErrorAlarmAtLeast（behavior.investigatorEntryError 读 api.counters）；
//   · 揭示时放置剧情支援 → locationRule.onReveal（api.takeFromSetAside + api.storyAsset，引擎唯一剧情资产入场入口）。
const ALARM = 'alarmLevel'
const WHITE_SHIP = '06223'
const THE_CAPTAIN = '06225'

export default {
  code: WHITE_SHIP,
  scope: 'location',
  implemented: true,
  locationRule: {
    entryErrorAlarmAtLeast: { counter: ALARM, value: 5, message: '「白船」：你的警报等级为 5 或更高，不能进入白船。' },
    onReveal(state, location, api) {
      const definition = Object.values(state.scenario?.storyAssets || {})
        .find(card => String(card.originalCode || card.code) === THE_CAPTAIN)
      if (!definition) {
        api.info?.('⛵ 白船：剧本里没有「船长」剧情支援定义，跳过放置。')
        return true
      }
      api.takeFromSetAside?.(THE_CAPTAIN)
      const asset = api.storyAsset?.(THE_CAPTAIN, location.id)
      api.info?.(asset
        ? '⛵ 白船揭示：船长（幻梦境的领航员）被放置入场，位于白船。'
        : '⛵ 白船揭示：船长放置入场失败（可能已在场或缺少原语）。')
      return true
    },
  },
}
