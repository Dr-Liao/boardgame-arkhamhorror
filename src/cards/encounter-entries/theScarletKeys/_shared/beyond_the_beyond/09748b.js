// 09748b 异星边境（Alien Frontier）／残骸之城（City of Remnants）· 地点 · beyond_the_beyond
// 正面：强制 - 在你从异星边境移动到它上/下的连接地点时，检定[agility](5)。失败受到 2 点伤害。
//   [action] 受到 1 点恐惧：查看阴影中一个地点或异界牌库顶卡牌的已揭示面。(团队每场游戏一次。)
// 背面：隐匿 1。强制 - 揭露此地点：左边失去 2 资源；中间失去 1 行动。
// 读点与近似同 09748a（move 窗口 + api.map.position 判定上/下）。
import { alienFrontierLook } from './_shared.js'

const CODE = '09748b'

export default {
  code: CODE,
  scope: 'location',
  implemented: true,
  flags: { otherworld: true, shadowLocation: true, concealed: 1, alienFrontier: 'vertical' },
  abilities: [{
    kind: 'forced',
    trigger: 'move',
    label: '从异星边境移动到上/下连接地点：敏捷(5)，失败受 2 点伤害',
    criteria: ({ source, context }) => Boolean(source) && context?.seat != null
      && (String(context?.from) === String(source.id) || String(context?.from) === String(source.originalCode)),
    resolve: ({ source, context, api }) => {
      const seat = Number(context?.seat)
      if (!Number.isSafeInteger(seat) || !context?.location) return
      const from = api.map?.position?.(source.id)
      const to = api.map?.position?.(context.location)
      if (!from || !to || from.x !== to.x) return
      api.test(seat, 'agility', 5, {
        source: { type: 'location', code: CODE, label: '异星边境' },
        resolve: result => {
          if (result?.success) return
          api.damage(seat, 2)
          api.info?.('「异星边境」：敏捷检定失败，受到 2 点伤害。')
        },
      })
    },
  }, alienFrontierLook(CODE), {
    kind: 'forced',
    trigger: 'tskExposed',
    label: '揭露此地点：左边失去 2 资源，中间失去 1 行动',
    criteria: ({ source, context }) => Boolean(source) && context?.decoy !== true
      && String(context?.code ?? context?.kind) === String(source.code),
    resolve: ({ context, api }) => {
      const seat = context?.seat
      if (!Number.isSafeInteger(seat)) return
      if (context.position === 'left') {
        api.loseResources(seat, 2)
        api.info?.('「残骸之城（B）」：阴影左边揭露，失去 2 资源。')
      } else if (context.position === 'middle') {
        api.loseActions(seat, 1)
        api.info?.('「残骸之城（B）」：阴影中间揭露，失去 1 行动。')
      }
    },
  }],
}
