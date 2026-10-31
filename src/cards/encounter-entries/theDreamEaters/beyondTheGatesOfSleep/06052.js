// 06052 魔幻森林·巨石阵（Enchanted Woods · Great Stone Circle）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：强制 - 本地图揭示后：把放在一边的「辛劳的古革巨人」生成在本地地点。
// 读点：locationRule.onReveal（引擎 locations.js#revealLocation 直接读）。
const CODE = '06052'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  locationRule: {
    onReveal(state, location, api) {
      api.takeFromSetAside?.('06060')
      const enemy = api.spawn?.('06060', location.id)
      api.info?.(`🗿 「巨石阵」揭示：辛劳的古革巨人在此现身${enemy ? '' : '（生成失败，已按生成失败规则处理）'}。`)
      return true
    },
  },
}
