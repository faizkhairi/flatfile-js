import type { FlatFileSchema, ParseResult, ParseError } from './types.js'
import { coerceValue } from './coercion.js'
import { validateField } from './validation.js'

function splitLines(content: string, lineEnding: string): string[] {
  if (lineEnding === 'CRLF') return content.split('\r\n')
  if (lineEnding === 'LF') return content.split('\n')
  return content.split(/\r?\n/)
}

/**
 * Parse a flat file string into typed records.
 *
 * Records with field errors are still included in `records` (with `null` for
 * failed fields). This allows callers to see partial data alongside errors,
 * which is the expected pattern in enterprise data processing.
 *
 * @example
 * const { records, errors } = parseFlat(fileContent, schema)
 * if (errors.length > 0) {
 *   console.error('Parse errors:', errors)
 * }
 * records.forEach(record => process(record))
 */
export function parseFlat(
  content: string,
  schema: FlatFileSchema
): ParseResult {
  const lines = splitLines(content, schema.lineEnding ?? 'auto')
  const records: Record<string, unknown>[] = []
  const errors: ParseError[] = []

  const startLine = schema.hasHeader ? 1 : 0

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    // Skip empty lines (e.g. trailing newline)
    if (line.trim() === '') continue

    const parts = line.split(schema.delimiter)
    const record: Record<string, unknown> = {}

    for (const field of schema.fields) {
      const raw = parts[field.position] ?? ''

      // Validate first
      const validationError = validateField(raw, field, lineNumber)
      if (validationError) {
        errors.push(validationError)
        record[field.name] = null
        continue
      }

      // Empty optional field → null
      if (raw.trim() === '') {
        record[field.name] = null
        continue
      }

      // Coerce to typed value
      try {
        record[field.name] = coerceValue(raw, field)
      } catch (err) {
        errors.push({
          line: lineNumber,
          field: field.name,
          position: field.position,
          message: err instanceof Error ? err.message : String(err),
          raw,
        })
        record[field.name] = null
      }
    }

    records.push(record)
  }

  return { records, errors }
}
