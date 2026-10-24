// Editable playlists and local-only custom audio. No user files are uploaded.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MUSIC_TRACKS, MUSIC_PLAYLISTS } from '../../web/music-player.js'

const DEFAULT_ROOT = fileURLToPath(new URL('../../web/audio/music/', import.meta.url))
const AUDIO = /\.(mp3|ogg|wav|m4a|aac|flac|webm)$/i
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key)
const defaults = () => ({ schemaVersion: 1, playlists: Object.fromEntries(Object.entries(MUSIC_PLAYLISTS).map(([id, tracks]) => [id, { tracks: [...tracks], includeCustom: true }])) })
export const defaultMusicConfig = defaults

export function createMusicLibrary({ root = DEFAULT_ROOT } = {}) {
  root = path.resolve(root)
  const builtins = new Map(MUSIC_TRACKS.map(t => [t.id, t]))
  const byFile = new Map(MUSIC_TRACKS.map(t => [t.file, t]))
  let lastGood = defaults()
  function readConfig(warnings) {
    const file = path.join(root, 'playlists.json')
    try {
      if (!fs.existsSync(file)) {
        fs.mkdirSync(root, { recursive: true })
        try { fs.writeFileSync(file, JSON.stringify(defaults(), null, 2) + '\n', { flag: 'wx' }) } catch (e) { if (e.code !== 'EEXIST') throw e }
      }
      const config = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
      if (config.schemaVersion !== 1 || !config.playlists || typeof config.playlists !== 'object' || Array.isArray(config.playlists)) throw new Error('格式无效')
      lastGood = config
    } catch {
      warnings.push('playlists.json 无法读取或格式有误，暂用上次有效配置；请修正后刷新歌单。')
    }
    return lastGood
  }
  function localTrack(file) {
    // Restrict lookup to the music tree, reject symlinks and traversal on both OSes.
    if (typeof file !== 'string' || !AUDIO.test(file) || /[\\\x00-\x1f:]/.test(file)) return null
    const parts = file.split('/')
    if (parts.some(p => !p || p === '.' || p === '..') || !['common', 'campaigns'].includes(parts[0])) return null
    const target = path.resolve(root, ...parts)
    if (!target.startsWith(root + path.sep)) return null
    let current = root
    try {
      for (const part of parts) {
        current = path.join(current, part)
        if (fs.lstatSync(current).isSymbolicLink()) return null
      }
      if (!fs.statSync(target).isFile()) return null
    } catch { return null }
    return { id: 'local:' + file, file, title: path.basename(file).replace(AUDIO, ''), mood: '玩家自定义音乐', custom: true }
  }
  function scan(folder) {
    const full = path.join(root, folder)
    try {
      // Avoid following even a symlinked campaign directory.
      let current = root
      for (const part of folder.split('/')) {
        current = path.join(current, part)
        if (fs.lstatSync(current).isSymbolicLink()) return []
      }
      return fs.readdirSync(full, { withFileTypes: true }).filter(e => e.isFile() && AUDIO.test(e.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }))
        .map(e => localTrack(folder + '/' + e.name)).filter(Boolean)
    } catch { return [] }
  }
  return function playlist(id = 'common') {
    if (!own(MUSIC_PLAYLISTS, id)) throw new RangeError('未知音乐歌单')
    const warnings = []
    const config = readConfig(warnings)
    const configured = own(config.playlists, id) ? config.playlists[id] : defaults().playlists[id]
    const valid = Array.isArray(configured) || (configured && Array.isArray(configured.tracks) && (configured.includeCustom === undefined || typeof configured.includeCustom === 'boolean'))
    const entry = valid ? configured : defaults().playlists[id]
    if (!valid) warnings.push('本关歌单格式有误，暂用默认歌单。')
    const ids = Array.isArray(entry) ? entry : entry.tracks
    const tracks = []
    const seen = new Set()
    const add = track => { if (track && !seen.has(track.file)) { seen.add(track.file); tracks.push(track) } }
    for (const ref of ids) {
      const track = typeof ref === 'string' && (builtins.get(ref) || byFile.get(ref) || localTrack(ref))
      if (track) add(track)
      else warnings.push('找不到音乐：' + String(ref).slice(0, 100))
    }
    if (Array.isArray(entry) || entry.includeCustom !== false) {
      const folder = id === 'common' ? 'common' : 'campaigns/' + id
      for (const track of scan(folder)) {
        // Built-in files in common are curated by config; only extra files auto-join.
        if (!byFile.has(track.file)) add(track)
      }
    }
    return { playlistId: id, tracks, warnings, configFile: 'audio/music/playlists.json', customDirectory: id === 'common' ? 'audio/music/common/' : 'audio/music/campaigns/' + id + '/' }
  }
}

const library = createMusicLibrary()
export function handleMusicLibrary({ method, path: route, searchParams }) {
  if (route !== 'music/playlist') return null
  if (!['GET', 'HEAD'].includes(method)) return { status: 405, error: '歌单接口只读，请编辑本地 playlists.json' }
  if (searchParams.getAll('id').length > 1) return { status: 400, error: '歌单参数重复' }
  try { return { body: library(searchParams.get('id') || 'common') } } catch (error) {
    if (error instanceof RangeError) return { status: 400, error: error.message }
    throw error
  }
}
