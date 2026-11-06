// 本地卡组库的浏览器端接口：与对局存档分离，只经本机大厅读写。
// 列表中的每副牌组附带服务端生成的 description（与 ArkhamDB 导入同构），
// 载入时交给 planArkhamDbImport 预检。

const ROOT = '/mods/arkhamhorror/decks'

export const codesToSlots = codes => codes.reduce((slots, code) => ({ ...slots, [code]: (slots[code] || 0) + 1 }), {})

export const slotsToCodes = slots => Object.entries(slots && typeof slots === 'object' ? slots : {})
  .flatMap(([code, count]) => Array.from({ length: Math.max(0, Number(count) || 0) }, () => code))

export async function listLocalDecks(api) {
  return (await api('GET', ROOT)).decks
}

export async function saveLocalDeck(api, { id, name, investigatorCode, codes, slots, arkhamdbId, arkhamdbKind }) {
  const body = {
    name,
    investigator_code: investigatorCode,
    slots: slots && typeof slots === 'object' && !Array.isArray(slots) ? slots : codesToSlots(codes || []),
    ...(arkhamdbId ? { arkhamdbId, ...(arkhamdbKind ? { arkhamdbKind } : {}) } : {}),
  }
  return (await (id ? api('PUT', `${ROOT}/${encodeURIComponent(id)}`, body) : api('POST', ROOT, body))).deck
}

export async function deleteLocalDeck(api, id) {
  await api('DELETE', `${ROOT}/${encodeURIComponent(id)}`)
}

export async function batchDeleteLocalDecks(api, ids) {
  return await api('POST', `${ROOT}/batch-delete`, { ids })
}

export function formatDeckLibraryJson(deck) {
  return JSON.stringify({
    name: deck?.name || '',
    investigator_code: deck?.investigator_code || deck?.description?.investigatorCode || '',
    slots: deck?.slots || {},
    ...(deck?.arkhamdbId ? { id: Number(deck.arkhamdbId) || deck.arkhamdbId } : {}),
  }, null, 2)
}
