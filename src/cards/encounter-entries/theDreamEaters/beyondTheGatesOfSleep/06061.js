// 06061 远古祖格鼠（Ancient Zoog）
// 归属：关卡专用 · theDreamEaters/beyondTheGatesOfSleep（P8-1 w-p8-a）。
// 卡面：生成 - 任一「魔幻森林」地点（若可能，优先未揭示的）。冷漠。
//   强制 - 敌军阶段开始时，若远古祖格鼠处于重整状态：为场上每个带蜂拥 X 的[[祖格鼠]]敌人各加 1 张蜂拥卡。
// 数值/冷漠由 definition 印刷数据提供。生成地点由章节 behavior.spawnLocation 读
//   entryFlags('06061').spawnAtEnchantedWoods 决定（引擎没有「生成在任一某名地点」的通用选择器）。
// 「加蜂拥卡」走 api.swarm.place（P3 原语），从遭遇牌库顶抽卡；牌库空时不放置（避免原语抛错）。
import { ALL_CARDS, originalOf } from '../../_shared.js'

const CODE = '06061'

function hasZoogTrait(enemy) {
  return (ALL_CARDS[originalOf(enemy)]?.traits || enemy.traits || [])
    .some(trait => String(trait).toLowerCase() === 'zoog')
}

// 蜂拥规格来自 definition（card-data 的 swarming 解析结果）；回落到卡文正则。
function swarmingCountOfEnemy(state, enemy) {
  const code = originalOf(enemy)
  const spec = state?.scenario?.enemies?.[code]?.swarming || null
  if (!spec) return 0
  const per = spec.perInvestigator ? Math.max(1, Number(state.numInvestigators) || 1) : 1
  const fixed = Number(spec.value ?? 0)
  if (Number.isFinite(fixed) && fixed > 0) return fixed * per
  return 0
}

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  flags: {
    spawnAtEnchantedWoods: true,
  },
  enemyScript: {
    onEnemyPhaseStart(state, enemy, api) {
      if (String(originalOf(enemy)) !== CODE || enemy.exhausted) return
      const candidates = (state.enemies || []).filter(entry => entry !== enemy && hasZoogTrait(entry)
        && api.swarm?.countOf?.(entry) >= 0 && swarmingCountOfEnemy(state, entry) > 0)
      if (!candidates.length) return
      if (!(state.encounterDeck || []).length) {
        api.info?.('🐀 遭遇牌库已空：远古祖格鼠无法补充蜂拥卡。')
        return
      }
      for (const zoog of candidates) {
        api.swarm?.place?.(zoog, 1, { source: CODE })
        api.info?.(`🐀 远古祖格鼠为「${zoog.name || originalOf(zoog)}」加 1 张蜂拥卡。`)
      }
    },
  },
}
