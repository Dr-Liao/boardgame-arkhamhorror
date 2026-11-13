// 09743 现实扭曲（Warped Reality） · 诡计 · spatial_anomaly
// 归属：战役共用 · theScarletKeys/_shared/spatialAnomaly。
// 卡面：显现 - 附属到你所在地点。
//   强制 - 你在所附属地点结束回合后：选择你手中一张非弱点卡牌，将其放在一边，位于场外，作为一个空洞。
//   [action][action]：弃掉现实扭曲。
//   Revelation - Attach to your location.
//   Forced - After you end your turn at attached location: Choose a non-weakness card in your hand and set it
//   aside, out of play, as a hollow.
//   [action][action]: Discard Warped Reality.
// 读点：
//   · 附属 = api.attachToLocation（location.attachments 唯一写入口）；
//   · 「你在所附属地点结束回合后」= turnEnded 窗口（turn-flow.js 派发，context 带 seat/location）；
//   · 空洞 = api.putInDiscard({ fromHand: true }) + api.takeDiscardCard 把实体移出手牌，
//     再 api.mechanics.tsk.hollow.hollow（tsk-hollow 唯一写入口）；
//   · 「[action][action] 弃掉」= treacheryRule.attachmentAbilities（地点附属卡自身行动的唯一枚举读点，
//     parley.js#entityActionDescriptors / parleyMovesFor 的 locationAttachment 分支）+ cost.action: 2；
//     去除走 api.detachLocationAttachment（地点附属唯一去除写入口）。
import { isWeaknessCode } from '../../../_shared.js'

const CODE = '09743'

const hostOf = (state, source) => (state.locations || [])
  .find(location => (location.attachments || []).includes(source)) || null

// 场上诡计（含地点附属）的通用去除：cardsInPlayTreacheries 在能力面与场景面都可用。
function discardSelf(state, api, source) {
  const row = api.cardsInPlayTreacheries().find(entry => entry.attachment === source)
  if (!row) return false
  return api.discardCardInPlay(row)
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: {
    attachmentAbilities: [{
      kind: 'action', actionKind: 'activate', cost: { action: 2 },
      label: '弃掉现实扭曲（花费 2 个行动）',
      resolve: ({ state, source, api }) => {
        if (!discardSelf(state, api, source)) return
        api.info?.('🌌 「现实扭曲」被弃掉了。')
      },
    }],
  },
  encounterResolve(state, inv, card, api) {
    api.attachToLocation(inv.location, { code: CODE, originalCode: CODE })
    api.info?.(`🌌 「现实扭曲」附属到「${api.locationName(inv.location)}」。`)
    return { placed: true }
  },
  abilities: [{
    kind: 'forced', trigger: 'turnEnded', silent: true,
    label: '你在所附属地点结束回合后：一张非弱点手牌被放在一边成为空洞',
    criteria: ({ state, source, context }) => {
      const host = hostOf(state, source)
      if (!host || !Number.isInteger(context?.seat)) return false
      const inv = state.investigators[context.seat]
      return Boolean(inv) && !inv.defeated && !inv.resigned && inv.location === host.id
    },
    resolve: ({ state, source, context, api }) => {
      const inv = state.investigators[context.seat]
      if (!inv) return
      const candidates = (inv.hand || []).map((code, index) => ({ code, index }))
        .filter(item => !isWeaknessCode(item.code))
      if (!candidates.length) {
        api.info?.('🌌 「现实扭曲」：没有非弱点手牌可放在一边。')
        return
      }
      const chosen = candidates.length === 1 ? candidates[0] : candidates.find(item => String(item.index) === String(api.choose({
        kind: 'card', source: CODE, seat: inv.seat,
        prompt: '现实扭曲：选择一张非弱点手牌放在一边，作为空洞。',
        options: candidates.map(item => ({ id: String(item.index), cardCode: item.code, label: api.cardName(item.code) })),
      }))) || candidates[0]
      if (api.mechanics.tsk.hollow.isHollowed(chosen.code)) {
        api.info?.(`🌌 「${api.cardName(chosen.code)}」已有同名空洞，忽略本次（原语按卡号去重）。`)
        return
      }
      api.putInDiscard(inv.seat, chosen.code, { fromHand: true })
      api.takeDiscardCard(inv.seat, chosen.code)
      api.mechanics.tsk.hollow.hollow({ code: chosen.code, source: CODE, scope: 'investigator', seat: inv.seat })
      api.info?.(`🌌 ${inv.name} 的「${api.cardName(chosen.code)}」被放在一边成为空洞。`)
      void source
    },
  }],
  note: 'approximation: 地点附属的 [action][action] 必须声明在 treacheryRule.attachmentAbilities（引擎对地点附属'
    + '只枚举这一处行动）；同名空洞按 tsk-hollow 的卡号去重口径披露。无缺读点。',
}
