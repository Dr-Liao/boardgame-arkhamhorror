// 如履薄冰（On Thin Ice · 09609）· 桌面坐标与展示连线。
//
// 参考实现 `Scenarios/TheScarletKeys/OnThinIce.hs` 的四行地图：
//
//   .         .         alaskanWilderness1 .             outerWilderness1
//   anchorage fairbanks alaskanWilderness2 .             outerWilderness2
//   .         .         alaskanWilderness3 .             outerWilderness3
//   .         .         .                  outsidersLair .
//
// 规则连接仍由印刷符号在运行时决定（definition.js 的 `symbols.dynamic`）；本文件的 `edges` 只是
// **展示连线**，必须同时是 manifest 已声明的规则连接（schema.js#assertUiLayout 的口径）：
// 这里只画「未揭示面的骨架」——安克雷奇↔费尔班克斯、费尔班克斯↔三张阿拉斯加荒地、
// 山间溪流↔三张界外荒地。三张阿拉斯加荒地在卡面朝下时是 Triangle（只连费尔班克斯），
// 揭示后的 Circle/Moon/Square 也只多出彼此/界外荒地的边，所以骨架永远是印刷连接的子集。
import { OUTER_WILDERNESS_LOCATION_IDS, WILDERNESS_LOCATION_IDS } from './definition.js'

export const SCENARIO_LAYOUT_COORDINATES = Object.freeze({
  anchorage: Object.freeze({ x: 0, y: 1 }),
  fairbanks: Object.freeze({ x: 1, y: 1 }),
  frozenLake: Object.freeze({ x: 2, y: 0 }),
  mountainStream: Object.freeze({ x: 2, y: 1 }),
  isolatedRoad: Object.freeze({ x: 2, y: 2 }),
  forgottenOutpost: Object.freeze({ x: 4, y: 0 }),
  huntersLodge: Object.freeze({ x: 4, y: 1 }),
  condemnedGoldMine: Object.freeze({ x: 4, y: 2 }),
  outsidersLair: Object.freeze({ x: 3, y: 3 }),
})

const edges = [
  { from: 'anchorage', to: 'fairbanks' },
  ...WILDERNESS_LOCATION_IDS.map(id => ({ from: 'fairbanks', to: id })),
  ...OUTER_WILDERNESS_LOCATION_IDS.map(id => ({ from: 'mountainStream', to: id })),
]

export const layout = Object.freeze({
  locations: SCENARIO_LAYOUT_COORDINATES,
  edges: Object.freeze(edges.map(edge => Object.freeze({ ...edge }))),
})
