// 诡镇奇谈：卡牌版（Arkham Horror LCG）· 引擎输出使用的展示常量
//
// 本文件只保留技能名、职阶名/颜色/emoji 和混乱标记显示；不包含规则判定。
//
// 版权声明：文本与设定版权归 Fantasy Flight Games，本插件为粉丝项目。

// ---------------------------------------------------------------------------
// 技能
// ---------------------------------------------------------------------------

export const SKILLS = ['willpower', 'intellect', 'combat', 'agility']

export const SKILL_NAMES = {
  willpower: '意志',
  intellect: '智识',
  combat: '战斗',
  agility: '敏捷',
}

// ---------------------------------------------------------------------------
// 职阶（faction，键为小写，与 cards-data.js 的 klass 一致）
// ---------------------------------------------------------------------------

export const CLASS_NAMES = {
  guardian: '守卫者',
  seeker: '探求者',
  mystic: '秘术师',
  rogue: '游荡者',
  survivor: '幸存者',
  neutral: '中立',
  mythos: '神话',
}

export const CLASS_EMOJI = {
  guardian: '🛡️',
  seeker: '📖',
  mystic: '🔮',
  rogue: '🗡️',
  survivor: '🪶',
  neutral: '⚪',
  mythos: '👁️',
}

export const CLASS_COLOR = {
  guardian: '#3b82f6',
  seeker: '#f59e0b',
  mystic: '#8b5cf6',
  rogue: '#10b981',
  survivor: '#ef4444',
  neutral: '#9ca3af',
  mythos: '#6b21a8',
}

// ---------------------------------------------------------------------------
// 混乱标记显示（数字标记 + 特殊符号）
// ---------------------------------------------------------------------------

export const TOKEN_LABEL = {
  '+1': '+1',
  '0': '0',
  '-1': '-1',
  '-2': '-2',
  '-3': '-3',
  '-4': '-4',
  '-5': '-5',
  '-6': '-6',
  '-8': '-8',
  skull: '💀',
  cultist: '🕯️',
  tablet: '🗿',
  elderthing: '👁️',
  autofail: '☠️ 自动失败',
  eldersign: '✨',
}
