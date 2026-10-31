// 06058 纳什特（Nasht · 梦境门外的守门祭司）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：冷漠。反击。[action] 谈判：检定战斗或敏捷(2)（本次检定每有 1 名调查员难度 +1）以证明你有资格
//   进入幻梦境。成功则翻面并结算其另一面；失败则纳什特攻击他所在地点的每位调查员。
//   强制 - 击败纳什特后：翻面并结算其另一面。
// 「另一面」= 背面故事卡 06058b（Lead 口径：不建条目，规则在本条目的谈判/击败分支里；故事面用
//   api.cardFlip('06058') 展示，scenarioFlags.trialOfNashtResolved 记录）。
// 读点：enemyScript.encounterAction / performEncounterAction / onDefeated（共享层分派）。
import { activeInvestigators } from '../../_shared.js'

const CODE = '06058'

function perInvestigatorDifficulty(state) {
  return 2 + Math.max(1, Number(state.numInvestigators) || 1)
}

function resolveTrial(state, enemy, api, via) {
  api.cardFlip?.(CODE, '纳什特的考验')
  api.setScenarioFlag?.('trialOfNashtResolved', true)
  api.banish?.(enemy)
  api.info?.(via === 'parley'
    ? '🕯️ 纳什特认可了你的求生意志：他让开道路，并预言你的旅途将通向死亡。'
    : '🕯️ 纳什特被击败：他教会你不要相信自己的眼睛。')
}

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  enemyScript: {
    encounterAction(state, inv, enemy) {
      if (!inv || inv.location !== enemy.location) return null
      return {
        action: 'encounterAction',
        rule: 'parleyNasht',
        enemyId: enemy.id,
        actions: 1,
        label: `🕯️ 谈判「纳什特」：检定战斗或敏捷(${perInvestigatorDifficulty(state)})证明你配得上进入幻梦境`,
      }
    },
    performEncounterAction(state, inv, enemy, move, api) {
      if (!move || move.rule !== 'parleyNasht') return false
      const difficulty = perInvestigatorDifficulty(state)
      const answer = api.choice?.({
        kind: 'skill', source: CODE, seat: inv.seat,
        prompt: '选择检定技能（战斗或敏捷）。',
        options: [{ id: 'combat', label: `战斗(${difficulty})` }, { id: 'agility', label: `敏捷(${difficulty})` }],
      })
      const skill = answer === 'combat' ? 'combat' : 'agility'
      api.test?.(inv.seat, skill, difficulty, result => {
        if (result.success) {
          resolveTrial(state, enemy, api, 'parley')
          return
        }
        api.info?.('🕯️ 谈判失败：纳什特攻击他所在地点的每位调查员。')
        for (const other of activeInvestigators(state).filter(entry => entry.location === enemy.location)) {
          api.attack?.(enemy, other)
        }
      })
      return true
    },
    onDefeated(state, enemy, api) {
      resolveTrial(state, enemy, api, 'defeated')
      return false
    },
  },
}
