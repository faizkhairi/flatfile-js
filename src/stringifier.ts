import type { FlatFileSchema, SchemaField } from './types.js'

/**
 * Serialize typed records back to a flat file string.
 *
 * @example
 * const output = stringifyFlat(records, schema)
 * fs.writeFileSync('output.dat', output)
 */
export function stringifyFlat(
  records: Record<string, unknown>[],
  schema: FlatFileSchema
): string {
  const lineEnd = schema.lineEnding === 'CRLF' ? '\r\n' : '\n'
  const lines: string[] = []

  if (schema.hasHeader) {
    const header = schema.fields.map((f) => f.name).join(schema.delimiter)
    lines.push(header)
  }

  for (const record of records) {
    const parts = schema.fields.map((field) => serializeValue(record[field.name], field))
    lines.push(parts.join(schema.delimiter))
  }

  return lines.join(lineEnd)
}

function serializeValue(value: unknown, field: SchemaField): string {
  if (value === null || value === undefined) return ''

  switch (field.type) {
    case 'string':
      return String(value)

    case 'number':
      return String(Math.round(value as number))

    case 'decimal': {
      const places = field.decimalPlaces ?? 2
      return (value as number).toFixed(places)
    }

    case 'date': {
      const date = value as Date
      const format = field.format ?? 'ISO'
      return formatDate(date, format)
    }

    case 'boolean':
      return (value as boolean)
        ? (field.trueValue ?? '1')
        : (field.falseValue ?? '0')

    default:
      return String(value)
  }
}

function formatDate(date: Date, format: string): string {
  if (format === 'ISO') return date.toISOString()

  const y = date.getUTCFullYear().toString().padStart(4, '0')
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const d = date.getUTCDate().toString().padStart(2, '0')

  return format
    .replace('YYYY', y)
    .replace('MM', m)
    .replace('DD', d)
}
