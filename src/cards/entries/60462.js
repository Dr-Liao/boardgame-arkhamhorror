// 60462 吞噬生命（Consume Life，Marie Lambeau）
// 卡面：攻击（[willpower]）。本次攻击造成 +1 伤害。
//       如果本次攻击击败了一个敌人，治疗你所在地点的一位调查员或一个[[盟友]]支援 1 点伤害。
import { attackableEnemies } from './_shared.js'
import { ALL_CARDS } from '../cards-data.js'

export default {
  code: '60462',
  abilities: [{
    kind: 'played',
    label: '攻击（意志）+1 伤害；击败敌人则治疗 1 伤害',
    resolve: ({ state, inv, api }) => {
      const targets = attackableEnemies(state, inv)
      if (!targets.length) {
        api.info('没有可攻击的敌人。')
        return
      }
      const chosen = targets.length === 1 ? targets[0].id : api.choice({
        kind: 'target', source: '60462', seat: inv.seat,
        prompt: '选择攻击目标。',
        options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = targets.find(item => item.id === chosen) || targets[0]
      api.fight(inv.seat, enemy.id, {
        skill: 'willpower', damageBonus: 1, noSpend: true, sourceCode: '60462',
        onSuccess: () => {
          if (state.enemies.some(item => item.id === enemy.id)) return
          const investigators = state.investigators.filter(other => other.location === inv.location
            && !other.defeated && (other.damage || 0) > 0)
          const allies = state.investigators.filter(other => other.location === inv.location)
            .flatMap(owner => owner.assets.filter(asset => (asset.damage || 0) > 0
              && (ALL_CARDS[asset.code]?.traits || []).some(trait => String(trait).toLowerCase() === 'ally')))
          const options = [
            ...investigators.map(other => ({ id: `seat:${other.seat}`, label: `${other.name}（伤害 ${other.damage}）` })),
            ...allies.map(asset => ({ id: `asset:${asset.id}`, label: `${api.cardName(asset.code)}（伤害 ${asset.damage}）` })),
          ]
          if (!options.length) return
          const answer = options.length === 1 ? options[0].id : api.choice({
            kind: 'heal', source: '60462', seat: inv.seat,
            prompt: '击败敌人：治疗 1 点伤害。', options,
          })
          if (String(answer).startsWith('seat:')) api.healDamage(Number(String(answer).slice(5)), 1)
          else {
            const asset = allies.find(item => `asset:${item.id}` === String(answer))
            if (asset) api.healAsset(asset, { damage: 1 })
          }
        },
      })
    },
  }],
}
