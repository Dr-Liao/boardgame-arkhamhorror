// Offline verification of recorded model moves; does not invoke a model.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import arkham from '../index.js'

if(process.argv.length!==3)throw Error('用法：node games/arkhamhorror/tools/replay-ai.mjs <评估目录>')
const dir=path.resolve(process.argv[2])
const session=JSON.parse(fs.readFileSync(path.join(dir,'checkpoint.json'),'utf8'))
const incompatible=arkham.saveCompatibilityError(session.state)
if(incompatible)throw Error(incompatible)
const trace=fs.readFileSync(path.join(dir,'trace.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line))
const hash=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex')
let state=arkham.createState({seed:session.state.seed,difficulty:session.state.difficulty,campaignId:session.state.campaign.id},session.players)
for(const step of trace){
  if(hash(state)!==step.before)throw Error(`第 ${step.revision} 步之前与记录不一致`)
  const direct=structuredClone(state), restored=JSON.parse(JSON.stringify(state))
  const directEvents=arkham.applyMove(direct,step.seat,structuredClone(step.move))
  const restoredEvents=arkham.applyMove(restored,step.seat,structuredClone(step.move))
  if(hash(direct)!==hash(restored)||JSON.stringify(directEvents)!==JSON.stringify(restoredEvents))throw Error(`第 ${step.revision} 步 JSON 恢复执行不一致`)
  if(hash(restored)!==step.after)throw Error(`第 ${step.revision} 步之后与记录不一致`)
  state=restored
}
if(hash(state)!==hash(session.state))throw Error('最终状态与检查点不一致；请等评估停止后重放')
const report={verified:true,steps:trace.length,finalHash:hash(state),
  jsonRestoredBeforeEveryMove:true,eventsMatchDirectExecution:true,
  campaignEnded:state.status!=='playing',outcome:state.outcome}
fs.writeFileSync(path.join(dir,'replay-report.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify(report,null,2))
