// 10085 卡纳玛戈斯之杖：揭示五枚随机混乱标记，出现诅咒便随机附属一张绑定的腐烂。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10085'
const targets = state => state.enemies.filter(enemy => !enemy.elite && !enemy.defeated && !enemy.removedFromGame && !enemy.global)
const isRot = code => ALL_CARDS[code]?.traits?.some(trait => trait.toLowerCase() === 'rot')

export default {
  code: CODE,
  abilities: [{
    kind: 'free',
    label: '横置：选择任意地点的非精英敌人；揭示五枚混乱标记，出现诅咒则随机附属一张腐烂',
    cost: { exhaust: true },
    criteria: [({ state }) => targets(state).length > 0],
    resolve: ({ state, inv, api }) => {
      const enemies = targets(state)
      const id = enemies.length === 1 ? enemies[0].id : api.choice({
        kind: 'target', source: CODE, seat: inv.seat,
        prompt: '选择卡纳玛戈斯之杖的非精英目标。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      const enemy = enemies.find(candidate => candidate.id === id)
      if (!enemy) return
      const bag = [...state.chaosBag]
      const revealed = []
      while (bag.length && revealed.length < 5) revealed.push(bag.splice(Math.floor(api.random() * bag.length), 1)[0])
      api.info('卡纳玛戈斯之杖揭示 ' + revealed.map(token => api.tokenLabel(token)).join('、') + '。')
      if (!revealed.includes('curse')) return
      const available = api.bonded.group(CODE).copies
        .map(copy => copy.code).filter(code => isRot(code) && api.bonded.has(inv.seat, code))
      if (!available.length) return
      api.bonded.attachToEnemy(inv.seat, available[Math.floor(api.random() * available.length)], enemy)
    },
  }],
}
