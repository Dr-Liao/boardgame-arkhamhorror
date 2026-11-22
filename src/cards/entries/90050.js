// 90050 吉姆的小号（Jim's Trumpet · Advanced）· 中立 · 支援/道具/乐器/遗物 · 手部槽 · 吉姆牌库专用。
//
// 卡面（cards-data 90050）：
//   Jim Culver deck only. Advanced.
//   [reaction] When a [skull] or [curse] token is revealed during a skill test you are performing,
//     exhaust Jim's Trumpet: Heal 1 horror from each investigator and [[Ally]] asset at your
//     location or a connecting location.
//
// 引擎读点：
//   · 揭示标记后的窗口 `chaosTokenRevealed`（windows.js；tests.js 每枚标记揭示后开窗，
//     context = { seat, token, tokenIndex, location }）。条件：本次检定是自己发起的
//     （`state.skillTest.seat === inv.seat`）、token 为 skull/curse。
//   · 横置费用：描述子 `cost: { exhaust: true }`（ability-exec.js 统一支付）。
//   · 治疗：`api.healHorror(seat, 1)`（api-misc.js）与 `api.healAsset(asset, { horror: 1 })`
//     （api-misc.js；支援恐惧同一治疗入口）。范围 = 你所在地点 + 连接地点（读 location.connections）。
//   · Ally 支援：cards-data traits 含 'Ally' 的受控支援。
//   · 「你自己」也在「each investigator」范围里（你所在地点）。

import { ALL_CARDS } from '../cards-data.js'

const code = '90050'
const isTargetToken = token => token === 'skull' || token === 'curse'
const isAllyAsset = cardCode => (ALL_CARDS[cardCode]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'ally')

export default {
  code,
  abilities: [
    {
      kind: 'reaction',
      trigger: 'chaosTokenRevealed',
      label: '自己检定中揭示 [skull]/[curse] 后：横置小号，治疗本地点/连接地点的所有调查员与盟友支援 1 点恐惧',
      cost: { exhaust: true },
      criteria: ({ inv, state, context }) => context?.seat === inv.seat
        && isTargetToken(context.token)
        && state.skillTest?.seat === inv.seat,
      resolve: ({ inv, state, api }) => {
        const here = state.locations.find(location => location.id === inv.location)
        const inRange = new Set([inv.location, ...(here?.connections || [])])
        let healed = 0
        for (const target of state.investigators) {
          if (!inRange.has(target.location) || target.defeated || target.resigned) continue
          if (target.horror > 0) {
            api.healHorror(target.seat, 1)
            healed += 1
          }
        }
        for (const owner of state.investigators) {
          for (const asset of owner.assets || []) {
            if (asset.facedown || !isAllyAsset(asset.code) || !(asset.horror > 0)) continue
            if (!inRange.has(owner.location)) continue
            api.healAsset(asset, { horror: 1 })
            healed += 1
          }
        }
        if (healed) api.info(`吉姆的小号治疗了 ${healed} 个目标各 1 点恐惧。`)
      },
    },
  ],
  modifiers: [],
}
