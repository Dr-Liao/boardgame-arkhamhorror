// Shared by local setup and both portable/store prepack flows.
import fs from 'node:fs'
import path from 'node:path'
import { defaultMusicConfig } from '../src/integration/music-library.js'
import { MUSIC_TRACKS } from '../web/music-player.js'
import { SCENARIO_MUSIC } from '../web/scenario-music.js'
export function createMusicLayout(modRoot, { userConfig = false } = {}) {
  const root = path.join(modRoot, 'web/audio/music')
  const config = defaultMusicConfig()
  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(path.join(root, 'playlists.example.json'), JSON.stringify(config, null, 2) + '\n')
  fs.writeFileSync(path.join(root, 'tracks.json'), JSON.stringify(MUSIC_TRACKS.map(({ id, title, file }) => ({ id, title, file })), null, 2) + '\n')
  fs.writeFileSync(path.join(root, '目录索引.txt'), '关卡自定义歌曲目录（相对于本文件）\n\n' + Object.entries(SCENARIO_MUSIC).flatMap(([campaign, chapters]) => Object.entries(chapters).map(([id, chapter]) => `${chapter.name}\n  campaigns/${campaign}/${id}/\n`)).join('\n'))
  if (userConfig && !fs.existsSync(path.join(root, 'playlists.json'))) fs.writeFileSync(path.join(root, 'playlists.json'), JSON.stringify(config, null, 2) + '\n')
  const names = []
  for (const id of Object.keys(config.playlists)) {
    const relative = id === 'common' ? 'common' : 'campaigns/' + id
    fs.mkdirSync(path.join(root, relative), { recursive: true })
    // ZIP/Git do not keep empty directories: this non-audio marker keeps them.
    fs.writeFileSync(path.join(root, relative, '添加音乐.txt'), `将 MP3、OGG、WAV、M4A、AAC、FLAC 或 WebM 文件放在此目录。\n歌单：${id}\n展开播放器、切关或点击“刷新歌单”后自动加入。\n只扫描此目录的音频文件，不递归子目录；文件名可使用中文。\n修改 audio/music/playlists.json 可调整默认歌曲与顺序；includeCustom:false 可关闭自动加入。\n`)
    names.push(relative)
  }
  return names
}
