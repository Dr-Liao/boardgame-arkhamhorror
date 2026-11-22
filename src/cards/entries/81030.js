// 81030 兽性变化（Monstrous Transformation）· 剧情资产（玩家侧）
// 归属：狼人诅咒剧情奖励（结局 3 由战役效果加入诅咒持有者的牌组，不计入牌组张数）。
//
// 卡面：快速。将你[意志]和[智识]的基础值设为 2。将你[战斗]和[敏捷]的基础值设为 5。
//       [action] 横置兽性变化：攻击。你本次攻击造成 +1 伤害。
//
// 实现口径（只用描述子 + ctx.api，不直接改 state）：
//   · 「基础值设为 2/5」= 用数值修正的差值表达（2 - 调查员印刷基础值 / 5 - 基础值），
//     引擎读点 modifiers.js 的 skill:<name> 修正管线；与其它修正仍按同一读点叠加。
//   · 快速 = 条目级 fast（资产关键字读点）；scenarioPlayable = 战役奖励加入牌组后可打出
//     （读点 src/engine/stats.js#runtimeCardAvailable，需战役牌组记录包含该卡）。
//   · [action] 攻击 +1 伤害 = action 描述子：cost { action, exhaust }，countsAs 'fight'，
//     resolve 里用 api.fight(seat, enemyId, { damageBonus: 1 })（combat.js 的 damageBonus 读点）。
import { attackableEnemies } from './_shared.js'

// 「把基础值设为 N」= 相对印刷基础值的差量（引擎 skill:<name> 修正管线唯一读点）。
const setBaseTo = (value, field) => ({ inv }) => value - Number(inv?.[field] || 0)

export default {
  code: '81030',
  name: '兽性变化',
  fast: true,
  scenarioPlayable: true,
  modifiers: [
    { target: 'skill:willpower', amount: setBaseTo(2, 'willpower') },
    { target: 'skill:intellect', amount: setBaseTo(2, 'intellect') },
    { target: 'skill:combat', amount: setBaseTo(5, 'combat') },
    { target: 'skill:agility', amount: setBaseTo(5, 'agility') },
  ],
  abilities: [
    {
      kind: 'action',
      label: '兽性变化：攻击（本次攻击 +1 伤害）',
      cost: { action: true, exhaust: true },
      countsAs: 'fight',
      resolve: ({ state, inv, api }) => {
        const targets = attackableEnemies(state, inv)
        if (!targets.length) {
          api.info('你所在地点没有可攻击的敌人。')
          return
        }
        const enemyId = targets.length === 1
          ? targets[0].id
          : api.choice({
            kind: 'enemy', source: '81030', seat: inv.seat, prompt: '选择攻击目标。',
            options: targets.map(enemy => ({ id: enemy.id, label: enemy.name })),
          })
        const enemy = targets.find(item => item.id === enemyId) || targets[0]
        api.fight(inv.seat, enemy.id, { damageBonus: 1 })
      },
    },
  ],
}
