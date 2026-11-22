// 60479 吉姆·卡尔弗（Jim Culver，Marie Lambeau，4 XP）
// 卡面：你得到 +1[willpower]。
//       [reaction] 你受到伤害和/或恐惧后，横置吉姆·卡尔弗：抽 1 张牌并获得 1 资源。
import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60479',
  modifiers: [{ target: 'skill:willpower', amount: 1 }],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'horrorPlaced',
      label: '受到恐惧后横置：抽 1 张牌并获得 1 资源',
      cost: { exhaust: true },
      criteria: [ownSeat()],
      resolve: ({ inv, api }) => {
        api.drawCards(inv.seat, 1)
        api.gainResources(inv.seat, 1)
      },
    },
    {
      kind: 'reaction',
      trigger: 'harmDealt',
      label: '受到伤害后横置：抽 1 张牌并获得 1 资源',
      cost: { exhaust: true },
      criteria: [ownSeat(), ({ context }) => Number(context?.damage) > 0],
      resolve: ({ inv, api }) => {
        api.drawCards(inv.seat, 1)
        api.gainResources(inv.seat, 1)
      },
    },
  ],
}
