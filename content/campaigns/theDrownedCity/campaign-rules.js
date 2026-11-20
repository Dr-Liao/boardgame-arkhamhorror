// 《沉没之城》战役级规则读点（P7 第三轮）。
// Good Money（11611）playBothSides 失败：下一章维护阶段不能获得资源。
// 该限制由 campaignRuleFlag 效果写成跨章标记，各章 behavior.canGainResources 统一读这里
// （phases.js 补给阶段：scenarioBehavior(state).canGainResources?.(state, inv) === false 时跳过获得资源）。
export const TDC_NO_UPKEEP_RESOURCES = 'tdcNoUpkeepResources'

export function tdcCannotGainUpkeepResources(state, inv) {
  const flag = state?.campaign?.ruleFlags?.[TDC_NO_UPKEEP_RESOURCES]
  if (!flag) return false
  const scenarioIndex = state?.campaign?.scenarioIndex
  if (Number.isInteger(flag?.appliesToScenarioIndex)
    && Number.isInteger(scenarioIndex) && scenarioIndex !== flag.appliesToScenarioIndex) return false
  if (Array.isArray(flag?.seats) && flag.seats.length && !flag.seats.includes(inv?.seat)) return false
  return true
}
