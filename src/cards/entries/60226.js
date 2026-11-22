// 60226 心胜于物
// 卡面：快速。只能在你的回合打出。
// 卡面：直到本轮结束，将你的[intellect]分别加到你的[combat]和[agility]上。抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '60226',
  playCondition: [{ when: ownTurn(), message: '只能在你的回合期间打出' }],
  abilities: [{
    kind: 'played',
    fast: true,
    label: '直到轮末，战斗和敏捷均加上当前智识；抽 1 张牌',
    resolve: ({ inv, api }) => {
      api.addEffect({
        duration: 'endOfRound',
        sourceCode: '60226',
        label: '意志超越肉体',
        modifiers: [
          { target: 'skill:combat', amount: { skill: 'intellect' } },
          { target: 'skill:agility', amount: { skill: 'intellect' } },
        ],
      }, inv.seat)
      api.drawCards(inv.seat, 1)
    },
  }],
}
