export const DIFFICULTIES = [
  { value: 'easy', label: '简单' },
  { value: 'standard', label: '标准' },
  { value: 'hard', label: '困难' },
  { value: 'expert', label: '专家' },
]

// ---------------------------------------------------------------------------
// 混乱袋（4 难度，战役级；来源 cycles/nightOfTheZealot.json chaosTokens）
// ---------------------------------------------------------------------------

export const CHAOS_BAGS = {
  easy: ['+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2', 'skull', 'skull', 'cultist', 'tablet', 'autofail', 'eldersign'],
  standard: ['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'cultist', 'tablet', 'autofail', 'eldersign'],
  hard: ['0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5', 'skull', 'skull', 'cultist', 'tablet', 'autofail', 'eldersign'],
  expert: ['0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8', 'skull', 'skull', 'cultist', 'tablet', 'autofail', 'eldersign'],
}

// 兜底：若剧本未定义某符号含义，用此静态修正。
export const SYMBOL_DEFAULTS = {
  skull: -1,
  cultist: -2,
  tablet: -3,
  elderthing: -3,
}
