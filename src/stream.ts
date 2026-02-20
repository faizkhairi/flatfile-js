import type { FlatFileSchema } from './types.js'
import { coerceValue } from './coercion.js'
import { validateField } from './validation.js'

/**
 * Parse a large flat file using a streaming approach.
 * Yields one typed record at a time — no error collection.
 *
 * For error diagnostics, use `parseFlat` instead.
 * This function is optimized for throughput on large files.
 *
 * @example
 * import { createReadStream } from 'node:fs'
 *
 * const stream = createReadStream('large-file.dat')
 * for await (const record of parseStream(stream, schema)) {
 *   await db.insert(record)
 * }
 */
export async function* parseStream(
  stream: ReadableStream<Uint8Array>,
  schema: FlatFileSchema
): AsyncGenerator<Record<string, unknown>> {
  const decoder = new TextDecoder()
  let buffer = ''
  let lineNumber = 0
  let headerSkipped = false

  const reader = stream.getReader()

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // Process any remaining content in the buffer
        if (buffer.trim()) {
          lineNumber++
          if (!(schema.hasHeader && !headerSkipped)) {
            yield* processLine(buffer, schema, lineNumber)
          }
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Split on line endings, keep last incomplete chunk in buffer
      const parts = buffer.split(/\r?\n/)
      buffer = parts.pop() ?? ''

      for (const line of parts) {
        lineNumber++

        if (schema.hasHeader && !headerSkipped) {
          headerSkipped = true
          continue
        }

        if (line.trim() === '') continue
        yield* processLine(line, schema, lineNumber)
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function* processLine(
  line: string,
  schema: FlatFileSchema,
  lineNumber: number
): Generator<Record<string, unknown>> {
  const parts = line.split(schema.delimiter)
  const record: Record<string, unknown> = {}

  for (const field of schema.fields) {
    const raw = parts[field.position] ?? ''

    const validationError = validateField(raw, field, lineNumber)
    if (validationError) {
      record[field.name] = null
      continue
    }

    if (raw.trim() === '') {
      record[field.name] = null
      continue
    }

    try {
      record[field.name] = coerceValue(raw, field)
    } catch {
      record[field.name] = null
    }
  }

  yield record
}
