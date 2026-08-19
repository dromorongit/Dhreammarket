const fs = require('fs')
const path = require('path')

const PROJECT_ROOT = 'C:\\Users\\Dromor Narh\\Desktop\\GithubRepos\\Dhreamarket'

function findTsxFiles(dir) {
  let results = []
  try {
    const list = fs.readdirSync(dir)
    for (const file of list) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
        results = results.concat(findTsxFiles(filePath))
      } else if (file.endsWith('.tsx')) {
        results.push(filePath)
      }
    }
  } catch (e) {
    // skip
  }
  return results
}

const files = findTsxFiles(PROJECT_ROOT)
const modifiedFiles = []

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf8')
  const original = content

  // Only process files that use getOptimizedCloudinaryUrl but don't import it
  if (!content.includes('getOptimizedCloudinaryUrl')) continue
  if (content.includes("import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'")) continue

  // Add import after next/image import or at the top of other imports
  const nextImageImportMatch = content.match(/from ['"]next\/image['"];?\n/)
  if (nextImageImportMatch) {
    const insertPoint = nextImageImportMatch.index + nextImageImportMatch[0].length
    content = content.slice(0, insertPoint) + "import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'\n" + content.slice(insertPoint)
  } else {
    // Add after the last import line
    const lastImportMatch = content.match(/(import .+from .+;?\n)(?!.*import )/s)
    if (lastImportMatch) {
      const insertPoint = lastImportMatch.index + lastImportMatch[0].length
      content = content.slice(0, insertPoint) + "import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'\n" + content.slice(insertPoint)
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8')
    modifiedFiles.push(filePath)
  }
}

console.log(`\nAdded import to ${modifiedFiles.length} files:\n`)
modifiedFiles.forEach(f => console.log(f.replace(PROJECT_ROOT + path.sep, '')))
