// 结构探测：打印 screen/*.json 顶层键与首元素结构。
import fs from 'node:fs'
const ROOT = 'G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/screen'
const names = ['integrity.json', 'keyword-coverage.json', 'flags-readpoints.json', 'tests-coverage.json',
  'known-deviations.json', 'duplication.json', 'primitive-compliance.json', 'perceivability.json']
for (const name of names) {
  try {
    const data = JSON.parse(fs.readFileSync(`${ROOT}/${name}`, 'utf8'))
    const info = { topKeys: Object.keys(data) }
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) info[k] = { type: 'array', len: v.length, sample: v[0] }
      else if (v && typeof v === 'object') info[k] = { type: 'object', keys: Object.keys(v).slice(0, 12) }
      else info[k] = v
    }
    console.log('=== ' + name + ' ===')
    console.log(JSON.stringify(info, null, 1).slice(0, 4000))
  } catch (error) {
    console.log('=== ' + name + ' ERROR ' + error.message)
  }
}
