import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'

const END_CARD_DURATION_SECONDS = 2.5
const END_CARD_FADE_SECONDS = 0.45
const MAIN_FADE_SECONDS = 1
const END_CARD_BACKGROUND = '0x11110f'
const END_CARD_FOREGROUND = '0xfbfbf8'
const END_CARD_FONT_PATH = path.join(process.cwd(), 'public/fonts/EBGaramond-VariableFont_wght.ttf')

async function probeDurationSeconds(filePath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1',
      filePath,
    ], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.stderr.on('data', (data) => { stderr += data.toString() })
    proc.on('close', (code) => {
      const duration = Number.parseFloat(stdout.trim())
      if (code === 0 && Number.isFinite(duration) && duration > 0) resolve(duration)
      else reject(new Error(`Unable to probe video duration: ${stderr.trim() || stdout.trim()}`))
    })
    proc.on('error', reject)
  })
}

async function probeHasAudio(filePath: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_type',
      '-of', 'default=nw=1:nk=1',
      filePath,
    ], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    proc.stdout.on('data', (data) => { stdout += data.toString() })
    proc.on('close', (code) => resolve(code === 0 && stdout.trim() === 'audio'))
    proc.on('error', () => resolve(false))
  })
}

export async function appendPianoboothEndCard(params: {
  inputPath: string
  width: number
  height: number
  fps?: number
  fontSize?: number
}): Promise<void> {
  const fps = params.fps ?? 60
  const fontSize = params.fontSize ?? Math.round(params.width * 0.08)
  const duration = await probeDurationSeconds(params.inputPath)
  const hasAudio = await probeHasAudio(params.inputPath)
  const fadeStart = Math.max(0, duration - MAIN_FADE_SECONDS)
  const cardFadeOutStart = END_CARD_DURATION_SECONDS - END_CARD_FADE_SECONDS
  const parsed = path.parse(params.inputPath)
  const tempPath = path.join(parsed.dir, `${parsed.name}.end-card.tmp${parsed.ext}`)

  await fs.access(END_CARD_FONT_PATH)
  try { await fs.unlink(tempPath) } catch {}

  const filterParts = [
    `[0:v]fade=t=out:st=${fadeStart}:d=${Math.min(MAIN_FADE_SECONDS, duration)},scale=${params.width}:${params.height}:in_range=auto:out_range=tv,setsar=1,fps=${fps},setpts=PTS-STARTPTS[mainv]`,
    `[1:v]drawtext=fontfile='${END_CARD_FONT_PATH}':text='Pianobooth':fontcolor=${END_CARD_FOREGROUND}:fontsize=${fontSize}:x=(w-text_w)/2:y=(h-text_h)/2,fade=t=in:st=0:d=${END_CARD_FADE_SECONDS},fade=t=out:st=${cardFadeOutStart}:d=${END_CARD_FADE_SECONDS},format=yuv420p,setpts=PTS-STARTPTS[cardv]`,
  ]

  if (hasAudio) {
    filterParts.push(
      `[0:a]afade=t=out:st=${fadeStart}:d=${Math.min(MAIN_FADE_SECONDS, duration)},apad=whole_dur=${duration},atrim=duration=${duration},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asetpts=PTS-STARTPTS[maina]`,
      `[2:a]atrim=duration=${END_CARD_DURATION_SECONDS},asetpts=PTS-STARTPTS[carda]`,
      '[mainv][maina][cardv][carda]concat=n=2:v=1:a=1[outv][outa]',
    )
  } else {
    filterParts.push('[mainv][cardv]concat=n=2:v=1:a=0[outv]')
  }

  const args = [
    '-y',
    '-i', params.inputPath,
    '-f', 'lavfi',
    '-i', `color=c=${END_CARD_BACKGROUND}:s=${params.width}x${params.height}:r=${fps}:d=${END_CARD_DURATION_SECONDS}`,
  ]
  if (hasAudio) {
    args.push(
      '-f', 'lavfi',
      '-i', `anullsrc=r=48000:cl=stereo:d=${END_CARD_DURATION_SECONDS}`,
    )
  }
  args.push('-filter_complex', filterParts.join(';'), '-map', '[outv]')
  if (hasAudio) args.push('-map', '[outa]')
  args.push(
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-color_range', 'tv',
    '-colorspace', 'bt709',
    '-color_primaries', 'bt709',
    '-color_trc', 'bt709',
    '-preset', 'fast',
    '-crf', '18',
  )
  if (hasAudio) args.push('-c:a', 'aac', '-b:a', '192k')
  args.push('-movflags', '+faststart', tempPath)

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] })
    ffmpeg.stdout.on('data', (data) => process.stdout.write(data.toString()))
    ffmpeg.stderr.on('data', (data) => process.stdout.write(data.toString()))
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg desktop end card failed (exit ${code})`))
    })
    ffmpeg.on('error', reject)
  })

  await fs.rename(tempPath, params.inputPath)
}
