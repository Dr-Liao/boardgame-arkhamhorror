// 08706 瘴气折磨 · 横置并附属到受控伙伴，且该支援不能重整。
import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08706'

function attachedAsset(inv, source) {
  return inv.assets.find(asset => asset.attachments?.some(attachment => attachment.id === source.id))
}

export default {
  code: CODE, scope: 'treachery', implemented: true,
  treacheryRule: {
    preventsHostReady: true,
    attachmentAbilities: [{
      kind: 'action', actionKind: 'activate',
      label: '意志或智力（3）：成功时弃掉瘴气折磨',
      resolve: ({ inv, source, api }) => {
        const skill = api.choice({
          kind: 'skill', source: CODE, seat: inv.seat, prompt: '选择检定技能。',
          options: [{ id: 'willpower', label: '意志（3）' }, { id: 'intellect', label: '智力（3）' }],
        })
        api.test(inv.seat, skill, 3, {
          source: { type: 'treachery', code: CODE, ability: true },
          resolve: result => { if (result.success) api.discardAttachment(source) },
        })
      },
    }],
  },
  abilities: [{
    kind: 'forced', trigger: 'turnEnded',
    label: '伙伴控制者的回合结束：该伙伴受到 1 伤害或 1 恐惧',
    criteria: ({ state, source, context }) => !!attachedAsset(state.investigators[context.seat], source),
    resolve: ({ state, source, context, api }) => {
      const owner = state.investigators[context.seat]
      const asset = attachedAsset(owner, source)
      const printed = ALL_CARDS[asset.originalCode || asset.code]
      const options = []
      if (asset.health > 0 || printed?.health > 0) options.push({ id: 'damage', label: '受到 1 点伤害' })
      if (asset.sanity > 0 || printed?.sanity > 0) options.push({ id: 'horror', label: '受到 1 点恐惧' })
      if (!options.length) return
      const harm = options.length === 1 ? options[0].id : api.choice({
        kind: 'effect', source: CODE, seat: owner.seat, prompt: '选择该伙伴承受的伤害或恐惧。', options,
      })
      if (harm === 'damage') api.scenario.damageAsset(owner.seat, asset.id, 1)
      if (harm === 'horror') api.scenario.horrorAsset(owner.seat, asset.id, 1)
    },
  }],
  encounterResolve(state, inv, card, api) {
    const partners = inv.assets.filter(asset => asset.partner || ALL_CARDS[asset.originalCode || asset.code]?.text?.startsWith('Partner.'))
    if (!partners.length) return { gainSurge: true }
    const id = partners.length === 1 ? partners[0].id : api.choice({
      kind: 'asset', source: CODE, seat: inv.seat, prompt: '选择要横置并附属瘴气折磨的伙伴。',
      options: partners.map(asset => ({ id: asset.id, label: asset.name || asset.code })),
    })
    const target = partners.find(asset => asset.id === id)
    if (!target) return false
    api.exhaust(target)
    return !!api.attachToAsset(inv.seat, target.id, CODE)
  },
}
