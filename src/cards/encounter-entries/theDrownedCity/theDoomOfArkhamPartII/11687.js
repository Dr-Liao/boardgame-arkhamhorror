// 11687 约翰·雷蒙德·勒格拉斯 · 追寻答案 · 盟友剧情资产（阿卡姆的毁灭 第一/二部分共用）。
// 归属：战役内跨章节共用 · theDrownedCity/theDoomOfArkhamPartII（Lead 的归属算法把同一战役
//       多章共用的 11687 落在 Part II 目录；Part I 只引用同一卡号）。
// 卡面：你攻击[[深潜者]]和[[星之眷族]]敌人时，技能值 +1。
//       [reaction] 你在攻击或躲避克苏鲁期间进行技能检定时，横置约翰·雷蒙德·勒格拉斯：
//       本次检定技能值 +X，其中 X 为克苏鲁的狂怒值。
// 印刷：盟友 / 生命 3 / [[Ally]][[Detective]]。
// 读点（声明即接线）：
//   · 被动 +1 = modifiers 的 testValue（tests.js#370 的 continuousTestValue 连续检定修正），
//     condition 读 state.skillTest 限制「攻击动作 + 目标敌人带 Deep One / Star Spawn 特性」；
//   · 反应 = abilities 的 testBegins + cost exhaust + api.addTestValue（api-test.js#77），
//     condition 读 state.skillTest 限制「攻击或躲避 + 目标是[[克苏鲁]]敌人」，
//     X 读章节内容状态 state.scenarioFlags.cthulhuRage（本卡只在 Doom of Arkham 两章使用）。
// Setup 读点：章节 behavior.afterDeckSetup 以 api.giveAsset 入场并豁免盟友槽。
const CODE = '11687'
const CTHULHU_ENEMY_CODES = ['11702', '11702b', '11703', '11703b', '11704', '11704b']
const traitOf = (enemy, name) => (enemy?.traits || []).some(trait => String(trait).toLowerCase() === name.toLowerCase())
const enemyOf = (state, id) => (state?.enemies || []).find(enemy => enemy.id === id) || null
const myTest = (state, inv) => {
  const test = state?.skillTest
  return test && test.seat === inv?.seat ? test : null
}

export default {
  code: CODE,
  name: '约翰·雷蒙德·勒格拉斯',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyAlly: true, allySlotExempt: true },
  modifiers: [{
    target: 'testValue',
    amount: 1,
    condition: {
      when: ({ state, inv }) => {
        const test = myTest(state, inv)
        if (!test || test.actionKind !== 'fight' || test.target?.kind !== 'enemy') return false
        const enemy = enemyOf(state, test.target.id)
        return Boolean(enemy) && (traitOf(enemy, 'Deep One') || traitOf(enemy, 'Star Spawn'))
      },
    },
  }],
  abilities: [{
    kind: 'reaction',
    trigger: 'testBegins',
    label: '横置：攻击或躲避[[克苏鲁]]敌人期间，本次检定技能值 +X（X = 克苏鲁的狂怒值）',
    cost: { exhaust: true },
    criteria: [({ state, inv }) => {
      const test = myTest(state, inv)
      if (!test || !['fight', 'evade'].includes(test.actionKind) || test.target?.kind !== 'enemy') return false
      const enemy = enemyOf(state, test.target.id)
      return Boolean(enemy) && CTHULHU_ENEMY_CODES.includes(String(enemy.originalCode || enemy.code))
    }],
    resolve: ({ state, inv, api }) => {
      const rage = Math.max(0, Number(state?.scenarioFlags?.cthulhuRage) || 0)
      if (!rage) {
        api.info?.('约翰·雷蒙德·勒格拉斯：克苏鲁的狂怒值为 0，本次不增加技能值。')
        return
      }
      api.addTestValue?.(rage)
      api.info?.(`${inv.name} 横置约翰·雷蒙德·勒格拉斯：本次检定技能值 +${rage}（克苏鲁的狂怒值）。`)
    },
  }],
  note: '被动 +1（攻击[[深潜者]]/[[星之眷族]]）走 testValue 修正；反应走 testBegins + api.addTestValue。'
    + '克苏鲁的狂怒值读章节内容状态 scenarioFlags.cthulhuRage（本卡只在 Doom of Arkham 使用）。',
}
