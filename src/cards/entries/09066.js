// 09066 连打带跑（Hit and Run）· 游荡者（Rogue）事件 · 0 经验 · 策略 · 技巧。
//
// 卡面：快速。只能在你回合期间打出。
//       将你手牌中的一张[[盟友]]支援放置入场。当你的回合结束时，如果该支援依然在场，将其返回你手牌。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「放置入场」→ api.putIntoPlay（走 newPlayerAssetInstance 的正常入场流程与入场窗口）。
//   · 「这张事件跟着该支援，回合结束时返回手牌」→ 事件卡以附属形态挂在该支援上
//     （api.attachPlayerCardToAsset + keepOnPlay，与 05230/08074 同一种「事件留在宿主上」的形状），
//     条目的 forced 描述子挂 turnEnded 窗口（turn-flow.js 的回合结束窗口）；附属来源由
//     ability-rules#descriptorSources 的 attachments 分支枚举（source.hostAssetId 指回宿主）。
//   · 「返回手牌」→ api.returnAssetToHand（leaveAsset + putInHand 的唯一实现）。
//     （效果 DSL 的 returnAssetToHand 在本轮的探针里没有生效，因此用 api 直连同一条实现。）
import { ownTurn } from '../../engine/matcher.js'

const CODE = '09066'

export default {
  code: CODE,
  keepOnPlay: true,
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '快速：把手中的一张[[盟友]]支援放置入场，回合结束时返回手牌',
      resolve: ({ inv, api }) => {
        const allies = [...new Set((inv.hand || []).filter(code => api.cardType(code) === 'asset'
          && api.cardTraits(code).some(trait => String(trait).toLowerCase() === 'ally')))]
        if (!allies.length) {
          api.info('「连打带跑」：你手中没有[[盟友]]支援。')
          return
        }
        const picked = allies.length === 1 ? allies[0] : api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '「连打带跑」：选择要放置入场的[[盟友]]支援。',
          options: allies.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const placed = api.putIntoPlay(inv.seat, picked)
        if (!placed) {
          api.info(`「连打带跑」：「${api.cardName(picked)}」当前不能放置入场。`)
          return
        }
        api.attachPlayerCardToAsset(CODE, placed, { ownerSeat: inv.seat })
        api.info(`🏃 「连打带跑」：「${api.cardName(picked)}」放置入场，本回合结束时返回手牌。`)
      },
    },
    {
      kind: 'forced',
      trigger: 'turnEnded',
      label: '回合结束时：若该[[盟友]]依然在场，将其返回你的手牌',
      criteria: [({ source, context, inv }) => Boolean(source?.hostAssetId)
        && Number(context?.seat ?? inv.seat) === inv.seat],
      resolve: ({ inv, source, api }) => {
        const host = (inv.assets || []).find(asset => asset.id === source?.hostAssetId)
        if (!host) {
          api.putIntoDiscard(inv.seat, CODE)
          return
        }
        api.returnAssetToHand(inv.seat, host)
        api.putIntoDiscard(inv.seat, CODE)
        api.info(`🏃 「连打带跑」：回合结束，「${api.cardName(host.code)}」返回你的手牌。`)
      },
    },
  ],
  playCondition: [ownTurn()],
  modifiers: [],
}
