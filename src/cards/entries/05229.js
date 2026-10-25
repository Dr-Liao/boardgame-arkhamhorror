// 05229 鸣枪示警（守护者 · 0 经验）
// 卡面：作为打出鸣枪示警的额外费用，花费你控制的一张[[枪械]]支援的1子弹。
// 卡面：将你所在地点的所有非[[精英]]敌人移动到一个连接地点。本行动不会触发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05229 鸣枪示警：花 1 子弹（[[枪械]]支援）→ 把所在地点所有非精英敌人移到一个连接地点，不引发借机攻击。
//
// 实现备注：额外费用在 resolve 开头支付（找不到带子弹的[[枪械]]支援时整张牌不结算）。
// [[枪械]]判定读印刷特性 Firearm（cards-data），且该支援要有子弹（uses + usesType=ammo）。
// 只有 usesType=ammo 不够：04204 华饰弓也是 ammo 但不是[[枪械]]，不能用来支付本费用。

import { ALL_CARDS } from '../../cards/cards-data.js'

const isFirearm = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => String(trait).toLowerCase() === 'firearm')

// 你控制的、还有子弹的[[枪械]]。
function firearmWithAmmo(inv) {
  return (inv.assets || []).filter(card => isFirearm(card.code)
    && (card.uses || 0) >= 1 && /ammo/i.test(String(card.usesType || '')))
}

export default {
  code: '05229',
  playCondition: [{
    when: ({ inv }) => firearmWithAmmo(inv).length > 0,
    message: '没有可以花费 1 子弹的[[枪械]]支援',
  }],
  abilities: [
    {
      kind: 'played',
      noOpportunityAttack: true,
      label: '鸣枪示警：移动所在地点的所有非精英敌人到一个连接地点',
      resolve: ({ state, inv, api }) => {
        const firearms = firearmWithAmmo(inv)
        if (!firearms.length) { api.info('没有可以花费 1 子弹的[[枪械]]支援。'); return }
        const firearm = firearms.length === 1 ? firearms[0] : firearms.find(card => card.id === api.choice({
          kind: 'target', source: '05229', seat: inv.seat,
          prompt: '选择要花费 1 子弹的[[枪械]]支援。',
          options: firearms.map(card => ({ id: card.id, label: api.cardName(card.code) })),
        })) || firearms[0]
        api.addUses(firearm, -1)
        api.info(`💥 ${inv.name} 从「${api.cardName(firearm.code)}」花费 1 子弹鸣枪示警。`)
        const here = state.locations.find(location => location.id === inv.location)
        const destinations = (here?.connections || []).filter(id => state.locations.some(location => location.id === id))
        if (!destinations.length) { api.info('所在地点没有连接地点。'); return }
        const destination = destinations.length === 1 ? destinations[0] : api.choice({
          kind: 'location', source: '05229', seat: inv.seat,
          prompt: '选择敌人要移动到的连接地点。',
          options: destinations.map(id => ({ id, label: api.locationName(id) })),
        })
        const targets = state.enemies.filter(enemy => enemy.location === inv.location && !enemy.elite)
        if (!targets.length) { api.info('所在地点没有非[[精英]]敌人。'); return }
        for (const enemy of targets.slice()) api.moveEnemy(enemy, destination)
        api.info(`🏃 所在地点的 ${targets.length} 个非[[精英]]敌人被赶往「${api.locationName(destination)}」。`)
      },
    },
  ],
}
