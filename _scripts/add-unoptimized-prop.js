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

  if (!content.includes('getOptimizedCloudinaryUrl')) continue

  // Strategy: for each Image component, add unoptimized if it has getOptimizedCloudinaryUrl
  // We do this line by line, tracking when we're inside an Image component
  
  const lines = content.split('\n')
  let inImageTag = false
  let imageHasCloudinary = false
  let imageHasUnoptimized = false
  let cloudinaryLineIndex = -1
  const newLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (line.includes('<Image') && !line.includes('</Image>')) {
      inImageTag = true
      imageHasCloudinary = line.includes('getOptimizedCloudinaryUrl')
      imageHasUnoptimized = line.includes('unoptimized')
      if (imageHasCloudinary) cloudinaryLineIndex = i
      newLines.push(line)
      continue
    }

    if (inImageTag) {
      if (line.includes('getOptimizedCloudinaryUrl')) {
        imageHasCloudinary = true
      }
      if (line.includes('unoptimized')) {
        imageHasUnoptimized = true
      }
      
      if (line.includes('/>')) {
        // End of Image tag
        if (imageHasCloudinary && !imageHasUnoptimized) {
          // Add unoptimized before />
          if (line.trimEnd().endsWith('/>')) {
            const trimmed = line.trimEnd()
            const leadingSpace = line.match(/^\s*/)[0]
            newLines.push(leadingSpace + trimmed.slice(0, -2) + ' unoptimized' + trimmed.slice(-2))
          } else {
            newLines.push(line)
          }
        } else {
          newLines.push(line)
        }
        inImageTag = false
        imageHasCloudinary = false
        imageHasUnoptimized = false
        cloudinaryLineIndex = -1
        continue
      }
      
      newLines.push(line)
      continue
    }

    newLines.push(line)
  }

  content = newLines.join('\n')

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8')
    modifiedFiles.push(filePath)
  }
}

console.log(`\nAdded unoptimized to ${modifiedFiles.length} files:\n`)
modifiedFiles.forEach(f => console.log(f.replace(PROJECT_ROOT + path.sep, '')))
