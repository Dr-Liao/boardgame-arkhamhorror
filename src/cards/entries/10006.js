// 10006 以太电流（Aetheric Current）· 尤格斯星 · 事件 · 绑定（磁通量稳定器）
// 卡面：
//   绑定（磁通量稳定器）。只有磁通量稳定器（开启）面朝上才能打出。
//   攻击。将你控制的支援卡上所有的线索移动到凯特·温斯罗普身上。你本次攻击可以不使用[combat]，
//   改为使用[intellect]。如果你检定成功，且被攻击的敌人非[[精英]]，你可以横置该敌人并将其移动到
//   任意地点。抽取 1 张卡牌。将磁通量稳定器翻面（保留所有的标记和附属）。
//
// 读点（卡面 → 引擎读点）：
//   · 绑定关系来自卡面数据 `bondedCards` / `bondedTo`（bonded.js），条目不需要额外字段；
//     playCondition 读「受控支援里是否有 10005b 朝上的磁通量稳定器」。
//   · 「攻击。」= played 描述子 `countsAs: 'fight'`，且打出不引发借机攻击（`noOpportunityAttack`，
//     与 05113/06164 同一口径）。
//   · 目标过滤用 entries/_shared.js#attackableEnemies（冷漠口径与引擎一致）。
//   · 线索搬移：逐张 api.transferControlledClues(asset → investigator)（P2 原语，含离场回落标记）。
//   · 属性替代：api.fight(seat, enemyId, { skill })（combat.js#actionTestSkill 直接接受替换技能；
//     09096/05113 等同一读点）；`noSpend: true` 因为打牌本身已经付了行动。
//   · 成功后「横置并移动」：api.exhaustEnemy + api.moveEnemy（scenario-runtime 的敌人移动原语）。
//   · 抽 1：api.drawCards；翻面：api.flipAsset(flux, '10005')（保留标记/附属）。
//
// 近似：攻击成功且敌人仍存活时才询问「横置并移动」（若这一击把敌人击败，卡面没有可移动的对象）；
// 移动目标为场上除其当前地点外的任意地点（对当前位置的移动是无意义选择，不列出）。
import { attackableEnemies } from './_shared.js'

const activeFlux = inv => (inv.assets || []).find(asset => asset.code === '10005b')
const fightTargets = (state, inv) => attackableEnemies(state, inv)

function moveAllAssetClues(inv, api) {
  let moved = 0
  for (const asset of [...(inv.assets || [])]) {
    const clues = Number(asset.clues) || 0
    if (!clues) continue
    moved += api.transferControlledClues(inv.seat, asset.id, 'investigator', clues) || 0
  }
  return moved
}

function flipFluxBack(inv, api) {
  const flux = activeFlux(inv)
  if (!flux) return false
  api.flipAsset(flux, '10005')
  api.info('🧲 磁通量稳定器翻回（关闭）面（保留所有标记与附属）。')
  return true
}

export default {
  code: '10006',
  name: '以太电流（尤格斯星）',
  note: '成功后的「横置并移动」在敌人仍存活时询问；移动目标列出场上除其当前地点外的任意地点（对当前位置的移动是无意义选择）。',
  playCondition: [
    {
      when: ({ inv }) => Boolean(activeFlux(inv)),
      message: '只有磁通量稳定器（开启）面朝上才能打出「以太电流」',
    },
    {
      when: ({ state, inv }) => fightTargets(state, inv).length > 0,
      message: '所在地点没有可攻击的敌人',
    },
  ],
  abilities: [
    {
      kind: 'played',
      label: '攻击（可用智识代替战斗）：搬回支援线索，成功后横置并移动非精英敌人，抽 1 张，翻回稳定器',
      countsAs: 'fight',
      noOpportunityAttack: true,
      resolve: ({ state, inv, api }) => {
        const moved = moveAllAssetClues(inv, api)
        if (moved) api.info(`🧲 凯特把支援上的 ${moved} 个线索移回自己身上。`)
        const targets = fightTargets(state, inv)
        if (!targets.length) {
          api.info('所在地点没有可攻击的敌人。')
        } else {
          const useIntellect = api.choice({
            kind: 'skill', source: '10006', seat: inv.seat,
            prompt: '本次攻击使用哪项技能？',
            options: [
              { id: 'intellect', label: '[intellect] 代替 [combat]' },
              { id: 'combat', label: '[combat]' },
            ],
          }) !== 'combat'
          const enemy = targets.length === 1 ? targets[0] : targets.find(card => card.id === api.choice({
            kind: 'target', source: '10006', seat: inv.seat,
            prompt: '选择要攻击的敌人。',
            options: targets.map(card => ({ id: card.id, label: card.name })),
          })) || targets[0]
          const result = api.fight(inv.seat, enemy.id, {
            skill: useIntellect ? 'intellect' : 'combat',
            noSpend: true,
            sourceCode: '10006',
          })
          if (result?.success && !enemy.elite && state.enemies.includes(enemy)) {
            const answer = api.choice({
              kind: 'effect', source: '10006', seat: inv.seat,
              prompt: `「${enemy.name}」非精英：是否横置它并移动到任意地点？`,
              options: [
                { id: 'exhaustMove', label: '横置并移动到任意地点' },
                { id: 'skip', label: '不横置也不移动' },
              ],
            })
            if (answer === 'exhaustMove') {
              api.exhaustEnemy(enemy)
              const destinations = state.locations.filter(location => location
                && location.inPlay !== false && location.id !== enemy.location)
              if (destinations.length) {
                const destination = destinations.length === 1 ? destinations[0].id : api.choice({
                  kind: 'move', source: '10006', seat: inv.seat,
                  prompt: `选择「${enemy.name}」要移动到的地点。`,
                  options: destinations.map(location => ({ id: location.id, label: api.locName(location.id) })),
                })
                api.moveEnemy(enemy, destination)
                api.info(`⚡ 「${enemy.name}」被横置并移动到「${api.locName(destination)}」。`)
              } else {
                api.info(`⚡ 「${enemy.name}」被横置；场上没有其它可移动的地点。`)
              }
            }
          }
        }
        api.drawCards(inv.seat, 1)
        flipFluxBack(inv, api)
      },
    },
  ],
  modifiers: [],
}
