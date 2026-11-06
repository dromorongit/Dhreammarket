const os = require('os')
const fs = require('fs')

console.log('=== Build diagnostics ===')
console.log('node version:', process.version)
console.log('total mem bytes:', os.totalmem())
console.log('free mem bytes:', os.freemem())
console.log('cpu count:', os.cpus().length)

const cgroupPaths = [
  '/sys/fs/cgroup/memory.max',
  '/sys/fs/cgroup/memory/memory.limit_in_bytes',
]

for (const p of cgroupPaths) {
  if (fs.existsSync(p)) {
    console.log(`${p}:`, fs.readFileSync(p, 'utf8').trim())
  } else {
    console.log(`${p}: not present`)
  }
}

console.log('=== End diagnostics ===')
