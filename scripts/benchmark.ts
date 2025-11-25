import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Database } from 'bun:sqlite'

// --- CONFIGURATION ---
const TEST_FILE_SOURCE = path.join('midi', 'test_videos', 'test.mid')
const RENDER_COMMAND = 'bun run render:next -- --dev'
const SERVER_URL = 'http://localhost:5173'
const DB_FILE = 'benchmarks.db'

// --- DATABASE SETUP ---
const db = new Database(DB_FILE)

function initDB() {
  db.query(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commit_hash TEXT,
      branch TEXT,
      duration_seconds REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()
}

function saveResult(commit: string, branch: string, time: number | null) {
  if (time === null) return
  db.query(`
    INSERT INTO results (commit_hash, branch, duration_seconds)
    VALUES (?, ?, ?)
  `).run(commit, branch, time)
}

function printHistory() {
  const history = db.query(`
    SELECT commit_hash, branch, duration_seconds, created_at
    FROM results
    ORDER BY created_at DESC
    LIMIT 10
  `).all()

  console.log('\n📜 RECENT BENCHMARK HISTORY')
  console.table(history)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitForServer() {
  process.stdout.write('⏳ Waiting for server...')
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(SERVER_URL)
      if (res.ok) {
        console.log(' Ready!')
        return true
      }
    } catch {}
    await sleep(1000)
    process.stdout.write('.')
  }
  throw new Error('Server timed out')
}

async function run() {
  initDB()

  const branch = execSync('git branch --show-current').toString().trim()
  const currentCommit = execSync('git rev-parse --short HEAD').toString().trim()

  console.log(`\n🚀 STARTING BENCHMARK: ${TEST_FILE_SOURCE}`)

  try {
    console.log(`\n-------------------------------------------`)
    console.log(`Commit: ${currentCommit}`)
    console.log(`Branch: ${branch}`)
    console.log(`-------------------------------------------`)

    const sourcePath = path.resolve(TEST_FILE_SOURCE)
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Test file not found at: ${sourcePath}`)
    }

    execSync('bun install', { stdio: 'ignore' })

    const server = spawn('bun', ['dev'], {
      detached: true,
      stdio: 'ignore',
    })

    let duration: number | null = null

    try {
      await waitForServer()

      const start = performance.now()
      execSync(RENDER_COMMAND, { stdio: 'inherit' })
      const end = performance.now()

      duration = (end - start) / 1000
      console.log(`✅ TIME: ${duration.toFixed(2)}s`)

      saveResult(currentCommit, branch, duration)
    } catch (err) {
      console.error(`❌ Failed on ${currentCommit}`)
    } finally {
      if (server.pid) process.kill(-server.pid)
      await sleep(2000)
    }
  } catch (e) {
    console.error('Critical Error:', e)
  }

  printHistory()
}

run()
