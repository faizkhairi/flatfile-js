import type { LineEnding } from './types.js'

export interface TokenizedRecord {
  /** Raw field values for this record (quotes already unescaped). */
  fields: string[]
  /** Absolute index into `input` immediately after the consumed record. */
  next: number
}

/**
 * Attempt to tokenize one RFC 4180-style delimited record starting at
 * `start` in `input`.
 *
 * Handles the delimiter and line terminators appearing inside a quoted
 * field, and `""` as an escaped quote within a quoted field.
 *
 * Returns `null` when the input runs out before an unquoted record
 * terminator is found and `final` is `false`. The caller should buffer
 * more input (e.g. the next stream chunk) and retry from the same `start`.
 * When `final` is `true`, any remaining content is flushed as the last
 * record (this also covers a file whose last line has no trailing
 * terminator, and best-effort recovery from an unterminated quote).
 */
export function tokenizeRecord(
  input: string,
  start: number,
  delimiter: string,
  lineEndingMode: LineEnding,
  final: boolean
): TokenizedRecord | null {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  let fieldStart = true
  let i = start
  const len = input.length

  while (i < len) {
    const ch = input[i]

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          current += '"'
          i += 2
        } else {
          inQuotes = false
          i += 1
        }
      } else {
        current += ch
        i += 1
      }
      continue
    }

    if (fieldStart && ch === '"') {
      inQuotes = true
      fieldStart = false
      i += 1
      continue
    }

    if (input.startsWith(delimiter, i)) {
      fields.push(current)
      current = ''
      fieldStart = true
      i += delimiter.length
      continue
    }

    const termLength = terminatorLengthAt(input, i, lineEndingMode)
    if (termLength > 0) {
      fields.push(current)
      return { fields, next: i + termLength }
    }

    current += ch
    fieldStart = false
    i += 1
  }

  if (!final) return null

  if (current !== '' || fields.length > 0) {
    fields.push(current)
  }
  if (fields.length === 0) return null

  return { fields, next: len }
}

function terminatorLengthAt(input: string, i: number, mode: LineEnding): number {
  const ch = input[i]

  if (mode === 'LF') {
    return ch === '\n' ? 1 : 0
  }

  if (mode === 'CRLF') {
    return ch === '\r' && input[i + 1] === '\n' ? 2 : 0
  }

  // 'auto': matches /\r?\n/, a lone '\r' not followed by '\n' is not a terminator
  if (ch === '\r' && input[i + 1] === '\n') return 2
  if (ch === '\n') return 1
  return 0
}
