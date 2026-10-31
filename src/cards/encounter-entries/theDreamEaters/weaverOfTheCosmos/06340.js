// 06340 巨网·网梯（地点，3 张）
// 归属：关卡专用 · weaverOfTheCosmos（P8 w-p8-f）。遭遇组：weaver_of_the_cosmos。
// 卡面：强制 - 本地点揭示后：在其上放置 1 个毁灭标记。
// 引擎直读 locationRule.onReveal（locations.js）；地点毁灭的唯一写点是 api.locationDoom。
export default {
  code: '06340',
  scope: 'location',
  implemented: true,
  locationRule: {
    onReveal(state, location, api) {
      api.locationDoom?.add(location, 1)
      api.info?.(`🕸️ 「${location.name}」揭示：在其上放置 1 个毁灭标记。`)
    },
  },
}
