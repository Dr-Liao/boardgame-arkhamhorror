function records(campaign, key, create = false) {
  if (typeof key !== 'string' || !/^[a-zA-Z][\w-]*$/.test(key)) throw new TypeError('无效集合记录 id')
  if (campaign.records?.[key] != null && !Array.isArray(campaign.records[key])) throw new TypeError('记录不是集合')
  if (!create) return campaign.records?.[key] || []
  campaign.records ||= {}; return campaign.records[key] ||= []
}
function valueCheck(value) { if (typeof value !== 'string' || !value) throw new TypeError('集合记录值必须为非空字符串') }
export function recordSetValues(campaign, key) { return [...records(campaign, key)] }
export function recordSetAdd(campaign, key, value) {
  valueCheck(value); const values = records(campaign, key, true)
  if (values.includes(value)) return false
  values.push(value); return true
}
export function recordSetRemove(campaign, key, value) {
  valueCheck(value); const values = records(campaign, key), index = values.indexOf(value)
  if (index < 0) return false
  values.splice(index, 1); return true
}
export function claimRecordReward(campaign, id) { return recordSetAdd(campaign, 'claimedRecordRewards', id) }
