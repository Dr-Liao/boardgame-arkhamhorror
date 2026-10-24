// 诡镇卡图候选解析（浏览器与 Node 共用；无 DOM、无网络请求）。
//
// 服务端下发的描述符只包含有序候选路径、语言标记与候选来源；主机由本地设置决定，
// 可以留空表示纯文字模式。候选代表「可以拼出的地址」，不代表远程图片已存在或可达，
// 因此加载结果必须由调用方的 load/error 记录，并通过缓存避免重复渲染时无限重试。
import { t } from './i18n.js'

// 公开目录是 https://drliao1.com/arkhamhorror/cards/01001.avif ；中文在 zh/，卡背在 backs/。
export const DEFAULT_IMAGE_HOST = 'https://drliao1.com/arkhamhorror/cards'

/** 主机已经以 /cards 结尾，清单里的 cards/ 目录不再重复。本地缓存路径保持原样。 */
export function remoteImagePath(relative) {
  return String(relative).replace(/(^|\/)cards\//, '$1')
}
// 本地图库由本 Mod 自带，经大厅挂载在 /mods/<id>/ 下；不占用大厅 public/ 的命名空间。
export const LOCAL_ROOT = '/mods/arkhamhorror/img'
export const LOCALIZED_PREFIX = 'zh' // 参考项目的中文图片目录是 /zh/，不是 /zh-cn/
const MAX_CANDIDATES = 8
const ART_PATTERN = /^[0-9]{3,6}[a-z]{0,2}$/

/** 只接受 http(s) 主机；空字符串表示禁用远程图片。非法输入抛出 RangeError，不静默回退。 */
export function normalizeImageHost(value) {
  if (value == null || String(value).trim() === '') return ''
  const raw = String(value).trim()
  let url
  try { url = new URL(raw) } catch { throw new RangeError(t('misc.imageHost.invalid')) }
  if (!['http:', 'https:'].includes(url.protocol)) throw new RangeError(t('misc.imageHost.protocol'))
  if (url.username || url.password || url.search || url.hash) throw new RangeError(t('misc.imageHost.credentials'))
  return (url.origin + url.pathname).replace(/\/+$/, '')
}

function artCandidate(art) {
  const value = String(art || '').trim().toLowerCase()
  return ART_PATTERN.test(value) ? { path: `cards/${value}.avif`, art: value, localized: false, source: 'explicit-art' } : null
}

/**
 * 按展示面生成有序候选。
 * @param descriptor 服务端 images 描述符
 * @param options.side 'front' | 'back'
 * @param options.host 归一化后的主机；留空表示不请求远程，仅使用本地图库（都没有则回退文字）
 * @param options.language 'zh-cn' | 'zh' | 'en'
 * @param options.artId 实例显式指定的美术编号（可选，格式非法则忽略而不猜配）
 * @param options.variant 替代美术偏好（如 'revised'）；该面没有声明变体时保持原画，不推断
 */
export function imageCandidates(descriptor, { side = 'front', host = DEFAULT_IMAGE_HOST, language = 'zh-cn', artId = null, variant = '' } = {}) {
  const base = normalizeImageHost(host)
  if (!descriptor) return []
  const face = descriptor[side === 'back' ? 'back' : 'front']
  if (!face || !Array.isArray(face.candidates)) return []
  const explicit = side === 'front' ? artCandidate(artId) : null
  const preferred = variant && face.variants ? face.variants[variant] : null
  const wantsLocalized = language === 'zh-cn' || language === 'zh'
  const candidates = []
  const seen = new Set()
  const cacheThroughServer = base === DEFAULT_IMAGE_HOST
  const add = candidate => {
    if (!candidate || seen.has(candidate.url)) return
    seen.add(candidate.url)
    candidates.push(candidate)
  }
  for (const candidate of [...(explicit ? [explicit] : []), ...(preferred ? [preferred] : []), ...face.candidates]) {
    if (typeof candidate?.path !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9/_.-]*\.[A-Za-z0-9]+$/.test(candidate.path) || candidate.path.includes('..')) continue
    const generic = face.kind === 'generic-back' || candidate.source === 'generic-back'
    // 同源路径始终先尝试，使之前按需缓存但未写入发布清单的图片也能离线复用。
    // 使用默认 CDN 时加 cache=cdn：文件缺失才由大厅下载到同一路径；已存在则直接静态返回。
    if (wantsLocalized && (candidate.localized || candidate.localLocalized)) {
      const localUrl = `${LOCAL_ROOT}/${LOCALIZED_PREFIX}/${candidate.path}` + (cacheThroughServer ? '?cache=cdn' : '')
      add({ url: localUrl, language: 'zh', origin: 'local', path: candidate.path, source: candidate.source })
      if (base) add({ url: `${base}/${remoteImagePath(`${LOCALIZED_PREFIX}/${candidate.path}`)}`, language: 'zh', origin: 'remote', path: candidate.path, source: candidate.source })
    }
    const localUrl = `${LOCAL_ROOT}/${candidate.path}` + (cacheThroughServer ? '?cache=cdn' : '')
    add({ url: localUrl, language: generic ? 'back' : 'en', origin: 'local', path: candidate.path, source: candidate.source })
    if (base) add({ url: `${base}/${remoteImagePath(candidate.path)}`, language: generic ? 'back' : 'en', origin: 'remote', path: candidate.path, source: candidate.source })
    if (candidates.length >= MAX_CANDIDATES) break
  }
  return candidates.slice(0, MAX_CANDIDATES)
}

/**
 * 跨渲染共享的加载结果缓存：键为完整 URL（已含主机、语言与展示面），
 * 因此更换主机或语言会重新尝试，而同一地址失败后不会在每次界面重绘时重试。
 */
export function createImageCache({ limit = 4000 } = {}) {
  const results = new Map()
  const remember = (url, ok) => {
    if (typeof url !== 'string') return
    results.delete(url)
    results.set(url, ok)
    if (results.size > limit) results.delete(results.keys().next().value)
  }
  return {
    fail(url) { remember(url, false) },
    succeed(url) { remember(url, true) },
    state(url) { return results.has(url) ? (results.get(url) ? 'displayable' : 'failed') : 'unknown' },
    /** 优先已成功过的候选，其次未尝试过的候选；全部失败返回 null，由调用方回退到文字。 */
    next(candidates) {
      const usable = (candidates || []).filter(candidate => results.get(candidate.url) !== false)
      return usable.find(candidate => results.get(candidate.url) === true) || usable[0] || null
    },
    clear() { results.clear() },
  }
}
