import { ownFirstAction, ownTurn } from '../../engine/matcher.js'

const code = '11023'
const firearmSpec = { type: 'asset', trait: 'Firearm', discount: 2 }
const upgradeSpec = { type: 'event', trait: 'Upgrade' }

export default {
  code,
  playCondition: [ownTurn(), ownFirstAction(), ({ inv, helpers }) =>
    helpers.playHandCardOptions(inv.seat, firearmSpec).length > 0],
  abilities: [
    {
      kind: 'played',
      label: '以 2 资源折扣打出手中的枪械；可以再打出升级事件，尽可能附属到该枪械',
      resolve: ({ inv, api }) => {
        const firearms = api.playHandCardOptions(inv.seat, firearmSpec)
        if (!firearms.length) return
        const firearm = firearms.length === 1 ? firearms[0] : api.choice({
          kind: 'card', source: code, seat: inv.seat, prompt: '选择要少花费 2 资源打出的枪械。',
          options: firearms.map(id => ({ id, label: api.cardName(id), cardCode: id })),
        })
        if (!firearms.includes(firearm)) return
        const newAsset = api.playAsEffect(inv.seat, firearm, { discount: 2 })
        if (!newAsset) return
        const upgrades = api.playHandCardOptions(inv.seat, upgradeSpec)
        if (!upgrades.length) return
        const upgrade = api.choice({
          kind: 'card', source: code, seat: inv.seat, canSkip: true, prompt: '可以再打出一张升级事件。',
          options: [{ id: 'skip', label: '跳过' },
            ...upgrades.map(id => ({ id, label: api.cardName(id), cardCode: id }))],
        })
        if (upgrades.includes(upgrade)) api.playAsEffect(inv.seat, upgrade, { preferredAttachmentTargetId: newAsset?.id })
      },
    },
  ],
}
