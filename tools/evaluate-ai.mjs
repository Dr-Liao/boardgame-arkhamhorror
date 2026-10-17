// Opt-in real-model evaluation. Never substitutes a scripted player for the model.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import arkham from '../index.js'
import { loadConfig } from '../../../lib/agent/config.js'
import { createAgent, createTurnContext } from '../../../lib/agent/orchestrator.js'
import { commitAgentPlan, plansForObserver } from '../../../lib/agent/plans.js'
import { getDecisionSeat } from '../../../lib/mods.js'

const args = process.argv.slice(2)
const option = (key, fallback) => args.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3) || fallback
if (!args.includes('--live')) throw new Error('真实调用需显式 --live；本命令会使用已配置模型并产生用量。')
const config = loadConfig()
if (!config.apiKey) throw new Error('未配置真实模型；拒绝把离线兜底当作模型验收。')
const root = fileURLToPath(new URL('../../..', import.meta.url))
const dir = path.resolve(root, option('output', `artifacts/ai-evaluation-${Date.now()}`))
const maxSteps = Number(option('max-steps', '700'))
const maxMinutes = Number(option('max-minutes', '60'))
const count = Number(option('players', '1'))
const maxTurnCalls = Number(option('max-turn-calls', String(config.maxTurnCalls || 24)))
const maxTokens = Number(option('max-tokens', String(Math.max(config.maxTokens || 0, 1400))))
if (![1,2,3,4].includes(count) || !Number.isSafeInteger(maxSteps) || maxSteps < 1 || !Number.isFinite(maxMinutes) || maxMinutes <= 0) throw new Error('无效评估预算或人数')
if (!Number.isSafeInteger(maxTurnCalls) || maxTurnCalls < 1) throw new Error('无效回合调用上限')
if (!Number.isSafeInteger(maxTokens) || maxTokens < 1) throw new Error('无效输出 token 上限')
fs.mkdirSync(dir, { recursive: true })
process.env.DSH_HOME = dir // Logs stay with the evaluation, configuration stays in memory.
const checkpoint = path.join(dir, 'checkpoint.json')
const traceFile = path.join(dir, 'trace.jsonl')
if (fs.existsSync(checkpoint) && !args.includes('--resume')) throw new Error('输出目录已有评估；用 --resume 继续或换目录')
let session = args.includes('--resume') ? JSON.parse(fs.readFileSync(checkpoint, 'utf8')) : {
  sessionId: `ai-eval-${Date.now()}`, modId: arkham.id, events: [], notes: [],
  players: Array.from({length:count}, (_,seat) => ({seat, role:'ai', aiId:`eval-${seat}`, name:`调查员${seat+1}`})),
}
if (!session.state) session.state = arkham.createState({ seed: option('seed', 'ai-completion-1'), difficulty: 'easy', campaignId:'nightOfTheZealot' }, session.players)
const agent = createAgent({ modById: () => arkham, getAi: () => ({ id:'evaluator', persona:'你是一名谨慎、善于合作的调查员。目标是尽量完成战役，评估风险，避免无意义循环。组牌兼顾调查、战斗、资源与技能投入；向队友解释关键决定。' }),
  getConfig: () => ({...config, maxTokens, maxRetries:2, maxTurnCalls}) })
const hash = state => createHash('sha256').update(JSON.stringify(state)).digest('hex')
const safeError = error => String(error?.message || error).replaceAll(config.apiKey, '[redacted]').slice(0, 500)
const started = Date.now()
const runId = new Date(started).toISOString()
const sourceFiles = ['lib/agent/orchestrator.js','lib/agent/prompt.js','lib/agent/plans.js',
  'games/arkhamhorror/index.js','games/arkhamhorror/ai-context.js','games/arkhamhorror/engine.js',
  'games/arkhamhorror/tools/evaluate-ai.mjs']
fs.appendFileSync(path.join(dir,'runs.jsonl'),JSON.stringify({runId,resume:args.includes('--resume'),
  maxSteps,maxMinutes,maxTurnCalls,maxTokens,model:config.model,
  sources:Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]))})+'\n')
let stopReason = 'step-budget', error = null, turn = null, turnSeat = null, turnKey = null, jsonRecoveryVerified = true
const closeTurn = () => { if(turn) agent.endTurn(turn); turn = null; turnSeat = null }
const save = () => { fs.writeFileSync(checkpoint + '.tmp', JSON.stringify(session)); fs.renameSync(checkpoint + '.tmp', checkpoint) }
save()
try {
  const incompatible=arkham.saveCompatibilityError?.(session.state)
  if(incompatible) throw Object.assign(new Error(incompatible),{code:'incompatible-checkpoint'})
  for (let step=0; step<maxSteps; step++) {
    if (session.state.status !== 'playing') { stopReason='campaign-ended'; break }
    if (Date.now()-started > maxMinutes*60000) { stopReason='time-budget'; break }
    const state=session.state, seat=getDecisionSeat(arkham,state)
    const nextTurnKey=arkham.agentTurnKey(state,seat)
    if (!turn || turnSeat!==seat || turnKey!==nextTurnKey) { closeTurn(); turn=createTurnContext(seat,arkham.id,session.sessionId); turnSeat=seat; turnKey=nextTurnKey }
    const before=hash(state), began=Date.now()
    const result=await agent.agentPlay(session,seat,turn)
    if (!result.move || result.stalled) { stopReason=result.reason||'agent-stalled'; break }
    const invalid=arkham.validateMove(state,seat,result.move)
    if(invalid) throw Error('模型提交仍非法：'+invalid)
    const next=structuredClone(state), events=arkham.applyMove(next,seat,result.move)
    // Execute the same move from a JSON-restored pre-move state, including continuations.
    const recovered=JSON.parse(JSON.stringify(state))
    const recoveredEvents=arkham.applyMove(recovered,seat,structuredClone(result.move))
    if(hash(recovered)!==hash(next)||JSON.stringify(recoveredEvents)!==JSON.stringify(events)) { jsonRecoveryVerified=false;throw Error('JSON 恢复后执行结果不一致') }
    session.state=next
    commitAgentPlan(session,seat,result.plan,state)
    session.events.push(...events, ...(result.speech?[{type:'speech',seat,text:result.speech}]:[]))
    const record={runId,revision:next.revision,seat,scenario:state.scenario?.id||null,uiState:state.uiState,
      phase:state.phase,round:state.round,choice:state.pendingChoice?.kind||null,move:result.move,
      fallback:!!result.fallback,reason:result.reason||'model',attempts:result.attempts,latencyMs:Date.now()-began,
      plan:plansForObserver(session,seat).own,model:result.model||config.model,usage:result.usage,
      before,after:hash(next),riskFlags:[
        ...(result.move.action==='resource' && state.investigators[seat].resources>=10?['resource-at-10-plus']:[]),
        ...(result.move.action==='endTurn' && state.investigators[seat].actionsLeft>0?['unused-actions']:[]),
      ]}
    fs.appendFileSync(traceFile,JSON.stringify(record)+'\n');save()
    if(step%5===0 || state.uiState!==next.uiState) console.log(JSON.stringify({step:next.revision,scenario:next.scenario?.id,round:next.round,phase:next.uiState,action:result.move.action,fallback:!!result.fallback}))
    if(next.investigators[seat]?.actionsLeft<=0)closeTurn()
  }
  if(session.state.status!=='playing')stopReason='campaign-ended'
} catch(err) { stopReason=err.code==='incompatible-checkpoint'?'incompatible-checkpoint':'error';error=safeError(err) }
finally { closeTurn();save() }
const readLines = file => fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):[]
const trace=readLines(traceFile)
const decisions=readLines(path.join(dir,'boardgame-hall','decisions.jsonl')).filter(d=>d.sessionId===session.sessionId)
const counts = values => Object.fromEntries([...new Set(values)].map(v=>[v,values.filter(x=>x===v).length]))
const modelCalls=decisions.filter(d=>['ok','validateError','parseError','callError'].includes(d.outcome))
const guardErrors=modelCalls.filter(d=>d.outcome==='validateError'&&/版本不兼容/.test(d.error||'')).length
const illegal=modelCalls.filter(d=>d.outcome==='validateError').length-guardErrors
const choiceTrace=trace.filter(t=>t.choice)
const bypassed=choiceTrace.filter(t=>t.move.action!=='choose').length
const report={createdAt:new Date().toISOString(),model:config.model,endpointHost:new URL(config.baseUrl).host,
  rulesVersion:session.state.rulesVersion,resourceVersion:session.state.resourceVersion,seed:session.state.seed,players:session.players.length,stopReason,error,maxTurnCalls,maxTokens,
  realModelCalls:modelCalls.length,legalDecisions:trace.length,illegalResponses:illegal,illegalResponseRate:modelCalls.length?illegal/modelCalls.length:null,
  compatibilityValidationErrors:guardErrors,
  fallbackDecisions:trace.filter(t=>t.fallback).length,fallbackRate:trace.length?trace.filter(t=>t.fallback).length/trace.length:null,
  choices:counts(trace.filter(t=>t.choice).map(t=>t.choice)),riskFlags:counts(trace.flatMap(t=>t.riskFlags)),
  pendingDecisions:choiceTrace.length,mandatoryChoiceBypasses:bypassed,
  mandatoryChoiceBypassRate:choiceTrace.length?bypassed/choiceTrace.length:null,
  callErrors:modelCalls.filter(d=>d.outcome==='callError').length,parseErrors:modelCalls.filter(d=>d.outcome==='parseError').length,
  riskInterpretation:'资源>=10仍取资源、留行动结束仅是复盘提示，不自动判为浪费。跳过可选反应不是漏选。',
  usage:{promptTokens:modelCalls.reduce((n,d)=>n+(d.usage?.promptTokens||0),0),completionTokens:modelCalls.reduce((n,d)=>n+(d.usage?.completionTokens||0),0)},
  modelDeckSubmissions:trace.filter(t=>t.move.action==='hubSetDeck'&&!t.fallback).length,
  modelUpgradePurchases:trace.filter(t=>t.move.action==='hubPurchase'&&!t.fallback).length,
  teamRoles:plansForObserver(session,null).team,
  perSeat:session.players.map(p=>({seat:p.seat,decisions:trace.filter(t=>t.seat===p.seat).length,
    modelDeckSubmissions:trace.filter(t=>t.seat===p.seat&&t.move.action==='hubSetDeck'&&!t.fallback).length})),
  plansWritten:trace.filter(t=>t.plan?.revision===t.revision&&!t.fallback).length,
  jsonRecoveryVerified,scenarioResults:session.state.campaign.scenarioResults.map(r=>({scenarioId:r.scenarioId,resolution:r.resolution})),
  campaignEnded:session.state.status!=='playing',outcome:session.state.outcome,
  threeScenarioCoverage:session.state.campaign.scenarioResults.length>=3,
  pendingChoice:session.state.pendingChoice?{kind:session.state.pendingChoice.kind,seat:session.state.pendingChoice.seat}:null,
  acceptance:'只报告真实覆盖；战役结束不等于胜利，未到达升级／后续关卡不视为通过。'}
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
process.exitCode=stopReason==='campaign-ended'?0:2
