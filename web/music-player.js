// One audio transport for the entire Mod, independent of table/hub re-renders.
import { SCENARIO_MUSIC, SCENARIO_PLAYLISTS } from './scenario-music.js'
import { subscribeLocaleChange, t } from './i18n.js'

export const MUSIC_TRACKS = [
  { id: 'tcuVanishing', title: "Vanishing", mood: "庄园晚宴、失踪者、暮色疑云", file: 'common/vanishing.mp3', isrc: 'USUAN1600050' },
  { id: 'tcuEveningFallPiano', title: "Evening Fall (Piano)", mood: "庄园晚宴、失踪者、暮色疑云", file: 'common/evening-fall-piano.mp3', isrc: 'USUAN1100235' },
  { id: 'tcuThisHouse', title: "This House", mood: "庄园晚宴、失踪者、暮色疑云", file: 'common/this-house.mp3', isrc: 'USUAN1500055' },
  { id: 'tcuBabaYaga', title: "Baba Yaga", mood: "林间迷途、女巫集会、命运占卜", file: 'common/baba-yaga.mp3', isrc: 'USUAN1500079' },
  { id: 'tcuMystOnTheMoor', title: "Myst on the Moor", mood: "林间迷途、女巫集会、命运占卜", file: 'common/myst-on-the-moor.mp3', isrc: 'USUAN1600007' },
  { id: 'tcuSpellbound', title: "Spellbound", mood: "林间迷途、女巫集会、命运占卜", file: 'common/spellbound.mp3', isrc: 'USUAN1500061' },
  { id: 'tcuScpX5xOuterThoughts', title: "SCP-x5x (Outer Thoughts)", mood: "幽灵庄园、现实翻面、看守人追猎", file: 'common/scp-x5x-outer-thoughts.mp3', isrc: 'USUAN2000011' },
  { id: 'tcuOssuary4Animate', title: "Ossuary 4 - Animate", mood: "幽灵庄园、现实翻面、看守人追猎", file: 'common/ossuary-4-animate.mp3', isrc: 'USUAN1500046' },
  { id: 'tcuPhantasm', title: "Phantasm", mood: "幽灵庄园、现实翻面、看守人追猎", file: 'common/phantasm.mp3', isrc: 'USUAN1100113' },
  { id: 'tcuMetaphysik', title: "Metaphysik", mood: "女巫旧屋、异次元走廊、黑书秘密", file: 'common/metaphysik.mp3', isrc: 'USUAN1400056' },
  { id: 'tcuCrypto', title: "Crypto", mood: "女巫旧屋、异次元走廊、黑书秘密", file: 'common/crypto.mp3', isrc: 'USUAN1600013' },
  { id: 'tcuInnerSanctum', title: "Inner Sanctum", mood: "女巫旧屋、异次元走廊、黑书秘密", file: 'common/inner-sanctum.mp3', isrc: 'USUAN1100196' },
  { id: 'tcuOssuary5Rest', title: "Ossuary 5 - Rest", mood: "绞刑山墓地、异端幽魂、未了之事", file: 'common/ossuary-5-rest.mp3', isrc: 'USUAN1500047' },
  { id: 'tcuAnguish', title: "Anguish", mood: "绞刑山墓地、异端幽魂、未了之事", file: 'common/anguish.mp3', isrc: 'USUAN1400047' },
  { id: 'tcuLandOfTheDead', title: "Land of the Dead", mood: "绞刑山墓地、异端幽魂、未了之事", file: 'common/land-of-the-dead.mp3', isrc: 'USUAN1100179' },
  { id: 'tcuHiddenPast', title: "Hidden Past", mood: "秘社调查、机关钥匙、内殿阴谋", file: 'common/hidden-past.mp3', isrc: 'USUAN1600030' },
  { id: 'tcuHiddenWonders', title: "Hidden Wonders", mood: "秘社调查、机关钥匙、内殿阴谋", file: 'common/hidden-wonders.mp3', isrc: 'USUAN1700006' },
  { id: 'tcuMysticForce', title: "Mystic Force", mood: "秘社调查、机关钥匙、内殿阴谋", file: 'common/mystic-force.mp3', isrc: 'USUAN1500060' },
  { id: 'tcuShadowlands1Horizon', title: "Shadowlands 1 - Horizon", mood: "荒岛火盆、阵法仪式、阵营对峙", file: 'common/shadowlands-1-horizon.mp3', isrc: 'USUAN1700034' },
  { id: 'tcuShadowlands2Bridge', title: "Shadowlands 2 - Bridge", mood: "荒岛火盆、阵法仪式、阵营对峙", file: 'common/shadowlands-2-bridge.mp3', isrc: 'USUAN1700035' },
  { id: 'tcuFinalBattleOfTheDarkWizards', title: "Final Battle of the Dark Wizards", mood: "荒岛火盆、阵法仪式、阵营对峙", file: 'common/final-battle-of-the-dark-wizards.mp3', isrc: 'USUAN1500085' },
  { id: 'tcuTheEscalation', title: "The Escalation", mood: "阿卡姆裂口、连锁入侵、危机升级", file: 'common/the-escalation.mp3', isrc: 'USUAN1400041' },
  { id: 'tcuDarkling', title: "Darkling", mood: "阿卡姆裂口、连锁入侵、危机升级", file: 'common/darkling.mp3', isrc: 'USUAN1700050' },
  { id: 'tcuVolatileReaction', title: "Volatile Reaction", mood: "阿卡姆裂口、连锁入侵、危机升级", file: 'common/volatile-reaction.mp3', isrc: 'USUAN1400039' },
  { id: 'tcuOssuary3Words', title: "Ossuary 3 - Words", mood: "宇宙漂流、虚空吞噬、终末倒计时", file: 'common/ossuary-3-words.mp3', isrc: 'USUAN1500045' },
  { id: 'tcuSymmetry', title: "Symmetry", mood: "宇宙漂流、虚空吞噬、终末倒计时", file: 'common/symmetry.mp3', isrc: 'USUAN1900006' },
  { id: 'tcuShadowlands6ThePit', title: "Shadowlands 6 - The Pit", mood: "宇宙漂流、虚空吞噬、终末倒计时", file: 'common/shadowlands-6-the-pit.mp3', isrc: 'USUAN1700039' },
  { id: 'darkestChild', title: 'Darkest Child', mood: '诡秘的童谣，伴你四处调查', file: 'common/darkest-child.mp3', isrc: 'USUAN1100783' },
  { id: 'longNoteOne', title: 'Long note One', mood: '阴冷的长音，适合静静读故事', file: 'common/long-note-one.mp3', isrc: 'USUAN1100418' },
  { id: 'unseenHorrors', title: 'Unseen Horrors', mood: '看不见的恐惧正在逼近', file: 'common/unseen-horrors.mp3', isrc: 'USUAN1400043' },
  { id: 'ritual', title: 'Ritual', mood: '古老仪式里的低语', file: 'common/ritual.mp3', isrc: 'USUAN1100466' },
  { id: 'gatheringDarkness', title: 'Gathering Darkness', mood: '黑暗正在聚集', file: 'common/gathering-darkness.mp3', isrc: 'USUAN1100849' },
  { id: 'theDread', title: 'The Dread', mood: '从深处传来的低鸣', file: 'common/the-dread.mp3', isrc: 'USUAN1100048' },
  { id: 'darkWalk', title: 'Dark Walk', mood: '深夜穿行在街巷里', file: 'common/dark-walk.mp3', isrc: 'USUAN1100468' },
  { id: 'eveningOfChaos', title: 'Evening of Chaos', mood: '走调的钢琴，大幕将落', file: 'common/evening-of-chaos.mp3', isrc: 'USUAN1300041' },
  { id: 'danseMacabre', title: 'Danse Macabre', mood: '怪诞的舞曲，国王的晚宴', file: 'common/danse-macabre.mp3', isrc: 'USUAN1100546' },
  { id: 'echoesOfTime', title: 'Echoes of Time', mood: '远处的钟声，翻查旧档案', file: 'common/echoes-of-time.mp3', isrc: 'USUAN1300029' },
  { id: 'longNoteTwo', title: 'Long Note Two', mood: '漫长的低音，疗养院里的不安', file: 'common/long-note-two.mp3', isrc: 'USUAN1100420' },
  { id: 'ghostProcessional', title: 'Ghost Processional', mood: '幽灵在巴黎街头游行', file: 'common/ghost-processional.mp3', isrc: 'USUAN1100219' },
  { id: 'ossuarySixAir', title: 'Ossuary 6 - Air', mood: '黑星升起，异界涌动', file: 'common/ossuary-6-air.mp3', isrc: 'USUAN1500048' },
  { id: 'deadlyRoulette', title: 'Deadly Roulette', mood: '暗色爵士，赌场里的黑帮', file: 'common/deadly-roulette.mp3', isrc: 'USUAN1600033' },
  { id: 'dancesAndDames', title: 'Dances and Dames', mood: '黑色电影风格的爵士', file: 'common/dances-and-dames.mp3', isrc: 'USUAN1100595' },
  { id: 'chasePulse', title: 'Chase Pulse', mood: '急促的低音，逃离列车', file: 'common/chase-pulse.mp3', isrc: 'USUAN1100383' },
  { id: 'shadowlandsAntechamber', title: 'Shadowlands 5 - Antechamber', mood: '时空裂隙后的未知之门', file: 'common/shadowlands-5-antechamber.mp3', isrc: 'USUAN1700038' },
  { id: 'comePlayWithMe', title: 'Come Play with Me', mood: '童谣回荡在空荡的房间', file: 'common/come-play-with-me.mp3', isrc: 'USUAN1400042' },
  { id: 'iKnewAGuy', title: 'I Knew a Guy', mood: '深夜俱乐部里的低沉爵士', file: 'common/i-knew-a-guy.mp3', isrc: 'USUAN1100199' },
  { id: 'onTheGround', title: 'On the Ground', mood: '调查街巷时的黑色电影节拍', file: 'common/on-the-ground.mp3', isrc: 'USUAN1400030' },
  { id: 'decay', title: 'Decay', mood: '尘封档案中的不祥回声', file: 'common/decay.mp3', isrc: 'USUAN1100512' },
  { id: 'lightlessDawn', title: 'Lightless Dawn', mood: '黎明前仍未散去的阴影', file: 'common/lightless-dawn.mp3', isrc: 'USUAN1100655' },
  { id: 'rightBehindYou', title: 'Right Behind You', mood: '走廊尽头似乎有人跟随', file: 'common/right-behind-you.mp3', isrc: 'USUAN1100713' },
  { id: 'longNoteThree', title: 'Long Note Three', mood: '地下石室里的漫长低鸣', file: 'common/long-note-three.mp3', isrc: 'USUAN1100424' },
  { id: 'nightBreak', title: 'Night Break', mood: '急速崩塌中的脉冲声', file: 'common/night-break.mp3', isrc: 'USUAN1100380' },
  { id: 'theVoices', title: 'The Voices', mood: '林中仪式旁的非人低语', file: 'common/the-voices.mp3', isrc: 'USUAN1100046' },
  { id: 'shadowlandsSevenCodex', title: 'Shadowlands 7 - Codex', mood: '异界密文与失控的时空', file: 'common/shadowlands-7-codex.mp3', isrc: 'USUAN1700040' },
  { id: 'shadowlandsFourBreath', title: 'Shadowlands 4 - Breath', mood: '看不见的存在正在呼吸', file: 'common/shadowlands-4-breath.mp3', isrc: 'USUAN1700037' },
  { id: 'wretchedDestroyer', title: 'Wretched Destroyer', mood: '灾厄疾驰而来', file: 'common/wretched-destroyer.mp3', isrc: 'USUAN1700041' },
  { id: 'ossuaryOneBeginning', title: 'Ossuary 1 - A Beginning', mood: '华丽晚宴下的细微裂痕', file: 'common/ossuary-1-a-beginning.mp3', isrc: 'USUAN1500043' },
  { id: 'ossuarySevenResolve', title: 'Ossuary 7 - Resolve', mood: '异界尽头的悬而未决', file: 'common/ossuary-7-resolve.mp3', isrc: 'USUAN1500049' },
  { id: 'ossuaryTwoTurn', title: 'Ossuary 2 - Turn', mood: '祭坛和墓室里逐渐逼近的恐惧', file: 'common/ossuary-2-turn.mp3', isrc: 'USUAN1500044' },
  { id: 'magicForest', title: 'Magic Forest', mood: '丛林里似有目光追随', file: 'common/magic-forest.mp3', isrc: 'USUAN1600044' },
  { id: 'shamanistic', title: 'Shamanistic', mood: '雨林深处的鼓点与低语', file: 'common/shamanistic.mp3', isrc: 'USUAN1100353' },
  { id: 'invariance', title: 'Invariance', mood: '神庙机关逐渐加速', file: 'common/invariance.mp3', isrc: 'USUAN1100847' },
  { id: 'ancientRite', title: 'Ancient Rite', mood: '沉重的古代仪式', file: 'common/ancient-rite.mp3', isrc: 'USUAN1900048' },
  { id: 'rites', title: 'Rites', mood: '洞窟里的古老圣歌', file: 'common/rites.mp3', isrc: 'USUAN1100722' },
  { id: 'lostFrontier', title: 'Lost Frontier', mood: '迷雾中的失落边界', file: 'common/lost-frontier.mp3', isrc: 'USUAN1300039' },
  { id: 'gloomHorizon', title: 'Gloom Horizon', mood: '线索背后的阴影', file: 'common/gloom-horizon.mp3', isrc: 'USUAN1100813' },
  { id: 'enterTheMaze', title: 'Enter the Maze', mood: '陷阱和迷宫步步紧逼', file: 'common/enter-the-maze.mp3', isrc: 'USUAN1100782' },
  { id: 'penumbra', title: 'Penumbra', mood: '城市调查中的不安', file: 'common/penumbra.mp3', isrc: 'USUAN1200105' },
  { id: 'staticMotion', title: 'Static Motion', mood: '时空交错的异样节拍', file: 'common/static-motion.mp3', isrc: 'USUAN1200062' },
  { id: 'controlledChaos', title: 'Controlled Chaos', mood: '深渊中的危机加速', file: 'common/controlled-chaos.mp3', isrc: 'USUAN1200059' },
  { id: 'orion300xb', title: 'Orion 300XB', mood: '陌生文明发出的讯号', file: 'common/orion-300xb.mp3', isrc: 'USUAN1100697' },
  { id: 'digitalBark', title: 'Digital Bark', mood: '异星档案的电子噪声', file: 'common/digital-bark.mp3', isrc: 'USUAN1100260' },
  { id: 'itIsLost', title: 'It is Lost', mood: '时间尽头残存的希望', file: 'common/it-is-lost.mp3', isrc: 'USUAN1100190' },
  { id: 'interloper', title: 'Interloper', mood: '危机渐强，步步紧逼', file: 'common/interloper.mp3', isrc: 'USUAN1100401' },
  { id: 'truthInTheStones', title: 'Truth in the Stones', mood: '石刻中留下的古老真相', file: 'common/truth-in-the-stones.mp3', isrc: 'USUAN1700059' },
  { id: 'thunderDreams', title: 'Thunder Dreams', mood: '破碎纪元前的最后宁静', file: 'common/thunder-dreams.mp3', isrc: 'USUAN1200063' },
]
export const MUSIC_PLAYLISTS = Object.freeze({
  common: Object.freeze(MUSIC_TRACKS.filter(track => track.file.startsWith('common/')).map(track => track.id)),
  nightOfTheZealot: Object.freeze([...new Set(Object.values(SCENARIO_MUSIC.nightOfTheZealot).flatMap(chapter => chapter.tracks))]),
  thePathToCarcosa: Object.freeze([...new Set(Object.values(SCENARIO_MUSIC.thePathToCarcosa).flatMap(chapter => chapter.tracks))]),
  theDunwichLegacy: Object.freeze([...new Set(Object.values(SCENARIO_MUSIC.theDunwichLegacy).flatMap(chapter => chapter.tracks))]),
  theForgottenAge: Object.freeze([...new Set(Object.values(SCENARIO_MUSIC.theForgottenAge).flatMap(chapter => chapter.tracks))]),
  theCircleUndone: Object.freeze([...new Set(Object.values(SCENARIO_MUSIC.theCircleUndone).flatMap(chapter => chapter.tracks))]),
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
  // error / configWarningKey 存的是词典 key（不是成品文案），切换语言时仍然能重新翻译。
  let active = false, expanded = false, error = '', pending = false, generation = 0
  let waitingGesture = false
  let refreshTicket = 0, configWarning = '', configWarningKey = '', lastRequestedPlaylist = null, refreshAutoplay = false
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
  const launcher = button(t('music.launcher.expand'), '', () => { expanded = !expanded; update(); if (expanded) refreshPlaylist() }, { className: 'ah-music-launcher', 'aria-controls': 'ah-music-panel' })
  launcher.append(h('span', { className: 'ah-music-note', 'aria-hidden': 'true' }, '♫'), h('span', {}, title, status))
  const miniPlay = button(t('music.play'), '▶', toggle, { className: 'ah-music-mini' })
  const heading = h('strong', {}, t('music.heading'))
  const now = h('strong', { className: 'ah-music-now' })
  const mood = h('span', { className: 'ah-music-mood' })
  const play = button(t('music.play'), '▶', toggle, { className: 'ah-music-play' })
  const repeat = button(t('music.repeat.list'), t('music.repeat.listText'), () => { loopOne = !loopOne; audio.loop = loopOne; save(); update() })
  const seek = h('input', { type: 'range', min: 0, max: 100, step: .1, value: 0, 'aria-label': t('music.seek'), oninput: () => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value) / 100 * audio.duration; updateTime() } })
  const time = h('span', { className: 'ah-music-time' })
  const mute = button(t('music.mute'), '♪', () => { audio.muted = !audio.muted; save(); update() })
  const volume = h('input', { type: 'range', min: 0, max: 100, step: 1, value: audio.volume * 100, 'aria-label': t('music.volume'), oninput: () => { audio.volume = Number(volume.value) / 100; audio.muted = false; save(); update() } })
  const volumeText = h('span')
  const feedback = h('p', { className: 'ah-music-feedback', role: 'status' })
  let trackButtons = []
  const trackList = h('div', { className: 'ah-music-tracks' })
  function rebuildTracks() {
    trackButtons = playlist.map((track, n) => button(t('music.track.play', { title: track.title }), '', () => select(n, true), { className: 'ah-music-track' }))
    trackButtons.forEach((el, n) => el.append(h('span', { className: 'ah-music-number' }, String(n + 1).padStart(2, '0')), h('span', {}, h('strong', {}, playlist[n].title), h('small', {}, playlist[n].mood))))
    trackList.replaceChildren(...trackButtons)
  }
  rebuildTracks()
  const link = (text, href) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text)
  const closeButton = button(t('music.launcher.collapse'), '×', () => { expanded = false; update(); launcher.focus() })
  const previousButton = button(t('music.prev'), '❮', () => select(index - 1, true))
  const nextButton = button(t('music.next'), '❯', () => select(index + 1, true))
  const refreshButton = button(t('music.refresh'), t('music.refresh.button'), () => refreshPlaylist())
  const footerLabel = h('span', {}, t('music.footer.label'))
  const footerNote = h('span', {}, t('music.footer.note'))
  const creditsLink = link(t('music.footer.credits'), '/mods/arkhamhorror/audio/music/CREDITS.txt')
  const panel = h('section', { id: 'ah-music-panel', className: 'ah-music-panel', 'aria-label': t('music.panel') },
    h('header', {}, heading, closeButton),
    h('div', { className: 'ah-music-record', 'aria-hidden': 'true' }, h('span', {}, 'AH')),
    now, mood,
    h('div', { className: 'ah-music-controls' }, previousButton, play, nextButton, repeat),
    seek, time,
    h('div', { className: 'ah-music-volume' }, mute, volume, volumeText),
    feedback, refreshButton, trackList,
    h('footer', {}, footerLabel, link('Kevin MacLeod', 'https://incompetech.com/'), ' · ', link('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'), h('br'), footerNote, creditsLink))
  const root = h('aside', { className: 'ah-music', 'aria-label': t('music.player.aria'), onkeydown: e => { if (e.key === 'Escape' && expanded) { e.stopPropagation(); expanded = false; update(); launcher.focus() } } }, panel, h('div', { className: 'ah-music-dock' }, launcher, miniPlay))

  // 播放器 DOM 长期存活（createMusicPlayer 只调用一次）：切换语言时只刷新静态文案与 aria、重算动态标签，
  // 不重建音频、不丢弃当前播放状态。订阅只注册一次；组件没有销毁生命周期，监听保持到页面结束。
  function setControlLabel(node, key) {
    const text = t(key)
    node.setAttribute('aria-label', text)
    node.title = text
  }
  function syncTrackLabels() {
    trackButtons.forEach((el, n) => el.setAttribute('aria-label', t('music.track.play', { title: playlist[n].title })))
  }
  function applyStaticText() {
    heading.textContent = t('music.heading')
    panel.setAttribute('aria-label', t('music.panel'))
    root.setAttribute('aria-label', t('music.player.aria'))
    seek.setAttribute('aria-label', t('music.seek'))
    volume.setAttribute('aria-label', t('music.volume'))
    setControlLabel(closeButton, 'music.launcher.collapse')
    setControlLabel(previousButton, 'music.prev')
    setControlLabel(nextButton, 'music.next')
    setControlLabel(refreshButton, 'music.refresh')
    refreshButton.textContent = t('music.refresh.button')
    footerLabel.textContent = t('music.footer.label')
    footerNote.textContent = t('music.footer.note')
    creditsLink.textContent = t('music.footer.credits')
    syncTrackLabels()
  }
  applyStaticText()
  subscribeLocaleChange(() => { applyStaticText(); update() })

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
    launcher.setAttribute('aria-label', expanded ? t('music.launcher.collapse') : t('music.launcher.expand'))
    launcher.title = launcher.getAttribute('aria-label')
    title.textContent = track?.title || t('music.now.empty')
    status.textContent = error ? t('music.status.error') : pending ? t('music.status.loading') : playing ? t('music.status.playing') : waitingGesture ? t('music.status.waitingGesture') : t('music.status.paused')
    now.textContent = track?.title || t('music.now.empty'); mood.textContent = track?.mood || t('music.mood.empty')
    for (const control of [play, miniPlay]) {
      control.textContent = playing || pending ? 'Ⅱ' : '▶'
      control.setAttribute('aria-label', playing || pending ? t('music.pause') : t('music.play'))
      control.title = control.getAttribute('aria-label')
      control.disabled = !track
    }
    repeat.textContent = loopOne ? t('music.repeat.oneText') : t('music.repeat.listText')
    repeat.setAttribute('aria-label', loopOne ? t('music.repeat.one') : t('music.repeat.list'))
    repeat.title = repeat.getAttribute('aria-label')
    repeat.setAttribute('aria-pressed', String(loopOne))
    mute.textContent = audio.muted || audio.volume === 0 ? '♪ ×' : '♪'
    mute.setAttribute('aria-label', audio.muted ? t('music.unmute') : t('music.mute'))
    mute.title = mute.getAttribute('aria-label')
    mute.setAttribute('aria-pressed', String(audio.muted))
    volumeText.textContent = `${Math.round(audio.volume * 100)}%`
    const warning = configWarningKey ? t(configWarningKey) : configWarning
    feedback.textContent = error ? t(error) : warning
    feedback.hidden = !(error || warning)
    trackButtons.forEach((el, n) => el.setAttribute('aria-current', String(n === index)))
    updateTime()
  }
  // cache=cdn: the hall downloads a missing track once, then serves it as a local file.
  const trackUrl = track => '/mods/arkhamhorror/audio/music/' + track.file.split('/').map(encodeURIComponent).join('/') + (track.custom ? '' : '?cache=cdn')
  function source() { return trackUrl(playlist[index]) }
  // The hall finishes caching the whole file before answering, so a one-byte range warms the local copy.
  const prefetched = new Set()
  function prefetch(track) {
    if (!track || prefetched.has(track.file)) return
    prefetched.add(track.file)
    fetch(trackUrl(track), { headers: { Range: 'bytes=0-0' } })
      .then(response => { if (!response.ok) prefetched.delete(track.file); return response.body?.cancel() })
      .catch(() => prefetched.delete(track.file))
  }
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
    if (!active || !playlist.length) return
    const ticket = ++generation
    waitForGesture(false)
    error = ''; pending = true
    if (!audio.getAttribute('src') || audio.error) { audio.src = source(); audio.load() }
    update()
    try { await audio.play() } catch (err) {
      if (ticket === generation && active) {
        if (err.name === 'NotAllowedError') waitForGesture(true)
        else if (err.name !== 'AbortError') error = 'music.error.play'
      }
    } finally { if (ticket === generation) { pending = false; update() } }
  }
  function pause() { generation++; refreshAutoplay = false; pending = false; waitForGesture(false); audio.pause(); update() }
  function toggle() { if (error) start(); else if (!audio.paused || pending) pause(); else start() }
  function select(n, autoplay) {
    if (!playlist.length) return
    pause(); index = (n + playlist.length) % playlist.length
    error = ''; audio.src = source(); audio.load(); save(); update()
    if (autoplay) start()
  }
  audio.addEventListener('ended', () => { if (active && !loopOne) select(index + 1, true) })
  // Only after the current track is playing, so the two downloads never compete.
  audio.addEventListener('playing', () => { if (active && !loopOne) prefetch(playlist[(index + 1) % playlist.length]) })
  audio.addEventListener('error', () => { pending = false; error = 'music.error.load'; update() })
  for (const event of ['play', 'pause', 'loadedmetadata', 'durationchange', 'volumechange']) audio.addEventListener(event, update)
  audio.addEventListener('timeupdate', updateTime)
  window.addEventListener('pagehide', pause)
  async function refreshPlaylist(autoplay = false) {
    autoplay = autoplay || refreshAutoplay
    refreshAutoplay = autoplay
    const ticket = ++refreshTicket, requestedId = playlistId, intent = generation
    try {
      const response = await fetch('/api/mods/arkhamhorror/music/playlist?id=' + encodeURIComponent(requestedId), { cache: 'no-store' })
      if (!response.ok) throw new Error('playlist read failed')
      const result = await response.json()
      if (ticket !== refreshTicket || requestedId !== playlistId) return
      refreshAutoplay = false
      if (!Array.isArray(result.tracks) || result.playlistId !== requestedId) throw new Error('invalid playlist format')
      configWarning = (result.warnings || []).join('；'); configWarningKey = ''
      const resume = active && generation === intent && (autoplay || !audio.paused || pending || waitingGesture)
      const previous = playlist[index]
      const currentIndex = result.tracks.findIndex(t => t.file === previous?.file)
      const changed = JSON.stringify(result.tracks) !== JSON.stringify(playlist)
      if (changed) {
        const keepPlaying = currentIndex >= 0 && !!audio.getAttribute('src')
        if (!keepPlaying) { pause(); audio.removeAttribute('src') }
        playlist = result.tracks
        index = keepPlaying ? currentIndex : saved.playlistId === playlistId
          ? Math.max(0, playlist.findIndex(t => t.id === saved.trackId)) : 0
        error = ''; rebuildTracks(); save(); update()
        if (!keepPlaying && resume) start()
        else if (autoplay && resume && audio.paused) start()
      } else {
        update()
        if (autoplay && resume) start()
      }
    } catch {
      if (ticket !== refreshTicket || requestedId !== playlistId) return
      refreshAutoplay = false
      configWarning = ''; configWarningKey = 'music.warning.refresh'
      update()
      if (autoplay && active && generation === intent) start()
    }
  }
  update()
  return {
    render(enabled, nextPlaylistId = playlistId) {
      nextPlaylistId = MUSIC_PLAYLISTS[nextPlaylistId] ? nextPlaylistId : 'common'
      let resumeAfterSwitch = false
      if (nextPlaylistId !== playlistId) {
        refreshTicket++
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
      if (!enabled && active) { refreshTicket++; pause(); expanded = false; update() }
      active = enabled
      // Only start on entry. Table/hub updates must not undo a manual pause.
      if (entering || (enabled && resumeAfterSwitch)) refreshPlaylist(true)
      else if (enabled && nextPlaylistId !== lastRequestedPlaylist) refreshPlaylist()
      lastRequestedPlaylist = nextPlaylistId
      return enabled ? root : null
    },
  }
}
