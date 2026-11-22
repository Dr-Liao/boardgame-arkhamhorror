// 60151 托米·马尔登（Tommy Muldoon，2026 核心/入门包调查员）
// 卡面：[action] 花 1 资源或弃掉你控制的一张[[枪械]]支援：从手牌打出 1 张[[枪械]]支援并支付其费用，它入场时额外带 2 子弹。
// [elder_sign]：+1。在你控制的一张有「使用（子弹）」的支援上放置 1 子弹。
// 读点：action 描述子（legalMoves/ability 窗口）；api.playCardFromHandFree 打出枪械；api.addAmmo 加子弹；eldersign 由 elderSignDescriptor 读。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '60151'
const isFirearm = code => (ALL_CARDS[code]?.traits || []).some(trait => String(trait).toLowerCase() === 'firearm')

export default {
  code: CODE,
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  elderSign: {
    id: '60151-eldersign',
    label: '旧印：+1；在有「使用（子弹）」的支援上放置 1 子弹',
    resolve: ({ inv, api }) => {
      const ammoAssets = (inv.assets || []).filter(asset => asset.usesType === 'ammo')
      if (ammoAssets.length) {
        const id = ammoAssets.length === 1 ? ammoAssets[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat, prompt: '选择放置 1 子弹的支援。',
          options: ammoAssets.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const asset = ammoAssets.find(item => item.id === id) || ammoAssets[0]
        if (asset) api.addAmmo(asset, 1)
      }
      return { delta: 1 }
    },
  },
  abilities: [{
    kind: 'action',
    label: '花 1 资源或弃一张枪械：从手牌打出枪械，额外 2 子弹',
    cost: { action: true },
    criteria: [({ inv }) => (inv.hand || []).some(isFirearm)
      && (Number(inv.resources) >= 1 || (inv.assets || []).some(asset => isFirearm(asset.code)))],
    resolve: ({ state, inv, api }) => {
      const handFirearms = (inv.hand || []).filter(isFirearm)
      if (!handFirearms.length) return
      const playable = handFirearms.filter(code => Number(api.playCost?.(code) ?? 0) <= Number(inv.resources))
      if (!playable.length) {
        api.info('手牌里的枪械都付不起费用。')
        return
      }
      const firearmsInPlay = (inv.assets || []).filter(asset => isFirearm(asset.code)
        && !asset.attachedToAsset)
      const canPayResource = Number(inv.resources) >= 1
      const costChoice = canPayResource && firearmsInPlay.length
        ? api.choice({ kind: 'choice', source: CODE, seat: inv.seat,
          prompt: '选择支付方式。', options: [
            { id: 'resource', label: '花费 1 资源' },
            { id: 'discard', label: '从场上弃掉 1 张[[枪械]]支援' },
          ] })
        : canPayResource ? 'resource' : 'discard'
      if (costChoice === 'discard') {
        const id = firearmsInPlay.length === 1 ? firearmsInPlay[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat, prompt: '选择要弃掉的[[枪械]]支援。',
          options: firearmsInPlay.map(asset => ({ id: asset.id, label: api.cardName(asset.code) })),
        })
        const target = firearmsInPlay.find(asset => asset.id === id)
        if (!target || !api.discardAsset(inv.seat, target.id)) return
      } else if (!api.spendResources(inv.seat, 1)) {
        return
      }
      const code = playable.length === 1 ? playable[0] : api.choice({
        kind: 'card', source: CODE, seat: inv.seat, prompt: '选择要从手牌打出的[[枪械]]支援。',
        options: playable.map(item => ({ id: item, label: api.cardName(item) })),
      })
      const before = new Set((inv.assets || []).map(asset => asset.id))
      api.playCardFromHandFree(inv.seat, code, { noAction: true })
      const played = (inv.assets || []).find(asset => asset.code === code && !before.has(asset.id))
      if (played) api.addAmmo(played, 2)
      void state
    },
  }],
  modifiers: [],
}
