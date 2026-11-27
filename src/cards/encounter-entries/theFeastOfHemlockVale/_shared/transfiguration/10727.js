// 10727 真菌感染（Fungal Rot）· 诡计 · 共享遭遇组 transfiguration（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/transfiguration。
// 卡面（cards-data 10727）：
//   显现 - 将真菌感染附属到一张你控制的没有附属真菌感染的[[道具]]支援。
//   如果你不能这么做，真菌感染获得涌动。
//   将所附属支援的文本框视为如同空白（除[[特性]]外）。
//   [action]：检定[战斗](3)。如果你检定成功，弃掉真菌感染。否则，受到 1 点伤害。
//
// 读点（声明即接线）：
//   · 「附属到[[道具]]支援」= api.attachToAsset（scenario-runtime 的遭遇卡附属写入口，
//     attachCardTo 会挂到 asset.attachments）；
//   · 宿主文本框空白使用 treacheryRule.blankHost；摆脱通过地点相同的附属行动。
//   · 不能附属时获得涌动 = encounterResolve 返回 { gainSurge: true }（encounter.js#finishDraw）。
//
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '10727'
const DIFFICULTY = 3

const isItemAsset = asset => ((ALL_CARDS[asset?.code]?.traits) || []).includes('Item')

const hasRot = asset => (asset?.attachments || [])
  .some(card => (card.originalCode || card.code) === CODE)

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  treacheryRule: {
    blankHost: true,
    attachmentAbilities: [{
      kind: 'action',
      actionKind: 'activate',
      label: '真菌感染：检定战斗(3)。成功弃掉本卡，失败受到 1 点伤害',
      resolve: ({ inv, source, api }) => api.test(inv.seat, 'combat', DIFFICULTY, {
        source: { type: 'scenario', action: 'activate', code: CODE, label: '真菌感染：检定战斗(3)' },
        resolve(result) {
          if (result.success) api.scenario.detachEncounterAttachmentById(source.id)
          else api.damage(inv.seat, 1)
        },
      }),
    }],
  },
  flags: {
    traits: ['Hazard', 'Blight'],
    quantity: 2,
    attachToItemAsset: true,
    blankHostTextExceptTraits: true,
    escapeAction: { skill: 'combat', difficulty: DIFFICULTY, failDamage: 1 },
  },
  encounterResolve(state, inv, card, api) {
    const candidates = (inv?.assets || []).filter(asset => isItemAsset(asset) && !hasRot(asset))
    if (!candidates.length) {
      api.info?.(`🍄 「真菌感染」：${inv?.name || '调查员'} 没有可附属的[[道具]]支援，获得涌动。`)
      return { gainSurge: true }
    }
    const answer = candidates.length === 1 ? candidates[0].id : String(api.choice({
      kind: 'asset', source: CODE, seat: inv.seat,
      prompt: '选择要附属「真菌感染」的[[道具]]支援。',
      options: candidates.map(asset => ({
        id: asset.id, label: api.cardName?.(asset.code) || asset.code, cardCode: asset.code,
      })),
    }))
    const host = candidates.find(asset => String(asset.id) === answer) || candidates[0]
    api.attachToAsset(inv.seat, host.id, CODE)
    api.info?.(`🍄 「真菌感染」附属到「${api.cardName?.(host.code) || host.code}」（其文本框视为空白）。`)
    return true
  },
}
