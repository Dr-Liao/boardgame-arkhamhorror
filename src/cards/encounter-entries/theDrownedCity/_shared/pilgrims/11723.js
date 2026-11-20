// 11723 朝圣者侍僧（Pilgrim Acolyte）· 敌人 · 共享遭遇组 pilgrims（印刷 3 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/pilgrims。
// 卡面（cards-data 11723）：
//   强制 - 朝圣者侍僧攻击后：在其上放置1个毁灭标记。
//
// 读点（声明即接线）：
//   · 战斗/躲避/生命/伤害/恐惧 = cards-data；
//   · 「攻击后」= enemyAttacked 窗口（enemies.js#enemyAttack 唯一派发点，context 带 enemy/seat/
//     attack/cancelled），非玩家条目的 forced 描述子由 triggerReaction 的 openAbilityWindow 派发；
//   · 放毁灭 = api.doomOn（placeDoomOnCard 的唯一包装，敌人实例同样适用）。
const CODE = '11723'

export default {
  code: CODE,
  name: '朝圣者侍僧',
  scope: 'enemy',
  implemented: true,
  flags: {
    traits: ['Humanoid', 'Cultist'],
    quantity: 3,
    fight: 2,
    evade: 2,
    health: 2,
    damage: 1,
    horror: 0,
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyAttacked',
    silent: true,
    label: '朝圣者侍僧攻击后：在其上放置 1 个毁灭标记',
    criteria: ({ source, context }) => Boolean(source?.id) && context?.enemy?.id === source.id
      && context?.attack?.cancelled !== true,
    resolve: ({ source, api }) => {
      api.doomOn?.(source, 1)
      api.info?.(`🕯️ 「朝圣者侍僧」攻击后，在自身上放置 1 个毁灭标记（当前 ${source.doom || 0}）。`)
    },
  }],
  note: '「攻击后放毁灭」走 enemyAttacked 窗口（敌人攻击结算后触发；被取消的攻击不触发），'
    + '伤害/恐惧/数值全部来自 cards-data，条目只声明强制能力。',
}
