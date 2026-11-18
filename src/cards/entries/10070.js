// 10070 诈降（False Surrender）· 潜袭者（Rogue）事件 · 1 费 · [[策略]]/[[诡计]]。
// 卡面：谈判。选择你所在地点的一个敌人并打出你手牌中一个[[武器]]支援，费用减少 1 点。
//       然后，你可以用该武器对所选敌人进行一次攻击行动，不使用所示技能，改为使用[敏捷]。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 「谈判。」→ played 描述子 countsAs:'parley'（不引发借机攻击）。
//   · 可谈判敌人 → engine/parley.js#parleyForbidden（与实体谈判能力同一份「不能谈判」读点）。
//   · 「打出[[武器]]支援，费用 -1」→ api.playCard(seat, code, { discount: 1, noAction: true })；
//     折扣与费用校验仍走 doPlay 的唯一付费读点。
//   · 「用该武器……攻击，改用[敏捷]」→ api.fight({ assetId, skill:'agility', noSpend:true })：
//     不重复花费行动（卡面给的是“进行一次攻击行动”），并使用刚入场的武器作为攻击来源。
//   · 近似（见 note）：没有“以替代技能激活某张支援自己的攻击能力”的入口；本次攻击因此不会
//     花费该武器的弹药/充能，也不会复刻武器能力里写死的 +伤害/特殊修正，只按 weapons 作为来源
//     参与修正常规管线。已将缺口登记到 artifacts/migration/fhv/primitive-requests/10070.json。
import { ALL_CARDS } from '../../cards/cards-data.js'

// 「该敌人不能被谈判」的窄判据：条目声明的禁止标记（完整读点见 engine/parley.js#parleyForbidden；
// 卡文件不 import 引擎，P7 若需要统一改由共享原语暴露）。
const parleyForbidden = (state, inv, entity) => Boolean(entity?.cannotParley || entity?.parleyForbidden)


const CODE = '10070'

const traitsOf = code => ALL_CARDS[code]?.traits || []
const isWeaponAsset = code => {
  const def = ALL_CARDS[code]
  return def?.type === 'asset' && traitsOf(code).some(trait => String(trait).toLowerCase() === 'weapon')
}

export const parleyEnemies = (state, inv) => (state.enemies || []).filter(enemy =>
  enemy.location === inv.location && !parleyForbidden(state, inv, enemy))

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
  simplified: true,
  note: 'approximation: 「用该武器攻击」走 api.fight(assetId, skill:agility, noSpend) —— 不激活武器自身的攻击能力，因此不花费其弹药/充能、也不复刻其能力内写死的伤害/技能修正；替代技能激活支援能力的入口见 primitive-requests/10070.json。',
  playCondition: [{
    when: ({ state, inv }) => parleyEnemies(state, inv).length > 0 && affordableWeapons(inv).length > 0,
    message: '所在地点没有可谈判的敌人，或手中没有付得起的[[武器]]支援',
  }],
  abilities: [
    {
      kind: 'played',
      countsAs: 'parley',
      noOpportunityAttack: true,
      label: '谈判：选择同地点敌人与手中[[武器]]支援（费用 -1），然后可用该武器以[敏捷]攻击该敌人',
      resolve: ({ state, inv, api }) => {
        const enemies = parleyEnemies(state, inv)
        if (!enemies.length) {
          api.info('「诈降」：你所在地点没有可谈判的敌人。')
          return
        }
        const enemyId = pick(api, {
          seat: inv.seat, source: CODE, prompt: '「诈降」：选择要谈判的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === enemyId) || enemies[0]
        const weapons = weaponAssetsInHand(inv)
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
        if (!api.playCard(inv.seat, weaponCode, { discount: 1, noAction: true })) {
          api.info(`「诈降」：「${api.cardName(weaponCode)}」当前无法打出。`)
          return
        }
        const weapon = [...(inv.assets || [])].reverse().find(card => card.code === weaponCode)
        if (!weapon) {
          api.info(`「诈降」：「${api.cardName(weaponCode)}」没有进入场上。`)
          return
        }
        const answer = api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: `「诈降」：是否用「${api.cardName(weaponCode)}」对「${enemy.name}」进行一次攻击（使用[敏捷]）？`,
          options: [{ id: 'fight', label: '进行攻击（使用[敏捷]）' }, { id: 'skip', label: '不攻击' }],
        })
        if (answer !== 'fight') return
        if (!state.enemies.includes(enemy)) return
        api.fight(inv.seat, enemy.id, {
          assetId: weapon.id,
          skill: 'agility',
          noSpend: true,
        })
      },
    },
  ],
  modifiers: [],
}
