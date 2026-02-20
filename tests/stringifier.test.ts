import { describe, it, expect } from 'vitest'
import { stringifyFlat } from '../src/stringifier.js'
import { parseFlat } from '../src/parser.js'
import { createSchema } from '../src/schema.js'

const schema = createSchema({
  delimiter: '|',
  fields: [
    { name: 'id', type: 'number', position: 0 },
    { name: 'name', type: 'string', position: 1 },
    { name: 'salary', type: 'decimal', position: 2, decimalPlaces: 2 },
    { name: 'active', type: 'boolean', position: 3 },
  ],
})

describe('stringifyFlat', () => {
  it('serializes records to pipe-delimited string', () => {
    const records = [{ id: 1, name: 'Alice', salary: 75000.5, active: true }]
    expect(stringifyFlat(records, schema)).toBe('1|Alice|75000.50|1')
  })

  it('serializes multiple records joined by LF', () => {
    const records = [
      { id: 1, name: 'Alice', salary: 100, active: true },
      { id: 2, name: 'Bob', salary: 200, active: false },
    ]
    const output = stringifyFlat(records, schema)
    const lines = output.split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^1\|/)
    expect(lines[1]).toMatch(/^2\|/)
  })

  it('includes header row when hasHeader is true', () => {
    const s = createSchema({ ...schema, hasHeader: true })
    const records = [{ id: 1, name: 'Alice', salary: 100, active: false }]
    const output = stringifyFlat(records, s)
    const lines = output.split('\n')
    expect(lines[0]).toBe('id|name|salary|active')
    expect(lines).toHaveLength(2)
  })

  it('uses CRLF line endings when lineEnding is CRLF', () => {
    const s = createSchema({ ...schema, lineEnding: 'CRLF', hasHeader: true })
    const records = [{ id: 1, name: 'Alice', salary: 100, active: true }]
    const output = stringifyFlat(records, s)
    expect(output).toContain('\r\n')
    expect(output.split('\r\n')).toHaveLength(2)
  })

  it('renders null and undefined as empty string', () => {
    const records = [{ id: null, name: undefined, salary: null, active: null }]
    expect(stringifyFlat(records as never, schema)).toBe('|||')
  })

  it('formats decimal with correct decimal places', () => {
    const records = [{ id: 1, name: 'x', salary: 1234.5678, active: true }]
    const output = stringifyFlat(records, schema)
    expect(output).toContain('1234.57')
  })

  it('rounds number type to integer', () => {
    const s = createSchema({
      delimiter: ',',
      fields: [{ name: 'count', type: 'number', position: 0 }],
    })
    expect(stringifyFlat([{ count: 9.7 }], s)).toBe('10')
  })

  it('uses custom trueValue and falseValue for boolean', () => {
    const s = createSchema({
      delimiter: '|',
      fields: [{ name: 'flag', type: 'boolean', position: 0, trueValue: 'Y', falseValue: 'N' }],
    })
    expect(stringifyFlat([{ flag: true }], s)).toBe('Y')
    expect(stringifyFlat([{ flag: false }], s)).toBe('N')
  })

  it('defaults boolean to "1"/"0"', () => {
    const s = createSchema({
      delimiter: '|',
      fields: [{ name: 'flag', type: 'boolean', position: 0 }],
    })
    expect(stringifyFlat([{ flag: true }], s)).toBe('1')
    expect(stringifyFlat([{ flag: false }], s)).toBe('0')
  })

  it('formats date with YYYYMMDD', () => {
    const s = createSchema({
      delimiter: '|',
      fields: [{ name: 'dob', type: 'date', position: 0, format: 'YYYYMMDD' }],
    })
    const date = new Date(Date.UTC(1985, 2, 15)) // March 15, 1985 UTC
    expect(stringifyFlat([{ dob: date }], s)).toBe('19850315')
  })

  it('formats date with DD/MM/YYYY', () => {
    const s = createSchema({
      delimiter: '|',
      fields: [{ name: 'dob', type: 'date', position: 0, format: 'DD/MM/YYYY' }],
    })
    const date = new Date(Date.UTC(1985, 2, 15))
    expect(stringifyFlat([{ dob: date }], s)).toBe('15/03/1985')
  })

  it('formats date as ISO by default', () => {
    const s = createSchema({
      delimiter: '|',
      fields: [{ name: 'ts', type: 'date', position: 0 }],
    })
    const date = new Date('2024-01-15T00:00:00.000Z')
    expect(stringifyFlat([{ ts: date }], s)).toBe('2024-01-15T00:00:00.000Z')
  })

  it('returns empty string for 0 records', () => {
    expect(stringifyFlat([], schema)).toBe('')
  })

  describe('round-trip (parseFlat → stringifyFlat)', () => {
    it('reproduces the original pipe content', () => {
      const content = '1|Alice Smith|75000.50|19850315|1'
      const employeeSchema = createSchema({
        delimiter: '|',
        fields: [
          { name: 'id', type: 'number', position: 0 },
          { name: 'name', type: 'string', position: 1 },
          { name: 'salary', type: 'decimal', position: 2, decimalPlaces: 2 },
          { name: 'dob', type: 'date', position: 3, format: 'YYYYMMDD' },
          { name: 'active', type: 'boolean', position: 4 },
        ],
      })
      const { records } = parseFlat(content, employeeSchema)
      const output = stringifyFlat(records, employeeSchema)
      expect(output).toBe(content)
    })
  })
})
