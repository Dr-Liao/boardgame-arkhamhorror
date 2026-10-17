// 本地卡组库的浏览器端接口：与对局存档分离，只经本机大厅读写。
// 列表中的每副牌组附带服务端生成的 description（与 ArkhamDB 导入同构），
// 载入时交给 planArkhamDbImport 预检。

const ROOT = '/mods/arkhamhorror/decks'

export const codesToSlots = codes => codes.reduce((slots, code) => ({ ...slots, [code]: (slots[code] || 0) + 1 }), {})

export async function listLocalDecks(api) {
  return (await api('GET', ROOT)).decks
}

export async function saveLocalDeck(api, { id, name, investigatorCode, codes }) {
  const body = { name, investigator_code: investigatorCode, slots: codesToSlots(codes) }
  return (await (id ? api('PUT', `${ROOT}/${encodeURIComponent(id)}`, body) : api('POST', ROOT, body))).deck
}

export async function deleteLocalDeck(api, id) {
  await api('DELETE', `${ROOT}/${encodeURIComponent(id)}`)
}
