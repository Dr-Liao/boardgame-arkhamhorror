// 10098 卡纳玛戈斯之杖：每揭示一枚诅咒，可选择一张绑定的腐烂附属到同一敌人。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10098'
const targets = state => state.enemies.filter(enemy => !enemy.elite && !enemy.defeated && !enemy.removedFromGame && !enemy.global)
const isRot = code => ALL_CARDS[code]?.traits?.some(trait => trait.toLowerCase() === 'rot')

export default {
  code: CODE,
  abilities: [{
    kind: 'free',
    label: '横置：选择任意地点的非精英敌人；揭示五枚混乱标记，每枚诅咒可附属一张腐烂',
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
      const curses = revealed.filter(token => token === 'curse').length
      const rots = api.bonded.group(CODE).copies.map(copy => copy.code).filter(isRot)
      for (let count = 0; count < curses; count += 1) {
        const available = rots.filter(code => api.bonded.has(inv.seat, code))
        if (!available.length) break
        const selected = api.choice({
          kind: 'target', source: CODE, seat: inv.seat, canSkip: true,
          prompt: '选择一张绑定的腐烂附属到敌人。',
          options: [...available.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
            { id: 'done', label: '不再附属' }],
        })
        if (!available.includes(selected) || !api.bonded.attachToEnemy(inv.seat, selected, enemy)) break
      }
    },
  }],
}
