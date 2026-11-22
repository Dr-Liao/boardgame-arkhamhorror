// 重返谢幕 · 桌面布局。
//
// 参考 ReturnToCurtainCall.hs 的布局（5 列 × 3 行）：
//   lobbyDoorway1 .     balcony .         backstageDoorway1
//   lobbyDoorway3 lobby theatre backstage backstageDoorway3
//   lobbyDoorway2 .     .       .         backstageDoorway2
// 前厅门道 1–3 = 灯光控制室 / 售票处 / 休息室（+ 重返的剧院休息室），
// 后台门道 1–3 = 更衣室 / 排练室 / 道具室（+ 重返的道具间）。
// 基础实现使用真实地点 id 而非「门道槽位」，这里沿用它并补两间重返地点。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  lightingBox: { x: 0, y: 0 },
  balcony: { x: 1, y: 0 },
  greenRoom: { x: 2, y: 0 },
  dressingRoom: { x: 4, y: 0 },
  boxOffice: { x: 0, y: 1 },
  lobby: { x: 1, y: 1 },
  theatre: { x: 2, y: 1 },
  backstage: { x: 3, y: 1 },
  rehearsalRoom: { x: 4, y: 1 },
  trapRoom: { x: 4, y: 2 },
  theatreLounge: { x: 0, y: 2 },
  propShop: { x: 5, y: 1 },
})
