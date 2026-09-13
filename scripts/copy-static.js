const fs = require('fs')
const path = require('path')

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const publicDir = path.join(process.cwd(), 'public')
const standalonePublicDir = path.join(process.cwd(), '.next', 'standalone', 'public')
const staticDir = path.join(process.cwd(), '.next', 'static')
const standaloneStaticDir = path.join(process.cwd(), '.next', 'standalone', '.next', 'static')

if (fs.existsSync(publicDir)) {
  copyRecursive(publicDir, standalonePublicDir)
  console.log('Copied public/ to .next/standalone/public/')
} else {
  console.warn('public/ directory not found, skipping copy')
}

if (fs.existsSync(staticDir)) {
  copyRecursive(staticDir, standaloneStaticDir)
  console.log('Copied .next/static/ to .next/standalone/.next/static/')
} else {
  console.warn('.next/static/ directory not found, skipping copy')
}
