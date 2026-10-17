// Original synthesized Foley: a short air sweep, low impact and horror chime.
// No remote audio, autoplay or additional asset downloads are required.
export function createCombatSound() {
  let context
  const voices=new Set()
  const unlock=()=>{
    try {
      const Context=globalThis.AudioContext||globalThis.webkitAudioContext
      if(!Context)return
      context ||= new Context()
      if(context.state==='suspended')context.resume().catch(()=>{})
    } catch { /* Audio may be disabled by the browser. */ }
  }
  const play=kind=>{
    if(!context||context.state!=='running')return
    const time=context.currentTime, miss=kind==='miss', swing=kind==='swing'
    const duration=swing ? .19 : miss ? .22 : kind==='horror' ? .55 : .3
    const gain=context.createGain(),filter=context.createBiquadFilter()
    gain.connect(context.destination);filter.connect(gain)
    gain.gain.setValueAtTime(.001,time)
    gain.gain.exponentialRampToValueAtTime(swing ? .09 : miss ? .06 : .18,time+.012)
    gain.gain.exponentialRampToValueAtTime(.001,time+duration)
    filter.type=swing||miss?'bandpass':'lowpass'
    filter.frequency.setValueAtTime(swing?1800:miss?2400:kind==='horror'?1100:750,time)
    filter.frequency.exponentialRampToValueAtTime(swing?350:120,time+duration)
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate)
    const data=buffer.getChannelData(0)
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1
    const noise=context.createBufferSource();noise.buffer=buffer;noise.connect(filter)
    const tone=context.createOscillator();tone.type=kind==='horror'?'triangle':'sine'
    tone.frequency.setValueAtTime(kind==='horror'?360:150,time)
    tone.frequency.exponentialRampToValueAtTime(kind==='horror'?90:45,time+duration)
    const bass=context.createGain();bass.gain.value=swing||miss?0:.32;tone.connect(bass);bass.connect(gain)
    const voice={stop(){try{noise.stop();tone.stop()}catch{}gain.disconnect();filter.disconnect();bass.disconnect();tone.disconnect();noise.disconnect();voices.delete(voice)}}
    voices.add(voice);noise.onended=()=>voice.stop()
    noise.start(time);tone.start(time);noise.stop(time+duration);tone.stop(time+duration)
  }
  return {unlock,play,stop(){for(const voice of [...voices])voice.stop()}}
}
