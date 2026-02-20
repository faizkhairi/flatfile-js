import type { SchemaField } from './types.js'

const DEFAULT_TRUE_VALUES = new Set(['true', '1', 'y', 'yes'])
const DEFAULT_FALSE_VALUES = new Set(['false', '0', 'n', 'no'])

/**
 * Coerce a raw string value to the typed value specified by the field schema.
 * Throws TypeError if coercion fails.
 */
export function coerceValue(raw: string, field: SchemaField): unknown {
  const trimmed = raw.trim()

  switch (field.type) {
    case 'string':
      return trimmed

    case 'number': {
      const n = Number(trimmed)
      if (isNaN(n) || trimmed === '') {
        throw new TypeError(`Cannot convert "${trimmed}" to number`)
      }
      return n
    }

    case 'decimal': {
      const d = parseFloat(trimmed)
      if (isNaN(d) || trimmed === '') {
        throw new TypeError(`Cannot convert "${trimmed}" to decimal`)
      }
      const places = field.decimalPlaces ?? 2
      return parseFloat(d.toFixed(places))
    }

    case 'date': {
      const format = field.format ?? 'ISO'
      const date = parseDate(trimmed, format)
      if (!date || isNaN(date.getTime())) {
        throw new TypeError(`Cannot parse "${trimmed}" as date with format "${format}"`)
      }
      return date
    }

    case 'boolean': {
      const lower = trimmed.toLowerCase()
      const trueVals = field.trueValue
        ? new Set([field.trueValue.toLowerCase()])
        : DEFAULT_TRUE_VALUES
      const falseVals = field.falseValue
        ? new Set([field.falseValue.toLowerCase()])
        : DEFAULT_FALSE_VALUES

      if (trueVals.has(lower)) return true
      if (falseVals.has(lower)) return false
      throw new TypeError(`Cannot convert "${trimmed}" to boolean`)
    }
  }
}

function parseDate(value: string, format: string): Date | null {
  if (format === 'ISO' || format === 'YYYY-MM-DD') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }

  // Extract format token order
  const yPos = format.indexOf('YYYY')
  const mPos = format.indexOf('MM')
  const dPos = format.indexOf('DD')

  if (yPos === -1 || mPos === -1 || dPos === -1) {
    // Unknown format — try native Date parsing
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }

  // Build separator-aware regex from format
  const separators = format.replace(/YYYY|MM|DD/g, '').split('')
  const sep = separators[0] ? `\\${separators[0]}` : ''

  let pattern: string
  if (format === 'YYYYMMDD') {
    pattern = '^(\\d{4})(\\d{2})(\\d{2})$'
  } else {
    // Insert separator between tokens
    pattern = `^(\\d{2,4})${sep}(\\d{2})${sep}(\\d{2,4})$`
  }

  const match = new RegExp(pattern).exec(value)
  if (!match) return null

  // Map capture groups to year/month/day based on format token positions
  const tokens = [match[1], match[2], match[3]]
  const order = [
    { pos: yPos, key: 'year' },
    { pos: mPos, key: 'month' },
    { pos: dPos, key: 'day' },
  ].sort((a, b) => a.pos - b.pos)

  const parts: Record<string, number> = {}
  order.forEach(({ key }, i) => {
    parts[key] = parseInt(tokens[i], 10)
  })

  if (!parts['year'] || !parts['month'] || !parts['day']) return null

  // Use UTC to avoid timezone offset affecting the date
  return new Date(Date.UTC(parts['year'], parts['month'] - 1, parts['day']))
}
