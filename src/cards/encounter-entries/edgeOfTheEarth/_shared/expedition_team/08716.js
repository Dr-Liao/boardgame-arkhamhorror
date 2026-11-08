// 08716 伊里亚·阿什瓦克（Eliyah Ashevak） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(3秘密)。[action]花费 1 秘密并横置：躲避。以基础值为 5 的[agility]尝试躲避。成功后可移动到连接地点。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

import { ALL_CARDS } from '../../../_shared.js'

const CODE = '08716'

export default {
  code: CODE, scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { action: 'evadeBase5ThenMayMove' } },
  uses: 3, usesType: 'secrets',
  abilities: [{
    kind: 'action', actionKind: 'evade', label: '花费 1 秘密并横置：以基础值 5 的敏捷躲避，成功后移动到连接地点',
    cost: { action: 1, exhaust: true, uses: 1 },
    resolve: ({ state, inv, api }) => {
      const enemies = state.enemies.filter(enemy => !enemy.defeated && enemy.location === inv.location)
      if (!enemies.length) {
        api.info('「伊里亚·阿什瓦克」：所在地点没有可躲避的敌人。')
        return
      }
      const target = enemies.length === 1 ? enemies[0] : enemies.find(enemy => enemy.id === api.choice({
        kind: 'enemy', source: CODE, seat: inv.seat, prompt: '选择要躲避的敌人。',
        options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name || enemy.id })),
      })) || enemies[0]
      const difficulty = Number(target.evade ?? 0)
      api.test(inv.seat, 'agility', difficulty, {
        baseValue: 5,
        source: { type: 'asset', code: CODE, name: ALL_CARDS[CODE]?.nameZh || CODE, ability: true },
        resolve: result => {
          if (!result.success) return
          // 自动躲避走能力 API 的 autoEvade（api-misc.js；与引擎 eote 的 evadeEnemy 场景原语同义）。
          api.autoEvade(target)
          // 成功后可移动到连接地点。原实现引用了作用域外的 `here`，成功路径必抛
          // ReferenceError（P0-7），这里按调查员当前地点现算。
          const here = state.locations.find(loc => loc.id === inv.location)
          const destinations = (here?.connections || []).filter(id => state.locations.some(loc => loc.id === id))
          if (!destinations.length) return
          const pick = api.choice({ kind: 'effect', source: CODE, seat: inv.seat,
            prompt: '躲避成功：是否移动到一个连接地点？',
            options: [{ id: 'skip', label: '不移动' }, ...destinations.map(id => ({ id, label: state.locations.find(loc => loc.id === id)?.name || id }))] })
          if (destinations.includes(pick)) api.moveInvestigator(inv.seat, pick)
        },
      })
    },
  }],
}


