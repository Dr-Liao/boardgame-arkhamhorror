import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createMusicLibrary, defaultMusicConfig } from '../src/integration/music-library.js'
import { createMusicLayout } from '../tools/music-layout.mjs'
import { preserveModFiles } from '../../../lib/install.js'
import { zipDirectory, extractZip } from '../../../lib/zip.js'

const chapter = 'theCircleUndone/theWitchingHour'
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'music-library-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const custom = path.join(root, 'campaigns', chapter)
  fs.mkdirSync(custom, { recursive: true })
  const write = playlists => fs.writeFileSync(path.join(root, 'playlists.json'), JSON.stringify({ schemaVersion: 1, playlists }))
  return { root, custom, write, read: createMusicLibrary({ root }) }
}
test('缺少用户配置时生成默认，中文与特殊字符歌曲自动追加且不跨关', t => {
  const { root, custom, read } = fixture(t)
  fs.writeFileSync(path.join(custom, '02 雾中 #%.mp3'), 'audio')
  fs.writeFileSync(path.join(custom, '01 灵魂.wav'), 'audio')
  fs.writeFileSync(path.join(custom, '忽略.txt'), 'text')
  const result = read(chapter)
  assert.equal(result.tracks.length, 5)
  assert.deepEqual(result.tracks.slice(3).map(t => t.title), ['01 灵魂', '02 雾中 #%'])
  assert.ok(fs.existsSync(path.join(root, 'playlists.json')))
  assert.equal(read('theCircleUndone/theSecretName').tracks.length, 3)
  fs.unlinkSync(path.join(custom, '01 灵魂.wav'))
  assert.equal(read(chapter).tracks.length, 4)
})
test('配置实时控制顺序、空歌单、自动扫描开关与文件引用去重', t => {
  const { custom, write, read } = fixture(t)
  const ref = 'campaigns/' + chapter + '/自定义.mp3'
  fs.writeFileSync(path.join(custom, '自定义.mp3'), 'audio')
  write({ [chapter]: { tracks: ['ritual', 'tcuBabaYaga', ref, ref], includeCustom: true } })
  assert.deepEqual(read(chapter).tracks.map(t => t.id), ['ritual', 'tcuBabaYaga', 'local:' + ref])
  write({ [chapter]: { tracks: [], includeCustom: false } })
  assert.equal(read(chapter).tracks.length, 0)
  write({ [chapter]: [] })
  assert.equal(read(chapter).tracks.length, 1)
  write({ [chapter]: ['common/ritual.mp3'] })
  assert.equal(read(chapter).tracks[0].id, 'ritual')
})
test('损坏配置保留有效歌单并提示；越界与链接引用被拒绝', t => {
  const { root, custom, write, read } = fixture(t)
  write({ [chapter]: ['ritual'] }); read(chapter)
  fs.writeFileSync(path.join(root, 'playlists.json'), '{broken')
  assert.equal(read(chapter).tracks[0].id, 'ritual')
  assert.equal(read(chapter).warnings.length, 1)
  write({ [chapter]: ['../../secret.mp3', 'common/../../secret.mp3', 'C:\\secret.mp3', 'https://example.com/song.mp3', 'missing'] })
  assert.equal(read(chapter).tracks.length, 0)
  assert.equal(read(chapter).warnings.length, 5)
  assert.throws(() => read('../../secret'), RangeError)
  const outside = path.join(root, 'outside')
  fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'song.mp3'), 'audio')
  fs.symlinkSync(outside, path.join(custom, 'linked'), 'junction')
  write({ [chapter]: ['campaigns/' + chapter + '/linked/song.mp3'] })
  assert.equal(read(chapter).tracks.length, 0)
})
test('随包目录经过 ZIP 解压仍保留，更新保留用户配置和歌曲', async t => {
  const { root } = fixture(t)
  const stage = path.join(root, 'staged'), unpacked = path.join(root, 'unpacked'), old = path.join(root, 'old')
  const folders = createMusicLayout(stage)
  const zip = path.join(root, 'music.zip')
  zipDirectory(stage, zip)
  await extractZip(zip, unpacked)
  for (const folder of folders) assert.ok(fs.existsSync(path.join(unpacked, 'web/audio/music', folder, '添加音乐.txt')))
  assert.ok(!fs.existsSync(path.join(unpacked, 'web/audio/music/playlists.json')))
  const userRoot = path.join(old, 'web/audio/music')
  fs.mkdirSync(path.join(userRoot, 'campaigns', chapter), { recursive: true })
  fs.writeFileSync(path.join(userRoot, 'playlists.json'), JSON.stringify({ schemaVersion: 1, playlists: { [chapter]: ['ritual'] } }))
  fs.writeFileSync(path.join(userRoot, 'campaigns', chapter, '用户.mp3'), 'audio')
  fs.writeFileSync(path.join(unpacked, 'boardgame-mod.json'), JSON.stringify({ preserve: ['web/audio/music/'] }))
  preserveModFiles(old, unpacked)
  const read = createMusicLibrary({ root: path.join(unpacked, 'web/audio/music') })
  assert.equal(read(chapter).tracks[0].id, 'ritual')
  assert.equal(read(chapter).tracks[1].title, '用户')
  assert.equal(Object.keys(defaultMusicConfig().playlists).filter(id => id.includes('/')).length, 38)
})

