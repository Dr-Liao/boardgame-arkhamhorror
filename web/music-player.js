// One audio transport for the entire Mod, independent of table/hub re-renders.
import { SCENARIO_MUSIC, SCENARIO_PLAYLISTS } from './scenario-music.js'

export const MUSIC_TRACKS = [
  { id: 'darkestChild', title: 'Darkest Child', mood: '诡秘童谣 · 调查与探索', file: 'common/darkest-child.mp3', isrc: 'USUAN1100783' },
  { id: 'longNoteOne', title: 'Long note One', mood: '阴冷低鸣 · 阅读与沉思', file: 'common/long-note-one.mp3', isrc: 'USUAN1100418' },
  { id: 'unseenHorrors', title: 'Unseen Horrors', mood: '无形恐惧 · 危机与遭遇', file: 'common/unseen-horrors.mp3', isrc: 'USUAN1400043' },
  { id: 'ritual', title: 'Ritual', mood: '古老仪式 · 秘密与低语', file: 'common/ritual.mp3', isrc: 'USUAN1100466' },
  { id: 'gatheringDarkness', title: 'Gathering Darkness', mood: '暗潮聚集 · 神话与危机', file: 'common/gathering-darkness.mp3', isrc: 'USUAN1100849' },
  { id: 'theDread', title: 'The Dread', mood: '深处低鸣 · 悬疑与探索', file: 'common/the-dread.mp3', isrc: 'USUAN1100048' },
  { id: 'darkWalk', title: 'Dark Walk', mood: '夜行诡影 · 街巷与追踪', file: 'common/dark-walk.mp3', isrc: 'USUAN1100468' },
  { id: 'eveningOfChaos', title: 'Evening of Chaos', mood: '失谐钢琴 · 谢幕与幻觉', file: 'campaigns/thePathToCarcosa/evening-of-chaos.mp3', isrc: 'USUAN1300041' },
  { id: 'danseMacabre', title: 'Danse Macabre', mood: '怪诞舞曲 · 最后的王与晚宴', file: 'campaigns/thePathToCarcosa/danse-macabre.mp3', isrc: 'USUAN1100546' },
  { id: 'echoesOfTime', title: 'Echoes of Time', mood: '幽远钟声 · 往昔回响与档案调查', file: 'campaigns/thePathToCarcosa/echoes-of-time.mp3', isrc: 'USUAN1300029' },
  { id: 'longNoteTwo', title: 'Long Note Two', mood: '深沉低鸣 · 疗养院与漫长疑惧', file: 'campaigns/thePathToCarcosa/long-note-two.mp3', isrc: 'USUAN1100420' },
  { id: 'ghostProcessional', title: 'Ghost Processional', mood: '幽灵行进 · 巴黎追影与苍白面具', file: 'campaigns/thePathToCarcosa/ghost-processional.mp3', isrc: 'USUAN1100219' },
  { id: 'ossuarySixAir', title: 'Ossuary 6 - Air', mood: '异界暗潮 · 黑星升起与卡尔克萨', file: 'campaigns/thePathToCarcosa/ossuary-6-air.mp3', isrc: 'USUAN1500048' },
  { id: 'deadlyRoulette', title: 'Deadly Roulette', mood: '暗色爵士 · 赌场与黑帮疑云', file: 'common/deadly-roulette.mp3', isrc: 'USUAN1600033' },
  { id: 'dancesAndDames', title: 'Dances and Dames', mood: '黑色电影爵士 · 街巷调查与秘密交易', file: 'common/dances-and-dames.mp3', isrc: 'USUAN1100595' },
  { id: 'chasePulse', title: 'Chase Pulse', mood: '低音脉动 · 列车逃生与紧迫追踪', file: 'common/chase-pulse.mp3', isrc: 'USUAN1100383' },
  { id: 'shadowlandsAntechamber', title: 'Shadowlands 5 - Antechamber', mood: '异界悬疑 · 时空裂隙与未知门扉', file: 'common/shadowlands-5-antechamber.mp3', isrc: 'USUAN1700038' },
]
export const MUSIC_PLAYLISTS = Object.freeze({
  common: Object.freeze(MUSIC_TRACKS.filter(track => track.file.startsWith('common/')).map(track => track.id)),
  nightOfTheZealot: Object.freeze(['darkestChild','longNoteOne','unseenHorrors','ritual','gatheringDarkness','theDread','darkWalk']),
  thePathToCarcosa: Object.freeze(['eveningOfChaos','danseMacabre','echoesOfTime','longNoteTwo','ghostProcessional','ossuarySixAir']),
  theDunwichLegacy: Object.freeze([...new Set(Object.values(SCENARIO_MUSIC.theDunwichLegacy).flatMap(chapter => chapter.tracks))]),
  ...SCENARIO_PLAYLISTS,
})
export function musicTracksForPlaylist(id) {
  const ids = MUSIC_PLAYLISTS[id] || MUSIC_PLAYLISTS.common
  return ids.map(trackId => MUSIC_TRACKS.find(track => track.id === trackId)).filter(Boolean)
}
const KEY = 'arkham-music-v1'
const clock = seconds => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '0:00'

export function createMusicPlayer(h) {
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {} } catch {}
  let playlistId = 'common', playlist = musicTracksForPlaylist(playlistId)
  let index = Number.isInteger(saved.index) && playlist[saved.index] ? saved.index : 0
  let loopOne = saved.loopOne === true
  let active = false, expanded = false, error = '', pending = false, generation = 0
  let waitingGesture = false
  const audio = new Audio()
  audio.preload = 'none'
  audio.volume = Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : .3
  audio.muted = saved.muted === true
  audio.loop = loopOne
  const save = () => {
    saved = { index, playlistId, trackId: playlist[index]?.id, loopOne, volume: audio.volume, muted: audio.muted }
    try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch {}
  }
  const button = (label, text, onclick, extra = {}) => h('button', { type: 'button', 'aria-label': label, title: label, onclick, ...extra }, text)
  const title = h('strong')
  const status = h('small')
  const launcher = button('展开音乐播放器', '', () => { expanded = !expanded; update() }, { className: 'ah-music-launcher', 'aria-controls': 'ah-music-panel' })
  launcher.append(h('span', { className: 'ah-music-note', 'aria-hidden': 'true' }, '♫'), h('span', {}, title, status))
  const miniPlay = button('播放音乐', '▶', toggle, { className: 'ah-music-mini' })
  const heading = h('strong', {}, '诡镇留声机')
  const now = h('strong', { className: 'ah-music-now' })
  const mood = h('span', { className: 'ah-music-mood' })
  const play = button('播放音乐', '▶', toggle, { className: 'ah-music-play' })
  const repeat = button('列表循环', '↻ 列表', () => { loopOne = !loopOne; audio.loop = loopOne; save(); update() })
  const seek = h('input', { type: 'range', min: 0, max: 100, step: .1, value: 0, 'aria-label': '音乐进度', oninput: () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value) / 100 * audio.duration; updateTime() } })
  const time = h('span', { className: 'ah-music-time' })
  const mute = button('静音音乐', '♪', () => { audio.muted = !audio.muted; save(); update() })
  const volume = h('input', { type: 'range', min: 0, max: 100, step: 1, value: audio.volume * 100, 'aria-label': '音乐音量', oninput: () => { audio.volume = Number(volume.value) / 100; audio.muted = false; save(); update() } })
  const volumeText = h('span')
  const feedback = h('p', { className: 'ah-music-feedback', role: 'status' })
  let trackButtons = []
  const trackList = h('div', { className: 'ah-music-tracks' })
  function rebuildTracks() {
    trackButtons = playlist.map((track, n) => button(`播放 ${track.title}`, '', () => select(n, true), { className: 'ah-music-track' }))
    trackButtons.forEach((el, n) => el.append(h('span', { className: 'ah-music-number' }, String(n + 1).padStart(2, '0')), h('span', {}, h('strong', {}, playlist[n].title), h('small', {}, playlist[n].mood))))
    trackList.replaceChildren(...trackButtons)
  }
  rebuildTracks()
  const link = (text, href) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text)
  const panel = h('section', { id: 'ah-music-panel', className: 'ah-music-panel', 'aria-label': '音乐播放器' },
    h('header', {}, heading, button('收起音乐播放器', '×', () => { expanded = false; update(); launcher.focus() })),
    h('div', { className: 'ah-music-record', 'aria-hidden': 'true' }, h('span', {}, 'AH')),
    now, mood,
    h('div', { className: 'ah-music-controls' }, button('上一首', '❮', () => select(index - 1, true)), play, button('下一首', '❯', () => select(index + 1, true)), repeat),
    seek, time,
    h('div', { className: 'ah-music-volume' }, mute, volume, volumeText),
    feedback, trackList,
    h('footer', {}, '音乐：', link('Kevin MacLeod', 'https://incompetech.com/'), ' · ', link('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'), h('br'), '原始录音，未作修改 · ', link('来源与署名', '/mods/arkhamhorror/audio/music/CREDITS.txt')))
  const root = h('aside', { className: 'ah-music', 'aria-label': '诡镇背景音乐', onkeydown: e => { if (e.key === 'Escape' && expanded) { e.stopPropagation(); expanded = false; update(); launcher.focus() } } }, panel, h('div', { className: 'ah-music-dock' }, launcher, miniPlay))

  function updateTime() {
    const duration = audio.duration
    seek.disabled = !Number.isFinite(duration) || duration <= 0
    if (document.activeElement !== seek) seek.value = duration > 0 ? audio.currentTime / duration * 100 : 0
    time.textContent = `${clock(audio.currentTime)} / ${clock(duration)}`
    seek.setAttribute('aria-valuetext', time.textContent)
  }
  function update() {
    const track = playlist[index]
    const playing = !audio.paused && !error
    root.classList.toggle('is-playing', playing)
    panel.hidden = !expanded
    launcher.setAttribute('aria-expanded', String(expanded))
    launcher.setAttribute('aria-label', expanded ? '收起音乐播放器' : '展开音乐播放器')
    title.textContent = track.title
    status.textContent = error ? '播放失败 · 点击重试' : pending ? '正在载入…' : playing ? '正在播放' : waitingGesture ? '点击后自动播放' : '音乐已暂停'
    now.textContent = track.title; mood.textContent = track.mood
    for (const control of [play, miniPlay]) {
      control.textContent = playing || pending ? 'Ⅱ' : '▶'
      control.setAttribute('aria-label', playing || pending ? '暂停音乐' : '播放音乐')
      control.title = control.getAttribute('aria-label')
    }
    repeat.textContent = loopOne ? '↻ 单曲' : '↻ 列表'
    repeat.setAttribute('aria-label', loopOne ? '单曲循环' : '列表循环')
    repeat.setAttribute('aria-pressed', String(loopOne))
    mute.textContent = audio.muted || audio.volume === 0 ? '♪ ×' : '♪'
    mute.setAttribute('aria-label', audio.muted ? '取消音乐静音' : '静音音乐')
    mute.setAttribute('aria-pressed', String(audio.muted))
    volumeText.textContent = `${Math.round(audio.volume * 100)}%`
    feedback.textContent = error
    feedback.hidden = !error
    trackButtons.forEach((el, n) => el.setAttribute('aria-current', String(n === index)))
    updateTime()
  }
  function source() { return '/mods/arkhamhorror/audio/music/' + playlist[index].file }
  function waitForGesture(enabled) {
    waitingGesture = enabled
    for (const event of ['click', 'keydown']) {
      document.removeEventListener(event, unlock)
      if (enabled) document.addEventListener(event, unlock)
    }
  }
  function unlock(event) {
    if (!event.isTrusted || !active || !waitingGesture || pending) return
    if (event.type === 'keydown' && (event.repeat || ['Shift', 'Control', 'Alt', 'Meta', 'Escape'].includes(event.key))) return
    start()
  }
  async function start() {
    if (!active) return
    const ticket = ++generation
    waitForGesture(false)
    error = ''; pending = true
    if (!audio.getAttribute('src') || audio.error) { audio.src = source(); audio.load() }
    update()
    try { await audio.play() } catch (err) {
      if (ticket === generation && active) {
        if (err.name === 'NotAllowedError') waitForGesture(true)
        else if (err.name !== 'AbortError') error = '音乐暂时无法播放，请点击播放重试。'
      }
    } finally { if (ticket === generation) { pending = false; update() } }
  }
  function pause() { generation++; pending = false; waitForGesture(false); audio.pause(); update() }
  function toggle() { if (error) start(); else if (!audio.paused || pending) pause(); else start() }
  function select(n, autoplay) {
    pause(); index = (n + playlist.length) % playlist.length
    error = ''; audio.src = source(); audio.load(); save(); update()
    if (autoplay) start()
  }
  audio.addEventListener('ended', () => { if (active && !loopOne) select(index + 1, true) })
  audio.addEventListener('error', () => { pending = false; error = '音乐载入失败，请检查连接后重试。'; update() })
  for (const event of ['play', 'pause', 'loadedmetadata', 'durationchange', 'volumechange']) audio.addEventListener(event, update)
  audio.addEventListener('timeupdate', updateTime)
  window.addEventListener('pagehide', pause)
  update()
  return {
    render(enabled, nextPlaylistId = playlistId) {
      nextPlaylistId = MUSIC_PLAYLISTS[nextPlaylistId] ? nextPlaylistId : 'common'
      let resumeAfterSwitch = false
      if (nextPlaylistId !== playlistId) {
        const wasActive = active
        resumeAfterSwitch = wasActive && (!audio.paused || pending || waitingGesture)
        if (wasActive) pause()
        playlistId = MUSIC_PLAYLISTS[nextPlaylistId] ? nextPlaylistId : 'common'
        playlist = musicTracksForPlaylist(playlistId)
        // A new chapter starts with its curated opening track; reloads restore
        // the selected track only in the same playlist (including old saves).
        index = !saved.playlistId || saved.playlistId === playlistId
          ? Math.max(0, playlist.findIndex(track => track.id === saved.trackId)) : 0
        audio.removeAttribute('src'); error = ''; rebuildTracks(); update()
      }
      const entering = enabled && !active
      if (!enabled && active) { pause(); expanded = false; update() }
      active = enabled
      // Only start on entry. Table/hub updates must not undo a manual pause.
      if (entering || (enabled && resumeAfterSwitch)) start()
      return enabled ? root : null
    },
  }
}
