// 战役记录的展示值。规则把被献祭的角色、遇害的贵宾等保存为卡号；界面只负责把
// 卡号翻成卡名，未知编号保持原样。卡名映射由服务端按当前记录投影到
// `state.campaign.recordCardNames`，前端不另存卡表。
// 文案走 web/i18n.js（zh-CN 逐字保持原样）；分隔符也随语言变化，英文用逗号。
import { t } from './i18n.js'

export function recordValueText(value, names = {}) {
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no')
  if (Array.isArray(value)) return value.length ? value.map(item => recordValueText(item, names)).join(t('hub.list.separator')) : t('hub.records.none')
  if (value == null) return ''
  if (typeof value === 'string') return names[value] || value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function recordChangeText(before, after, names = {}) {
  const text = value => value == null ? t('hub.records.notRecorded') : recordValueText(value, names)
  return `${text(before)} → ${text(after)}`
}
