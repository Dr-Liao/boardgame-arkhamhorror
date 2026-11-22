import { ownSeat } from '../../engine/matcher.js'

const code = '60102'
const weaponSearch = { source: code, traits: ['Weapon'], zones: ['deck', 'discard'] }

export default {
  code,
  abilities: [{
    kind: 'reaction',
    trigger: 'assetEnteredPlay',
    label: '治疗 3 点伤害，或查找并支付费用打出一张武器支援',
    criteria: [ownSeat(), ({ source, context }) => context.assetId === source.id],
    resolve: ({ inv, api }) => {
      const mode = inv.damage > 0 ? api.choice({
        kind: 'effect',
        source: code,
        seat: inv.seat,
        prompt: '选择要如何结算这次入场能力。',
        options: [
          { id: 'heal', label: '治疗 3 点伤害' },
          { id: 'weapon', label: '查找并打出一张武器支援' },
        ],
      }) : 'weapon'
      if (mode === 'heal') api.healDamage(inv.seat, 3)
      else if (mode === 'weapon') api.searchPlayableAsset(inv.seat, weaponSearch)
    },
  }],
}
