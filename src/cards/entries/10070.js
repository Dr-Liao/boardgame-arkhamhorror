// 10070 诈降（False Surrender）· 潜袭者（Rogue）事件 · 1 费 · [[策略]]/[[诡计]]。
// 卡面：谈判。选择你所在地点的一个敌人并打出你手牌中一个[[武器]]支援，费用减少 1 点。
//       然后，你可以用该武器对所选敌人进行一次攻击行动，不使用所示技能，改为使用[敏捷]。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「谈判。」→ played 描述子 countsAs:'parley'（不引发借机攻击）。
//   · 可谈判敌人 → engine/parley.js#parleyForbidden（与实体谈判能力同一份「不能谈判」读点）。
//   · 「打出[[武器]]支援，费用 -1」→ api.playAsEffect(seat, code, { discount: 1 })；
//     折扣与费用校验仍走 doPlay 的唯一付费读点。
// 攻击由所打出武器的可用攻击能力结算，使用敏捷并照付其非行动费用。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10070'

const traitsOf = code => ALL_CARDS[code]?.traits || []
const isWeaponAsset = code => {
  const def = ALL_CARDS[code]
  return def?.type === 'asset' && traitsOf(code).some(trait => String(trait).toLowerCase() === 'weapon')
}

export const parleyEnemies = (state, inv, banned = enemy => enemy.cannotParley || enemy.parleyForbidden) =>
  (state.enemies || []).filter(enemy => enemy.location === inv.location && !banned(enemy))

export const weaponAssetsInHand = inv => [...new Set((inv.hand || []).filter(isWeaponAsset))]

const affordableWeapons = inv => weaponAssetsInHand(inv).filter(code => {
  const cost = Number(ALL_CARDS[code]?.cost)
  return (Number(inv.resources) || 0) >= Math.max(0, (Number.isFinite(cost) ? cost : 0) - 1)
})

const pick = (api, { seat, prompt, options, source }) => options.length === 1
  ? options[0].id
  : api.choice({ kind: 'target', source, seat, prompt, options })

export default {
  code: CODE,
  playCondition: [{
    when: ({ state, inv, helpers }) => parleyEnemies(state, inv, helpers?.parleyForbidden
      ? enemy => helpers.parleyForbidden(inv.seat, enemy) : undefined).length > 0
      && (helpers?.playHandCardOptions?.(inv.seat, { type: 'asset', trait: 'Weapon', discount: 1 }) ?? affordableWeapons(inv)).length > 0,
    message: '所在地点没有可谈判的敌人，或手中没有付得起的[[武器]]支援',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      noOpportunityAttack: true,
      label: '谈判：选择同地点敌人与手中[[武器]]支援（费用 -1），然后可用该武器以[敏捷]攻击该敌人',
      resolve: ({ state, inv, api }) => {
        const enemies = parleyEnemies(state, inv, enemy => api.parleyForbidden(inv.seat, enemy))
        if (!enemies.length) {
          api.info('「诈降」：你所在地点没有可谈判的敌人。')
          return
        }
        const enemyId = pick(api, {
          seat: inv.seat, source: CODE, prompt: '「诈降」：选择要谈判的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === enemyId) || enemies[0]
        const weapons = api.playHandCardOptions(inv.seat, { type: 'asset', trait: 'Weapon', discount: 1 })
        if (!weapons.length) {
          api.info('「诈降」：你手中没有[[武器]]支援。')
          return
        }
        const weaponCode = pick(api, {
          seat: inv.seat, source: CODE, prompt: '「诈降」：选择要打出并使用的[[武器]]支援（费用 -1）。',
          options: weapons.map(code => ({
            id: code, cardCode: code,
            label: `${api.cardName(code)}（${Math.max(0, (Number(api.cardCost(code)) || 0) - 1)} 资源）`,
          })),
        })
        if (!api.playAsEffect(inv.seat, weaponCode, { discount: 1 })) {
          api.info(`「诈降」：「${api.cardName(weaponCode)}」当前无法打出。`)
          return
        }
        const weapon = [...(inv.assets || [])].reverse().find(card => card.code === weaponCode)
        if (!weapon) {
          api.info(`「诈降」：「${api.cardName(weaponCode)}」没有进入场上。`)
          return
        }
        if (!state.enemies.includes(enemy)) return
        const options = { ignoreActionCost: true, actionOnly: true, countsAs: 'fight', targetId: enemy.id, skill: 'agility' }
        const abilities = api.cardAbilityOptions(inv.seat, weapon, options)
        if (!abilities.length) return
        const selected = api.choice({
          kind: 'ability', source: CODE, seat: inv.seat, canSkip: true,
          prompt: '「诈降」：是否使用所打出武器的攻击能力？本次攻击使用敏捷。',
          options: [{ id: 'skip', label: '不攻击' },
            ...abilities.map(ability => ({ id: String(ability.index), label: ability.label }))],
        })
        if (selected !== 'skip') api.resolveCardAbility(inv.seat, weapon, { ...options, abilityIndex: Number(selected) })
      },
    },
  ],
  modifiers: [],
}
