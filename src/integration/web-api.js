// 诡镇奇谈 Mod 的只读图鉴接口（由大厅经 /api/mods/arkhamhorror/* 派发）。
//
// 大厅只负责路由、版本化缓存与错误归一化；本文件决定「下发什么」：
//   - 只下发白名单投影后的静态卡牌资料，不含 provenance／原始记录；
//   - 不触碰对局状态，也不放宽构筑／选人的可用性校验；
//   - 资源版本覆盖目录数据与展示层实现，保证浏览器不会用到陈旧缓存。

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { queryCatalogView, getCatalogCardView, getLinkedCatalogCardView, getCatalogMeta } from '../cards/card-catalog.js'
import { META } from '../cards/cards-data.js'
import { fetchArkhamDbDeck, resolveArkhamDbDeck } from './arkhamdb.js'

const FILTER_KEYS = Object.freeze(['q', 'code', 'name', 'type', 'klass', 'packCode', 'cost', 'xp', 'campaign', 'sort', 'effectStatus', 'availability', 'offset', 'limit'])
// 资源版本纳入的文件：目录数据、规则差异、展示解析与浏览器展示代码。
const VERSIONED_FILES = Object.freeze([
  '../cards/cards-data.js', '../cards/scenarios-data.js', '../cards/card-effects.js', '../cards/card-catalog.js',
  './image-cache.js',
  '../../presentation/art-rules.js', '../../presentation/images.js',
  '../../presentation/localized-arts.json', '../../presentation/media-registry.json',
  '../../web/images.js', '../../web/catalog.js', '../../web/card-filters.js', '../../web/game-ui.js', '../../web/hub.js', '../../web/deck-rules.js', '../../web/arkhamdb-import.js', '../../web/hub-office.css',
  '../../web/card-text.js', '../../web/story-reader.js', '../../web/rulebook-data.js', '../../web/rulebook.js', '../../web/style.css',
  '../campaign/story.js', '../../content/campaigns/theDunwichLegacy/story-text.js',
  '../../content/campaigns/thePathToCarcosa/story-text.js',
])

let versionPromise
export function resourceVersion() {
  if (!versionPromise) versionPromise = (async () => {
    const hash = createHash('sha256').update(JSON.stringify(META))
    for (const relative of VERSIONED_FILES) {
      hash.update(relative).update(await readFile(new URL(relative, import.meta.url)))
    }
    return hash.digest('hex')
  })().catch(error => { versionPromise = undefined; throw error })
  return versionPromise
}

let metaCache
function catalogMeta() {
  if (!metaCache) metaCache = getCatalogMeta()
  return metaCache
}

function filterOptions(searchParams) {
  const options = {}
  for (const key of FILTER_KEYS) {
    const values = searchParams.getAll(key)
    if (values.length > 1) throw new RangeError('重复的目录筛选参数：' + key)
    if (!values.length) continue
    if (key === 'offset' || key === 'limit') {
      if (!/^\d+$/.test(values[0]) || !Number.isSafeInteger(Number(values[0]))) throw new RangeError('目录分页范围无效')
      options[key] = Number(values[0])
    } else {
      if (values[0].length > 256) throw new RangeError('目录筛选参数过长')
      options[key] = values[0].trim()
    }
  }
  return options
}

/** @returns {{ body?: object, status?: number, error?: string } | null} null 表示路径不存在。 */
export function handleApi({ path, searchParams }) {
  if (path === 'catalog/meta') return { body: catalogMeta() }
  if (path === 'catalog') return { body: queryCatalogView(filterOptions(searchParams)) }
  // ArkhamDB 导入：只读代理公开牌组并规范化卡号，不触碰对局状态；
  // 实际构筑仍须经 hubSetDeck 的服务端校验。
  if (path === 'arkhamdb/resolve') return resolveArkhamDbDeck(searchParams)
  if (path.startsWith('arkhamdb/')) {
    const [kind, id, ...extra] = path.slice('arkhamdb/'.length).split('/')
    if (extra.length) return null
    return fetchArkhamDbDeck(kind, id)
  }
  if (path.startsWith('cards/')) {
    const code = path.slice('cards/'.length)
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(code)) return { status: 400, error: '无效卡牌编号' }
    const card = getCatalogCardView(code)
    if (!card) return { status: 404, error: '卡牌不存在' }
    const linkedCard = getLinkedCatalogCardView(code)
    return { body: { card, ...(linkedCard ? { linkedCard } : {}) } }
  }
  return null
}
