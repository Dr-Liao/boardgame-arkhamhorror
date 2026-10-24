import { readFileSync, writeFileSync } from 'node:fs'
import { mediaPlan, slug, trackId } from './tcu-media-plan.mjs'
const root = new URL('../', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('artifacts/tcu-music-catalog.json', root)))
const musicPath = new URL('web/music-player.js', root)
let music = readFileSync(musicPath, 'utf8')
if (!music.includes("id: 'tcuVanishing'")) {
  const tracks = mediaPlan.flatMap(([, , mood, titles]) => titles.map(title => {
    const source = catalog.find(t => t.title === title)
    if (!source) throw new Error(title)
    return `  { id: '${trackId(title)}', title: ${JSON.stringify(title)}, mood: ${JSON.stringify(mood)}, file: 'common/${slug(title)}.mp3', isrc: '${source.isrc}' },`
  }))
  music = music.replace('export const MUSIC_TRACKS = [', 'export const MUSIC_TRACKS = [\n' + tracks.join('\n'))
  music = music.replace('  ...SCENARIO_PLAYLISTS,', "  theCircleUndone: Object.freeze([...new Set(Object.values(SCENARIO_MUSIC.theCircleUndone).flatMap(chapter => chapter.tracks))]),\n  ...SCENARIO_PLAYLISTS,")
  writeFileSync(musicPath, music)
}
const scenariosPath = new URL('web/scenario-music.js', root)
let scenarios = readFileSync(scenariosPath, 'utf8')
if (!scenarios.includes('  theCircleUndone:')) {
  const rows = mediaPlan.map(([id, name, mood, titles]) => `    ${id}: chapter(${JSON.stringify(name)}, ${JSON.stringify(mood)}, ${JSON.stringify(titles.map(trackId))}),`)
  scenarios = scenarios.replace('export const SCENARIO_MUSIC = Object.freeze({', 'export const SCENARIO_MUSIC = Object.freeze({\n  theCircleUndone: Object.freeze({\n' + rows.join('\n') + '\n  }),')
  writeFileSync(scenariosPath, scenarios)
}
const creditsPath = new URL('web/audio/music/CREDITS.txt', root)
let credits = readFileSync(creditsPath, 'utf8')
if (!credits.includes('The Circle Undone /')) {
  credits += '\nThe Circle Undone / 万象无终 — added 2026-10-24\n'
    + mediaPlan.flatMap(row => row[3]).map(title => '"' + title + '"').join(', ') + '\n'
    + 'Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0\nhttps://creativecommons.org/licenses/by/4.0/\n'
    + 'Official licensing: https://incompetech.com/music/royalty-free/licenses/\n'
    + 'Re-encoded to 128 kbps MP3, 44.1 kHz; no cuts or mixing.\n'
    + mediaPlan.flatMap(row => row[3]).map(title => 'https://incompetech.com/music/royalty-free/index.html?isrc=' + catalog.find(t => t.title === title).isrc).join('\n') + '\n'
  writeFileSync(creditsPath, credits)
}
