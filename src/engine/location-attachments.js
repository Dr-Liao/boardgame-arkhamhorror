// 地点附属（location.attachments）与玩家卡的地点附属（state.playerLocationAttachments）
// 的唯一写入口。
//
// 两套存储的语义不同：
//   · `scope: 'location'`：剧本/遭遇卡附属到地点（疯狂生长、屋中无人、幽魂缠身……），
//     读点是 scenario/content 的 `location.attachments`（引擎按 code/originalCode 找）。
//   · `scope: 'player'`：玩家卡作为地点附属（隐藏处、伏击、陷阱、捷径），
//     读点是 `state.playerLocationAttachments`（act-agenda.js / shortcutMove）。
//
// 卡文件只经 api.attachToLocation 调用；本模块不写日志（文案由调用方保留，避免重放指纹漂移）。

export function attachLocationCard(state, locationId, fields = {}) {
  const location = (state.locations || []).find(item => item.id === locationId)
  if (!location) return null
  const code = fields.originalCode || fields.code
  if (fields.scope === 'player') {
    state.playerLocationAttachments ||= []
    const attachment = {
      code: fields.code, location: locationId,
      ownerSeat: fields.ownerSeat ?? state.currentSeat ?? 0, exhausted: false,
      ...(fields.extra || {}),
    }
    state.playerLocationAttachments.push(attachment)
    return attachment
  }
  // 剧本附属：同一地点可有多张；`dedupe` 用于卡面写明「每个地点仅限 1 张」的卡。
  if (fields.dedupe && (location.attachments || []).some(item => (item.originalCode || item.code) === code)) {
    return (location.attachments || []).find(item => (item.originalCode || item.code) === code) || null
  }
  location.attachments ||= []
  // 不自动加 round/序号字段：附属对象的形状属于存档指纹，调用方沿用卡面原有 id 才能保持重放一致。
  const attachment = {
    id: fields.id || `attach:${fields.code}:${location.attachments.length}`,
    code: fields.code,
    originalCode: fields.originalCode || fields.code,
    ...(fields.extra || {}),
  }
  location.attachments.push(attachment)
  return attachment
}

// 地点帷幕的通用临时修正（可叠加；撤销时反向调用）。唯一实现：
// api-misc 的 setShroudMod 与 scenarioRuntime 的 setShroudMod 都走这里。
export function setLocationShroudMod(location, amount) {
  if (!location || !Number.isFinite(amount)) return location || null
  location.shroudMod = (location.shroudMod || 0) + amount
  return location
}

// 地点附属上的数值效果合计（例如 04145 屋中无人的「调查额外 +1 行动」）。
// 读点与字段同名，卡文件只写附属 data，不再往地点实例上累加计数。
export function locationAttachmentTotal(location, key) {
  return (location?.attachments || []).reduce((sum, entry) => sum + Number(entry?.[key] || 0), 0)
}

// 「附属到你所在地点，帷幕 +N」的雾/阴影类诡计（01168 朦胧之雾）：同一地点可叠加。
// 读点：actions.js / harm-threat.js 调查后清理 fog；shroud 计算读 location.shroudMod。
// 旧 DSL 的 `attachShroud` 是「每地点仅 1 张」的另一套语义，保留在 reveal.js，不合并。
export function addLocationShroud(state, locationId, amount = 2, code = null) {
  const location = (state.locations || []).find(item => item.id === locationId)
  if (!location) return 0
  location.shroudMod = (location.shroudMod || 0) + Number(amount || 0)
  location.fog = (location.fog || 0) + 1
  if (code) location.fogCode = location.fogCode || code
  return location.fog
}
