// 60464 灌注生命（Infuse Life，Marie Lambeau）
// 卡面：治疗你所在地点调查员和/或[[盟友]]支援总计 3 点伤害。
import { ALL_CARDS } from '../cards-data.js'

export default {
  code: '60464',
  abilities: [{
    kind: 'played',
    label: '治疗同地点调查员/盟友总计 3 点伤害',
    resolve: ({ state, inv, api }) => {
      let remaining = 3
      while (remaining > 0) {
        const investigators = state.investigators.filter(other => other.location === inv.location
          && !other.defeated && (other.damage || 0) > 0)
        const allies = state.investigators.filter(other => other.location === inv.location)
          .flatMap(owner => owner.assets.filter(asset => (asset.damage || 0) > 0
            && (ALL_CARDS[asset.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')))
        const options = [
          ...investigators.map(other => ({ id: `seat:${other.seat}`, label: `${other.name}（伤害 ${other.damage}）` })),
          ...allies.map(asset => ({ id: `asset:${asset.id}`, label: `${api.cardName(asset.code)}（伤害 ${asset.damage}）` })),
        ]
        if (!options.length) break
        const answer = options.length === 1 ? options[0].id : api.choice({
          kind: 'heal', source: '60464', seat: inv.seat,
          prompt: `治疗 1 点伤害（剩余 ${remaining}）。`, options,
        })
        if (String(answer).startsWith('seat:')) api.healDamage(Number(String(answer).slice(5)), 1)
        else {
          const asset = allies.find(item => `asset:${item.id}` === String(answer))
          if (asset) api.healAsset(asset, { damage: 1 })
        }
        remaining -= 1
      }
    },
  }],
}
