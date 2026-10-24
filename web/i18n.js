// 诡镇奇谈 Mod 侧界面词典（docs/localization.md §8.2/§8.3）。
//
// 语言包随 Mod 发布在 web/locales/ 下，由本文件静态 import（体积很小，不增加网络往返）。
// 缺失 key 的回退顺序：resolved → 游戏 defaultLocale（zh-CN，即源文案）→ key。
// 与大厅 public/i18n.js 使用同一套扁平 key 与 {name} 插值规则，不引入格式化库。
import zhCN from './locales/zh-CN.js'
import en from './locales/en.js'

export const DEFAULT_LOCALE = 'zh-CN'
export const SUPPORTED_LOCALES = ['zh-CN', 'en']
const PACKS = { 'zh-CN': zhCN, en }

/** 大厅 locale → 本 Mod 支持的语言；其它语言按 defaultLocale 处理（zh-CN）。 */
export function normalizeLocale(value) {
  const tag = String(value ?? '').trim().replace(/_/g, '-').toLowerCase()
  return tag === 'en' || tag.startsWith('en-') ? 'en' : DEFAULT_LOCALE
}

let locale = DEFAULT_LOCALE

/** 切换界面词典（大厅 onLocaleChange 调用）；返回规范化后的 locale。 */
export function setLocale(value) {
  locale = normalizeLocale(value)
  return locale
}

export function getLocale() {
  return locale
}

/** 取当前语言文案；缺失时回退 zh-CN 的源文案，再缺失返回 key（主路径不允许出现裸 key）。 */
export function t(key, vars) {
  const current = Object.hasOwn(PACKS, locale) ? PACKS[locale] : null
  const source = PACKS[DEFAULT_LOCALE]
  const value = current && typeof current[key] === 'string' && current[key] ? current[key]
    : typeof source[key] === 'string' && source[key] ? source[key] : ''
  if (!value) return key
  if (!vars) return value
  return value.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(vars, name) ? String(vars[name]) : match)
}
