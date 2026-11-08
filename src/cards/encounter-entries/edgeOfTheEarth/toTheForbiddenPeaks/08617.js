// 08617 瘴气水晶（Miasmic Crystal）· storyAsset
//
// 归属：关卡专用 · edgeOfTheEarth/toTheForbiddenPeaks（P7）。
// 卡面：
//   使用(3充能)。
//   [reaction]在一位你所在地点的调查员抽取到一张忒咳哩-哩弱点时，花费1充能：该调查员取消该弱点的效果，
//   将其放到忒咳哩-哩牌库底，并抽取1张卡牌。
//
// 读点：treachery 中断窗口（src/engine/windows.js 的 'treachery'，由
// src/engine/treachery-tokens.js 在显现前打开，context 带 cardCode/seat/location 且支持
// `context.cancelled`）；忒咳哩-哩去向走 api.mechanics.tekeli.return（引擎 P2 原语）。
const TEKELI_FACE_CODES = Object.freeze(['08723', '08724', '08725', '08726', '08727', '08728', '08729'])

export default {
  code: '08617',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'charges',
  flags: { expedition: true },
  abilities: [{
    kind: 'reaction',
    trigger: 'treachery',
    label: '花费 1 充能：取消同地点一位调查员抽到的忒咳哩-哩弱点，放回牌库底并抽 1 张',
    cost: { action: false, exhaust: true, uses: 1 },
    criteria: ({ state, inv, context }) => Boolean(context)
      && TEKELI_FACE_CODES.includes(String(context.cardCode))
      && state.investigators?.[context.seat]?.location === inv.location,
    resolve: ({ state, inv, api, context }) => {
      // 取消显现走玩家工具原语（与 08049/08095 同一取消记账口径）；失败时退回中断窗口的
      // 统一取消字段。
      if (!api.playerTools?.cancelRevelation?.(context)) context.cancelled = true
      api.mechanics.tekeli.return(context.cardCode, { destination: 'bottom' })
      api.drawCards(context.seat, 1)
      api.info(`🔮 瘴气水晶：取消「忒咳哩-哩」的效果并把它放到忒咳哩-哩牌库底；${state.investigators[context.seat]?.name || '调查员'} 抽 1 张牌。`)
    },
  }],
}
