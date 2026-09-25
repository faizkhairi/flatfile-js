import type { FlatFileSchema, ParseResult, ParseError } from './types.js'
import { coerceValue } from './coercion.js'
import { validateField } from './validation.js'
import { tokenizeRecord } from './delimited.js'

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
  const lineEndingMode = schema.lineEnding ?? 'auto'
  const records: Record<string, unknown>[] = []
  const errors: ParseError[] = []

  const startLine = schema.hasHeader ? 1 : 0

  let pos = 0
  let recordIndex = 0
  let lineNumber = 1

  while (pos < content.length) {
    const result = tokenizeRecord(content, pos, schema.delimiter, lineEndingMode, true)
    if (!result) break

    const consumedText = content.slice(pos, result.next)
    const newlineCount = (consumedText.match(/\n/g) ?? []).length
    const recordLineNumber = lineNumber
    lineNumber += newlineCount > 0 ? newlineCount : 1
    pos = result.next

    const isHeaderLine = recordIndex < startLine
    recordIndex++
    if (isHeaderLine) continue

    // Skip empty lines (e.g. trailing newline): a single empty, unquoted field
    if (result.fields.length === 1 && result.fields[0].trim() === '') continue

    const parts = result.fields
    const record: Record<string, unknown> = {}

    for (const field of schema.fields) {
      const raw = parts[field.position] ?? ''

      // Validate first
      const validationError = validateField(raw, field, recordLineNumber)
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
          line: recordLineNumber,
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
