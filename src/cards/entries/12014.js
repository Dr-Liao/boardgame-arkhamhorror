// 12014 伊莎贝拉的.45双枪（Isabelle's Twin .45s）· 生存者 · 道具/武器/枪械 · 双手槽 · 4 资源。
// （伊莎贝拉·巴恩斯签名卡）
//
// 卡面：伊莎贝拉·巴恩斯牌库专用。使用 (6 子弹)。
//   [action] 花费 1 子弹：攻击 ([combat])。你本次攻击得到 +1 [combat] 并且造成伤害 +1。
//   [reaction] 你结算上述能力后，花费 1 子弹并横置本卡：攻击 ([agility])。
//     你本次攻击得到 +1 [agility] 并且造成伤害 +1。
//
// 引擎读点：
//   · 使用次数：条目级 uses/usesType（实例初始化读点 newPlayerAssetInstance）；费用 cost.uses 扣子弹。
//   · 攻击：api.fight 的 assetId / combatBonus / damageBonus；反应用 skill: 'agility' 替换检定技能。
//   · 「结算上述能力后」：`assetActionResolved` 窗口（ability-exec.js 在 action 描述子结算后开窗，
//     context 带 assetId + descriptorId）；反应描述子用 descriptorId 精确匹配同一个攻击能力。
//   · 反应目标：窗口上下文不带敌人，因此按 api.choice 从同地点敌人中选择（反应不是行动，不花行动点）。

const code = '12014'
const ATTACK_ID = '12014-attack'

export default {
  code,
  uses: 6,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      id: ATTACK_ID,
      countsAs: 'fight',
      label: '花费 1 子弹：攻击（+1 [combat]、+1 伤害）',
      cost: { action: true, uses: 1 },
      target: { kind: 'enemy' },
      resolve: ({ inv, source, target, api }) => {
        if (!target) return
        api.fight(inv.seat, target.id, {
          assetId: source?.id,
          sourceCode: code,
          combatBonus: 1,
          damageBonus: 1,
        })
      },
    },
    {
      kind: 'reaction',
      trigger: 'assetActionResolved',
      // 「结算上述能力后」= 每次该能力结算一次；反应窗口结算后会重新枚举候选，
      // 因此用 perWindow 限次（同一次 assetActionResolved 窗口只触发一次）。
      limit: { scope: 'perWindow', owner: 'instance' },
      label: '结算上述攻击后，花费 1 子弹并横置：用 [agility] 攻击（+1 [agility]、+1 伤害）',
      cost: { uses: 1, exhaust: true },
      criteria: [({ source, context }) => context?.assetId === source?.id
        && context?.descriptorId === ATTACK_ID],
      resolve: ({ inv, source, state, api }) => {
        const enemies = (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location === inv.location
          && api.canDamageEnemy(enemy, inv.seat))
        if (!enemies.length) {
          api.info('「伊莎贝拉的.45双枪」：没有可攻击的敌人。')
          return
        }
        const id = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: code, seat: inv.seat,
          prompt: '选择用敏捷攻击的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(item => item.id === id)
        if (!enemy) return
        api.fight(inv.seat, enemy.id, {
          assetId: source?.id,
          sourceCode: code,
          skill: 'agility',
          combatBonus: 1,
          damageBonus: 1,
        })
      },
    },
  ],
  modifiers: [],
}
