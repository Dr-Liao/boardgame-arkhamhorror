// 10026 举起手来（Hold Up）· 守卫者事件 · 1 资源 · 策略/诡计
// 卡面：谈判。选择你所在地点的一个敌人和你手牌中一个 [[道具]] 支援。对所选敌人执行一次攻击行动。
//       如果你检定成功，不造成伤害，改为打出所选支援，其费用减少你超过难度的点数。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「谈判。」：played 描述子 `countsAs: 'parley'`（打出按谈判结算，不引发借机攻击）。
//   · 打出条件：playCondition 要求同地点有敌人、手里有[[道具]]支援（docs/card-model.md §5）。
//   · 「执行一次攻击行动」：`api.fight(seat, enemyId, { noSpend: true, damageOverride: 0 })`
//     （攻击的唯一入口；noSpend 表示这次攻击是事件效果的一部分，不再花行动；
//     damageOverride: 0 = 「不造成伤害」，武器/效果附加的伤害仍会计入，故本次攻击固定 0 伤害）。
//   · 「费用减少你超过难度的点数」：B3 检定结果契约的 successBy = result.value - result.difficulty；
//     打出走 `api.playCard(seat, code, { discount, noAction: true })`（09067「我收下了！」同一读点，
//     预览 = 校验 = 扣费同源）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10026'

const isItemAsset = code => {
  const def = ALL_CARDS[code]
  if (!def || def.type !== 'asset') return false
  return (def.traits || []).some(trait => String(trait).toLowerCase() === 'item')
}

const itemAssetsInHand = inv => [...new Set((inv?.hand || []).filter(isItemAsset))]
const enemiesHere = (state, inv) => (state.enemies || []).filter(enemy => enemy.location === inv.location)

export default {
  code: CODE,
  name: 'Hold Up',
  playCondition: [
    {
      when: ({ state, inv }) => enemiesHere(state, inv).length > 0,
      message: '所在地点没有敌人',
    },
    {
      when: ({ inv }) => itemAssetsInHand(inv).length > 0,
      message: '手牌中没有[[道具]]支援',
    },
  ],
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      label: '谈判：攻击同地点敌人；成功则改为以 -成功点数费用打出手牌中的[[道具]]支援',
      resolve: ({ state, inv, api }) => {
        const targets = enemiesHere(state, inv)
        if (!targets.length) {
          api.info('「举起手来」：所在地点没有敌人。')
          return
        }
        const enemyId = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'target', source: CODE, seat: inv.seat,
          prompt: '举起手来：选择要攻击的敌人。',
          options: targets.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.code })),
        })
        const enemy = targets.find(item => item.id === enemyId) || targets[0]
        const items = itemAssetsInHand(inv)
        if (!items.length) {
          api.info('「举起手来」：手牌中没有[[道具]]支援。')
          return
        }
        const cardCode = items.length === 1 ? items[0] : api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: '举起手来：选择要打出的[[道具]]支援。',
          options: items.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        const code = items.includes(cardCode) ? cardCode : items[0]
        const result = api.fight(inv.seat, enemy.id, { noSpend: true, damageOverride: 0 })
        if (!result?.success) return
        const successBy = Math.max(0, Number(result.value) - Number(result.difficulty))
        if (!api.playCard(inv.seat, code, { discount: successBy, noAction: true })) {
          api.info(`「举起手来」：「${api.cardName(code)}」当前不能打出。`)
          return
        }
        api.info(`🤚 举起手来：检定成功 ${successBy} 点，「${api.cardName(code)}」费用 -${successBy} 打出（本次攻击不造成伤害）。`)
      },
    },
  ],
  modifiers: [],
}
