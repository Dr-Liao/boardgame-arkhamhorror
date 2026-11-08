import fs from 'node:fs'
import path from 'node:path'
const root = 'G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios'
for (const dir of fs.readdirSync(root)) {
  const file = path.join(root, dir, 'behavior.js')
  if (!fs.existsSync(file)) continue
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const hits = []
  lines.forEach((line, index) => {
    if (/^\s{2}(resolution|checkObjectives|actReveal|agendaReveal|scenarioActions|scenarioResolution)\s*[:(]/.test(line)) {
      hits.push(`${index + 1}:${line.trim()}`)
    }
  })
  console.log(dir, '=>', hits.join(' | '))
}
