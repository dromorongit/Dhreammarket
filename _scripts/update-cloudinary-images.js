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
    // skip inaccessible dirs
  }
  return results
}

const files = findTsxFiles(PROJECT_ROOT)
const modifiedFiles = []

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf8')
  const original = content

  // Only process files that import next/image and have Cloudinary-like content
  if (!content.includes("from 'next/image'") && !content.includes('from "next/image"')) continue
  if (!content.includes('cloudinary') && !content.includes('images[0]') && !content.includes('vendor.logo') && !content.includes('service.thumbnail') && !content.includes('brand.logo') && !content.includes('store.logo') && !content.includes('item.image') && !content.includes('item.images') && !content.includes('image.url') && !content.includes('product.image') && !content.includes('productImage') && !content.includes('item.productImage') && !content.includes('service.images')) continue

  // Add import if not present
  if (!content.includes('cloudinary-image')) {
    const nextImageImportMatch = content.match(/from ['"]next\/image['"];?\n/)
    if (nextImageImportMatch) {
      const insertPoint = nextImageImportMatch.index + nextImageImportMatch[0].length
      content = content.slice(0, insertPoint) + "import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'\n" + content.slice(insertPoint)
    }
  }

  // Replace src patterns
  const replacements = [
    [/src=\{product\.images\[0\]\.url\}/g, "src={getOptimizedCloudinaryUrl(product.images[0].url, 400)}"],
    [/src=\{product\.images!\[0\]\.url\}/g, "src={getOptimizedCloudinaryUrl(product.images![0].url, 400)}"],
    [/src=\{item\.images\[0\]\.url\}/g, "src={getOptimizedCloudinaryUrl(item.images[0].url, 400)}"],
    [/src=\{entity\.images\[0\]\.url\}/g, "src={getOptimizedCloudinaryUrl(entity.images[0].url, 400)}"],
    [/src=\{product\.images\[0\]\?\.url\}/g, "src={getOptimizedCloudinaryUrl(product.images[0]?.url, 400)}"],
    [/src=\{product\.images\?\.\[0\]\?\.url\}/g, "src={getOptimizedCloudinaryUrl(product.images?.[0]?.url, 400)}"],
    [/src=\{vendor\.logo\}/g, "src={getOptimizedCloudinaryUrl(vendor.logo, 80)}"],
    [/src=\{service\.thumbnail\}/g, "src={getOptimizedCloudinaryUrl(service.thumbnail, 400)}"],
    [/src=\{brand\.logo\}/g, "src={getOptimizedCloudinaryUrl(brand.logo, 80)}"],
    [/src=\{store\.logo\}/g, "src={getOptimizedCloudinaryUrl(store.logo, 80)}"],
    [/src=\{item\.image\}/g, "src={getOptimizedCloudinaryUrl(item.image, 400)}"],
    [/src=\{item\.thumbnail\}/g, "src={getOptimizedCloudinaryUrl(item.thumbnail, 400)}"],
    [/src=\{image\.url\}/g, "src={getOptimizedCloudinaryUrl(image.url, 400)}"],
    [/src=\{product\.image\}/g, "src={getOptimizedCloudinaryUrl(product.image, 400)}"],
    [/src=\{item\.productImage\}/g, "src={getOptimizedCloudinaryUrl(item.productImage, 400)}"],
    [/src=\{service\.images\[0\]\?\.imageUrl \|\| ''\}/g, "src={getOptimizedCloudinaryUrl(service.images[0]?.imageUrl || '', 400)}"],
    [/\{p\.images\?\.\[0\] \? <Image src=\{p\.images\[0\]\.url\}/g, "{p.images?.[0] ? <Image src={getOptimizedCloudinaryUrl(p.images[0].url, 400)}"],
  ]

  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement)
  }

  // Add unoptimized prop to Image components that now use getOptimizedCloudinaryUrl
  // Handle single-line Image tags
  content = content.replace(
    /(<Image\s+[^>]*src=\{getOptimizedCloudinaryUrl\([^)]+\)[^>]*?)\/>/g,
    (match, prefix) => {
      if (match.includes('unoptimized')) return match
      return prefix + ' unoptimized />'
    }
  )

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8')
    modifiedFiles.push(filePath)
  }
}

console.log(`\nModified ${modifiedFiles.length} files:\n`)
modifiedFiles.forEach(f => console.log(f.replace(PROJECT_ROOT + path.sep, '')))
