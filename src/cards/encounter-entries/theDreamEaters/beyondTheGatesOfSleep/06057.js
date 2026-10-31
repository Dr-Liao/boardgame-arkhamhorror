// 06057 卡曼塔（Kaman-Thah · 梦境门外的守门祭司）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：冷漠。反击。[action] 谈判：检定意志或智识(2)（本次检定每有 1 名调查员难度 +1）以证明你有资格
//   进入幻梦境。成功则翻面并结算其另一面；失败则卡曼塔攻击他所在地点的每位调查员。
//   强制 - 击败卡曼塔后：翻面并结算其另一面。
// 「另一面」= 背面故事卡 06057b（Lead 口径：不建条目，规则在本条目的谈判/击败分支里，结算时用
//   api.cardFlip('06057') 展示背面正文；故事卡「加入胜利区」在引擎里没有独立实体现，用
//   scenarioFlags.trialOfKamanThahResolved + 敌人离场近似，0 胜利点故 XP 不受影响）。
// 读点：enemyScript.encounterAction / performEncounterAction（共享 encounter-rules.js 的
//   encounterActions / performEncounterAction 分派）、enemyScript.onDefeated（共享 enemyDefeated 分派）。
import { activeInvestigators } from '../../_shared.js'

const CODE = '06057'

function perInvestigatorDifficulty(state) {
  return 2 + Math.max(1, Number(state.numInvestigators) || 1)
}

// 谈判成功或击败后结算故事面：翻面展示背面正文，敌人离场。
function resolveTrial(state, enemy, api, via) {
  api.cardFlip?.(CODE, '卡曼塔的考验')
  api.setScenarioFlag?.('trialOfKamanThahResolved', true)
  api.banish?.(enemy)
  api.info?.(via === 'parley'
    ? '🕯️ 卡曼塔认可了你的意志：他让开道路，幻梦境向你敞开。'
    : '🕯️ 卡曼塔被击败：他让你通过，并警告你并非所有问题都能用暴力解决。')
}

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  // 数值/关键词（Aloof、Retaliate）由 definition 的印刷数据提供，条目只写行为。
  enemyScript: {
    // [action] 谈判（卡面是敌人身上的行动，走 encounterAction / performEncounterAction 通道）。
    encounterAction(state, inv, enemy) {
      if (!inv || inv.location !== enemy.location) return null
      return {
        action: 'encounterAction',
        rule: 'parleyKamanThah',
        enemyId: enemy.id,
        actions: 1,
        label: `🕯️ 谈判「卡曼塔」：检定意志或智识(${perInvestigatorDifficulty(state)})证明你配得上进入幻梦境`,
      }
    },
    performEncounterAction(state, inv, enemy, move, api) {
      if (!move || move.rule !== 'parleyKamanThah') return false
      const difficulty = perInvestigatorDifficulty(state)
      const answer = api.choice?.({
        kind: 'skill', source: CODE, seat: inv.seat,
        prompt: '选择检定技能（意志或智识）。',
        options: [{ id: 'willpower', label: `意志(${difficulty})` }, { id: 'intellect', label: `智识(${difficulty})` }],
      })
      const skill = answer === 'willpower' ? 'willpower' : 'intellect'
      api.test?.(inv.seat, skill, difficulty, result => {
        if (result.success) {
          resolveTrial(state, enemy, api, 'parley')
          return
        }
        api.info?.('🕯️ 谈判失败：卡曼塔攻击他所在地点的每位调查员。')
        for (const other of activeInvestigators(state).filter(entry => entry.location === enemy.location)) {
          api.attack?.(enemy, other)
        }
      })
      return true
    },
    // 强制 - 击败后：翻面结算故事面（引擎先移出敌人，再派发本钩子；返回 false 让引擎走常规收尾）。
    onDefeated(state, enemy, api) {
      resolveTrial(state, enemy, api, 'defeated')
      return false
    },
  },
}
