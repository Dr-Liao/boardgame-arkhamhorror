// 07253 奥赛罗思·马什（Oceiros Marsh）· 敌人（精英）· TIC 第六章《雾中之光》
//
// 印刷（中文）：
//   猎手。反击。
//   奥赛罗思·马什的地点淹没时，其得到+2躲避。
//   强制 - 成功躲避奥赛罗思·马什后：你检定成功且每超过难度1点，控制他的1个钥匙。
//   强制 - 奥赛罗思·马什在敌军阶段期间攻击你后：你被俘虏了。将你的所有钥匙放在奥赛罗思·马什上。
//
// 印刷（English）：
//   Hunter. Retaliate.
//   Oceiros Marsh gets +2 evade while his location is flooded.
//   Forced - After Oceiros Marsh is successfully evaded: For each point you succeeded by, take
//   control of 1 key on him.
//   Forced - After Oceiros Marsh attacks you during the enemy phase: You are captured. Place each
//   of your keys on Oceiros Marsh.
//
// 模板位置（一卡一文件）：
//   src/cards/encounter-entries/theInnsmouthConspiracy/aLightInTheFog/07253.js
//
// 引擎读点：
//   · 猎手/反击：卡面数据（cards-data 的 hunter/retaliate）由 spawnEnemy 复制到实例，
//     引擎在敌人阶段 / 借机攻击处读取；条目重复声明任何内容。
//   · 「地点淹没时 +2 躲避」= modifiers 行 target:'enemyEvade'，读点 modifiers.js#entityModifierTotal
//     → enemies.js#enemyEvadeValue（唯一躲避值读点）；「淹没」= flood.js#floodLevel ≥ 1
//     （部分或完全淹没都算，参考实现 atFlooded）。
//   · 「成功躲避后按成功点数夺钥匙」= forced + trigger 'evadeSuccess'（combat.js 开窗，context 带
//     seat/successBy）；钥匙读写走 api.keys.at / api.keys.transfer（scenario-keys.js 唯一写入口）。
//   · 「敌军阶段攻击后俘获」= forced + trigger 'enemyAttacked'（enemies.js#enemyAttack 开窗，
//     context 带 seat/enemy/attack）；只认 state.phase === 'enemy' 且攻击未被取消；
//     俘获走 api.scenario.capture(seat, { keysTo: `enemy:<马什 id>` })（capture.js 唯一写入口，
//     先转移钥匙再写被俘状态，与印刷「你被俘；把钥匙放在马什上」一致）。
//
// implemented: true

import { floodLevel } from '../../_shared.js'

const MARSH = '07253'
const KEY_NAMES = Object.freeze({ red: '红色', yellow: '黄色', green: '绿色', blue: '蓝色',
  purple: '紫色', white: '白色', black: '黑色' })

// 印刷「其地点淹没时」：floodLevel ≥ 1（部分淹没或完全淹没）。
const flooded = ({ state, entity }) => {
  const locationId = entity?.location
  if (locationId == null) return false
  if (!(state.locations || []).some(location => location.id === locationId)) return false
  return floodLevel(state, locationId) >= 1
}

export default {
  code: MARSH, scope: 'enemy', implemented: true,
  modifiers: [{
    target: 'enemyEvade',
    amount: ({ state, entity }) => (flooded({ state, entity }) ? 2 : 0),
  }],
  abilities: [{
    kind: 'forced', trigger: 'evadeSuccess',
    label: '成功躲避马什后：每超过难度 1 点，控制他 1 把钥匙',
    criteria: ({ source, context }) => context?.enemy?.id === source.id && Number(context?.successBy) > 0,
    resolve: ({ state, source, context, api }) => {
      const seat = context?.seat
      if (!Number.isSafeInteger(seat) || !state.investigators?.[seat]) return
      const holder = `enemy:${source.id}`
      let colors = api.keys.at(holder, { reveal: true })
      const wanted = Math.max(0, Math.floor(Number(context.successBy) || 0))
      for (let index = 0; index < wanted && colors.length; index++) {
        const color = colors.length === 1 ? colors[0] : (() => {
          const answer = api.choice({
            kind: 'effect', source: `${MARSH}:evade`, seat,
            prompt: `控制马什身上的一把钥匙（还可控制 ${wanted - index} 把）。`,
            options: colors.map(value => ({ id: value, label: KEY_NAMES[value] || value })),
          })
          return colors.includes(answer) ? answer : colors[0]
        })()
        if (!api.keys.transfer(color, holder, `investigator:${seat}`, { reveal: true })) break
        api.info?.(`🔑 ${state.investigators[seat].name} 从奥赛罗思·马什身上控制了${KEY_NAMES[color] || color}钥匙。`)
        colors = colors.filter(value => value !== color)
      }
    },
  }, {
    kind: 'forced', trigger: 'enemyAttacked',
    label: '敌军阶段攻击后：你被俘，你的所有钥匙放到马什上',
    criteria: ({ state, source, context }) => context?.enemy?.id === source.id
      && state.phase === 'enemy'
      && context?.attackCancelled !== true
      && Number.isSafeInteger(context?.seat)
      && !state.investigators?.[context.seat]?.defeated
      && !state.investigators?.[context.seat]?.resigned,
    resolve: ({ state, source, context, api }) => {
      const seat = context.seat
      if (!api.scenario.capture(seat, { source: MARSH, keysTo: `enemy:${source.id}` })) return
      api.info?.(`⛓️ 「奥赛罗思·马什」的攻击得手：${state.investigators[seat]?.name || '调查员'} 被俘，钥匙留在马什身上。`)
    },
  }],
}
