import type { FlatFileSchema } from './types.js'

/**
 * Create and validate a flat file schema.
 * Validates at creation time (fail fast) and returns a normalized schema
 * with fields sorted by position.
 *
 * @example
 * const schema = createSchema({
 *   delimiter: '|',
 *   fields: [
 *     { name: 'id', type: 'number', position: 0 },
 *     { name: 'name', type: 'string', position: 1, required: true },
 *   ]
 * })
 */
export function createSchema(config: FlatFileSchema): FlatFileSchema {
  if (!config.delimiter) {
    throw new Error('flatfile-js: delimiter is required')
  }
  if (!config.fields || config.fields.length === 0) {
    throw new Error('flatfile-js: at least one field is required')
  }

  const positions = config.fields.map((f) => f.position)
  if (new Set(positions).size !== positions.length) {
    throw new Error('flatfile-js: field positions must be unique')
  }

  const names = config.fields.map((f) => f.name)
  if (new Set(names).size !== names.length) {
    throw new Error('flatfile-js: field names must be unique')
  }

  return {
    ...config,
    lineEnding: config.lineEnding ?? 'auto',
    hasHeader: config.hasHeader ?? false,
    fields: [...config.fields].sort((a, b) => a.position - b.position),
  }
}
