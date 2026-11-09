export type Chunk = { chunkIndex: number; content: string }

const DEFAULT_MAX_WORDS = 200

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((t) => t.length > 0).length
}

/**
 * Split document content into paragraph-based chunks of roughly maxWords words
 * each, ordered by chunkIndex. Paragraphs are never split across chunks; a
 * single paragraph longer than maxWords forms its own chunk.
 */
export function chunkSupportDocument(content: string, maxWords: number = DEFAULT_MAX_WORDS): Chunk[] {
  const paragraphs = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  const chunks: Chunk[] = []
  let current: string[] = []
  let currentWords = 0
  let index = 0

  const flush = (): void => {
    if (current.length > 0) {
      chunks.push({ chunkIndex: index++, content: current.join('\n\n') })
      current = []
      currentWords = 0
    }
  }

  for (const paragraph of paragraphs) {
    const words = wordCount(paragraph)
    if (currentWords + words > maxWords && current.length > 0) {
      flush()
    }
    current.push(paragraph)
    currentWords += words
  }

  flush()
  return chunks
}
