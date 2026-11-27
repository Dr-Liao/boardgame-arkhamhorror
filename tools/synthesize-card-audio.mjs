// Original, deterministic PCM Foley and stingers. Run with
// node tools/synthesize-card-audio.mjs from the Mod directory.
import { mkdir, writeFile } from 'node:fs/promises'
import { CARD_AUDIO_FILES } from '../web/card-audio.js'

const rate = 32000
const voices = new Map()
const tone = (start, duration, frequency, end, gain, shape = 'tone') => ({ start, duration, frequency, end, gain, shape })
const air = (start, duration, frequency, gain, shape = 'air') => tone(start, duration, frequency, frequency, gain, shape)
const hit = (start, duration, frequency, gain) => tone(start, duration, frequency, frequency * .58, gain, 'hit')
const bell = (start, duration, frequency, gain) => tone(start, duration, frequency, frequency * .98, gain, 'bell')
const add = (id, duration, ...layers) => voices.set(id, { duration, layers })

add('private-reveal', .36, air(.02, .24, 1050, .24, 'brush'), tone(.13, .18, 243, 213, .16))
add('encounter-enemy', .57, tone(.01, .51, 74, 48, .64, 'growl'), air(.04, .47, 640, .23, 'breath'))
add('encounter-enemy_location', .58, hit(.01, .13, 174, .30), air(.04, .27, 1850, .6, 'crack'),
  air(.12, .20, 760, .35, 'crack'), tone(.12, .44, 56, 42, .35, 'growl'))
add('encounter-location', .52, tone(.01, .43, 235, 193, .29, 'hollow'), bell(.02, .46, 380, .20),
  bell(.11, .30, 380, .13), bell(.24, .25, 380, .07))
add('encounter-asset', .36, hit(.015, .16, 235, .53), hit(.11, .09, 295, .15), air(.01, .14, 1700, .17, 'crack'))
add('encounter-event', .41, bell(.02, .38, 700, .38), bell(.08, .29, 1120, .20))

add('treachery-spectral', .54, air(.006, .42, 840, .62, 'breath'), tone(.018, .41, 270, 137, .24, 'hollow'),
  air(.13, .35, 970, .14), tone(.19, .33, 240, 144, .13, 'hollow'))
add('treachery-omen', .50, bell(.015, .46, 134, .62), tone(.07, .41, 144, 98, .24, 'hollow'))
add('treachery-magic', .48, bell(.015, .45, 474, .47), tone(.018, .41, 315, 299, .30, 'hollow'),
  tone(.18, .26, 423, 450, .25, 'hollow'))
add('treachery-magic-alt', .48, bell(.015, .45, 440, .47), tone(.018, .41, 288, 274, .30, 'hollow'),
  tone(.18, .26, 397, 423, .24, 'hollow'))
add('treachery-hazard', .40, air(.014, .19, 2340, .61, 'crack'), hit(.022, .15, 172, .37),
  air(.13, .22, 1280, .39, 'crack'), hit(.18, .14, 100, .16))
add('treachery-hazard-alt', .40, air(.008, .20, 1890, .53, 'crack'), hit(.031, .15, 195, .36),
  air(.18, .20, 1490, .42, 'crack'), hit(.20, .13, 111, .17))
add('treachery-fear', .39, air(.018, .33, 1580, .62, 'breath'), tone(.06, .24, 230, 169, .21, 'tremor'))
add('treachery-fear-alt', .39, air(.014, .32, 1210, .63, 'breath'), tone(.06, .24, 201, 160, .20, 'tremor'))
add('treachery-scheme', .45, hit(.014, .12, 190, .48), tone(.115, .32, 253, 237, .54, 'string'))
add('treachery-power', .53, tone(.018, .49, 49, 113, .63, 'growl'), air(.09, .40, 410, .22, 'breath'))
add('treachery-discovery', .40, air(.02, .19, 2160, .41, 'brush'), bell(.134, .25, 830, .33))
add('treachery-object', .39, air(.016, .22, 1140, .45, 'brush'), tone(.05, .20, 122, 165, .25, 'growl'),
  hit(.205, .11, 264, .48), air(.21, .13, 1920, .23, 'crack'))
add('treachery-tekeli', .49, air(.025, .18, 1310, .49, 'breath'), tone(.035, .15, 252, 305, .25, 'hollow'),
  air(.25, .21, 1720, .59, 'breath'), tone(.27, .16, 325, 186, .33, 'hollow'))

const weakness = (id, duration, ...layers) => add(`weakness-${id}`, duration + .16,
  tone(.01, .075, 292, 277, .29, 'hollow'), tone(.081, .077, 221, 195, .35, 'hollow'),
  ...layers.map(layer => ({ ...layer, start: layer.start + .155 })))
weakness('enemy', .40, hit(.02, .30, 87, .75), air(.028, .19, 740, .34, 'crack'))
weakness('asset', .38, hit(.015, .14, 170, .52), air(.04, .19, 1190, .29, 'crack'), hit(.171, .14, 297, .29))
weakness('event', .37, tone(.025, .31, 331, 250, .55, 'string'), tone(.13, .21, 246, 231, .23, 'string'))
weakness('skill', .38, tone(.015, .17, 340, 615, .35, 'string'), air(.14, .18, 3270, .54, 'crack'), hit(.15, .13, 199, .26))
for (const [id, clip] of [...voices]) if (id.startsWith('treachery-')) weakness(id, clip.duration, ...clip.layers)

add('card-injury', .29, hit(.012, .22, 119, .65), air(.013, .11, 865, .31, 'crack'))
add('card-fright', .34, tone(.012, .307, 211, 139, .53, 'tremor'), air(.018, .29, 1200, .28, 'breath'))
add('card-injury-and-fear', .39, hit(.012, .19, 119, .55), air(.013, .11, 865, .26, 'crack'),
  tone(.036, .332, 211, 139, .49, 'tremor'), air(.04, .31, 1200, .26, 'breath'))
add('card-doom', .39, bell(.012, .36, 175, .58), tone(.08, .27, 78, 65, .29, 'hollow'))
add('card-lose-resource', .23, bell(.014, .15, 1740, .26), bell(.071, .132, 1280, .25), hit(.09, .102, 267, .26))
add('card-lose-clue', .25, bell(.01, .22, 1125, .29), tone(.041, .172, 770, 495, .22, 'hollow'))
add('card-lose-card', .22, air(.015, .166, 2420, .52, 'brush'), air(.069, .14, 1150, .37, 'brush'))
add('card-lose-action', .20, hit(.012, .153, 187, .62), air(.022, .13, 709, .24, 'crack'))
add('card-attach', .22, hit(.014, .14, 295, .47), air(.05, .13, 1580, .31, 'crack'), hit(.103, .096, 228, .26))
add('card-spawn', .27, hit(.016, .22, 83, .55), air(.018, .21, 530, .32, 'crack'))
add('card-surge', .21, tone(.011, .182, 209, 530, .46, 'hollow'), air(.075, .12, 1400, .26, 'brush'))

function render({ duration, layers }, id) {
  const samples = new Float32Array(Math.round(rate * duration))
  let seed = [...id].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261)
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
    return (seed >>> 0) / 2147483648 - 1
  }
  for (const { start, duration, frequency, end, gain, shape } of layers) {
    const from = Math.round(start * rate)
    const length = Math.min(Math.round(duration * rate), samples.length - from)
    let phase = 0, lower = 0, upper = 0
    for (let i = 0; i < length; i++) {
      const time = i / rate, progress = i / length, remain = 1 - progress
      const attack = ['hit', 'crack', 'bell', 'string'].includes(shape) ? .008 : .033
      const envelope = Math.min(1, time / attack) * Math.min(1, (duration - time) / .045)
      phase += 2 * Math.PI * (frequency + (end - frequency) * progress) / rate
      const sine = Math.sin(phase)
      let wave = sine * remain
      if (shape === 'hollow') wave = (sine + .32 * Math.sin(phase * 1.51)) * remain ** .65
      if (shape === 'growl') wave = Math.tanh(2 * (sine + .45 * Math.sin(phase * 2.05))) * remain ** .75
        * (.63 + .37 * Math.sin(2 * Math.PI * time * 21))
      if (shape === 'tremor') wave = (sine + .24 * Math.sin(phase * 2.13)) * remain * (.62 + .38 * Math.sin(2 * Math.PI * time * 29))
      if (shape === 'hit') wave = (sine + .19 * Math.sin(phase * 2.61)) * Math.exp(-4.7 * progress)
      if (shape === 'bell') wave = sine * remain ** 1.2 + .47 * Math.sin(phase * 2.76) * remain ** 3 + .15 * Math.sin(phase * 5.41) * remain ** 6
      if (shape === 'string') wave = (sine + .35 * Math.sin(phase * 2) + .18 * Math.sin(phase * 3)) * Math.exp(-3.6 * progress)
      if (['air', 'brush', 'breath', 'crack'].includes(shape)) {
        const white = random()
        lower += (white - lower) * (1 - Math.exp(-2 * Math.PI * frequency * .43 / rate))
        upper += (white - upper) * (1 - Math.exp(-2 * Math.PI * frequency * 2 / rate))
        const texture = (upper - lower) * 2.6
        const pulse = shape === 'crack' ? Math.exp(-5 * progress) * (.33 + .67 * Math.abs(Math.sin(time * 147)))
          : shape === 'breath' ? Math.sin(Math.PI * progress) * (.68 + .32 * Math.sin(time * 58))
            : Math.sin(Math.PI * progress) ** .7
        wave = texture * pulse
      }
      samples[from + i] += gain * envelope * wave
    }
  }
  const peak = samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0)
  const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample ** 2, 0) / samples.length)
  const volume = Math.min(.75 / peak, .14 / rms)
  const wav = Buffer.alloc(44 + samples.length * 2)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28)
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
  for (const [i, sample] of samples.entries()) wav.writeInt16LE(Math.round(sample * volume * 32767), 44 + 2 * i)
  return wav
}

const audio = new URL('../web/audio/', import.meta.url)
await mkdir(new URL('card-cues/', audio), { recursive: true })
for (const [id, file] of Object.entries(CARD_AUDIO_FILES)) {
  const clip = voices.get(id)
  if (!clip) throw new Error(`Missing sound recipe: ${id}`)
  await writeFile(new URL(file, audio), render(clip, id))
}
console.log(`Generated ${Object.keys(CARD_AUDIO_FILES).length} original card cues.`)
