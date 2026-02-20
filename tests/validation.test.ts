import { describe, it, expect } from 'vitest'
import { validateField } from '../src/validation.js'
import { createSchema } from '../src/schema.js'
import type { SchemaField } from '../src/types.js'

function field(overrides: Partial<SchemaField> & { type: SchemaField['type'] }): SchemaField {
  return { name: 'id', position: 0, ...overrides }
}

describe('validateField', () => {
  it('returns null for valid optional field', () => {
    expect(validateField('hello', field({ type: 'string' }), 1)).toBeNull()
  })

  it('returns null for empty optional field', () => {
    expect(validateField('', field({ type: 'string' }), 1)).toBeNull()
  })

  it('returns error for required empty field', () => {
    const err = validateField('', field({ type: 'string', required: true }), 5)
    expect(err).not.toBeNull()
    expect(err!.line).toBe(5)
    expect(err!.field).toBe('id')
    expect(err!.position).toBe(0)
    expect(err!.raw).toBe('')
    expect(err!.message).toContain('"id"')
    expect(err!.message).toContain('required')
  })

  it('returns error for required whitespace-only field', () => {
    const err = validateField('   ', field({ type: 'string', required: true }), 3)
    expect(err).not.toBeNull()
    expect(err!.line).toBe(3)
  })

  it('returns null for required non-empty field', () => {
    expect(validateField('hello', field({ type: 'string', required: true }), 1)).toBeNull()
  })

  it('includes correct position in error', () => {
    const err = validateField('', { name: 'salary', type: 'decimal', position: 2, required: true }, 10)
    expect(err).not.toBeNull()
    expect(err!.position).toBe(2)
    expect(err!.field).toBe('salary')
  })
})

describe('createSchema', () => {
  it('returns schema with fields sorted by position', () => {
    const schema = createSchema({
      delimiter: '|',
      fields: [
        { name: 'name', type: 'string', position: 1 },
        { name: 'id', type: 'number', position: 0 },
      ],
    })
    expect(schema.fields[0].name).toBe('id')
    expect(schema.fields[1].name).toBe('name')
  })

  it('applies default lineEnding: "auto"', () => {
    const schema = createSchema({
      delimiter: ',',
      fields: [{ name: 'x', type: 'string', position: 0 }],
    })
    expect(schema.lineEnding).toBe('auto')
  })

  it('applies default hasHeader: false', () => {
    const schema = createSchema({
      delimiter: ',',
      fields: [{ name: 'x', type: 'string', position: 0 }],
    })
    expect(schema.hasHeader).toBe(false)
  })

  it('preserves user-provided lineEnding and hasHeader', () => {
    const schema = createSchema({
      delimiter: ',',
      hasHeader: true,
      lineEnding: 'CRLF',
      fields: [{ name: 'x', type: 'string', position: 0 }],
    })
    expect(schema.hasHeader).toBe(true)
    expect(schema.lineEnding).toBe('CRLF')
  })

  it('throws on empty delimiter', () => {
    expect(() =>
      createSchema({ delimiter: '', fields: [{ name: 'x', type: 'string', position: 0 }] })
    ).toThrow('delimiter is required')
  })

  it('throws on empty fields array', () => {
    expect(() => createSchema({ delimiter: '|', fields: [] })).toThrow('at least one field')
  })

  it('throws on duplicate positions', () => {
    expect(() =>
      createSchema({
        delimiter: '|',
        fields: [
          { name: 'a', type: 'string', position: 0 },
          { name: 'b', type: 'string', position: 0 },
        ],
      })
    ).toThrow('positions must be unique')
  })

  it('throws on duplicate field names', () => {
    expect(() =>
      createSchema({
        delimiter: '|',
        fields: [
          { name: 'a', type: 'string', position: 0 },
          { name: 'a', type: 'string', position: 1 },
        ],
      })
    ).toThrow('names must be unique')
  })

  it('does not mutate original fields array order', () => {
    const original = [
      { name: 'b', type: 'string' as const, position: 1 },
      { name: 'a', type: 'string' as const, position: 0 },
    ]
    createSchema({ delimiter: '|', fields: original })
    // original should be unchanged
    expect(original[0].name).toBe('b')
  })
})
