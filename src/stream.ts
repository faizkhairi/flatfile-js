import type { FlatFileSchema } from './types.js'
import { coerceValue } from './coercion.js'
import { validateField } from './validation.js'
import { tokenizeRecord } from './delimited.js'

/**
 * Parse a large flat file using a streaming approach.
 * Yields one typed record at a time — no error collection.
 *
 * For error diagnostics, use `parseFlat` instead.
 * This function is optimized for throughput on large files.
 *
 * A quoted field (RFC 4180) may contain the delimiter, escaped `""` quotes,
 * or an embedded CR/LF, and may span multiple stream chunks. Quoting state
 * is kept across `read()` calls until the record's closing quote arrives.
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
  const lineEndingMode = schema.lineEnding ?? 'auto'
  let buffer = ''
  let lineNumber = 1
  let headerSkipped = false

  const reader = stream.getReader()

  function* drain(final: boolean): Generator<Record<string, unknown>> {
    while (true) {
      const result = tokenizeRecord(buffer, 0, schema.delimiter, lineEndingMode, final)
      if (!result) break

      const consumedText = buffer.slice(0, result.next)
      buffer = buffer.slice(result.next)
      const newlineCount = (consumedText.match(/\n/g) ?? []).length
      const recordLineNumber = lineNumber
      lineNumber += newlineCount > 0 ? newlineCount : 1

      if (schema.hasHeader && !headerSkipped) {
        headerSkipped = true
        continue
      }

      // Skip empty lines: a single empty, unquoted field
      if (result.fields.length === 1 && result.fields[0].trim() === '') continue

      yield* processRecord(result.fields, schema, recordLineNumber)
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        yield* drain(true)
        break
      }

      buffer += typeof value === 'string' ? value : decoder.decode(value, { stream: true })
      yield* drain(false)
    }
  } finally {
    reader.releaseLock()
  }
}

function* processRecord(
  fields: string[],
  schema: FlatFileSchema,
  lineNumber: number
): Generator<Record<string, unknown>> {
  const record: Record<string, unknown> = {}

  for (const field of schema.fields) {
    const raw = fields[field.position] ?? ''

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
