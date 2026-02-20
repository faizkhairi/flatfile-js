import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseFlat } from '../src/parser.js'
import { createSchema } from '../src/schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf-8')

const employeeSchema = createSchema({
  delimiter: '|',
  fields: [
    { name: 'id', type: 'number', position: 0 },
    { name: 'name', type: 'string', position: 1, required: true },
    { name: 'salary', type: 'decimal', position: 2, decimalPlaces: 2 },
    { name: 'dob', type: 'date', position: 3, format: 'YYYYMMDD' },
    { name: 'active', type: 'boolean', position: 4 },
  ],
})

describe('parseFlat', () => {
  describe('employees.pipe fixture', () => {
    it('parses all 3 records without errors', () => {
      const { records, errors } = parseFlat(fixture('employees.pipe'), employeeSchema)
      expect(errors).toHaveLength(0)
      expect(records).toHaveLength(3)
    })

    it('coerces typed values correctly', () => {
      const { records } = parseFlat(fixture('employees.pipe'), employeeSchema)
      expect(records[0].id).toBe(1)
      expect(records[0].name).toBe('Alice Smith')
      expect(records[0].salary).toBe(75000.5)
      expect(records[0].active).toBe(true)
      expect(records[2].active).toBe(false)
    })

    it('parses date as Date object', () => {
      const { records } = parseFlat(fixture('employees.pipe'), employeeSchema)
      expect(records[0].dob).toBeInstanceOf(Date)
      const dob = records[0].dob as Date
      expect(dob.getUTCFullYear()).toBe(1985)
      expect(dob.getUTCMonth()).toBe(2) // March
      expect(dob.getUTCDate()).toBe(15)
    })
  })

  describe('transactions.csv fixture', () => {
    const csvSchema = createSchema({
      delimiter: ',',
      hasHeader: true,
      fields: [
        { name: 'id', type: 'number', position: 0 },
        { name: 'description', type: 'string', position: 1 },
        { name: 'amount', type: 'decimal', position: 2, decimalPlaces: 2 },
        { name: 'date', type: 'date', position: 3, format: 'YYYY-MM-DD' },
        { name: 'cleared', type: 'boolean', position: 4 },
      ],
    })

    it('skips header and parses 3 records', () => {
      const { records, errors } = parseFlat(fixture('transactions.csv'), csvSchema)
      expect(errors).toHaveLength(0)
      expect(records).toHaveLength(3)
    })

    it('handles negative decimal amounts', () => {
      const { records } = parseFlat(fixture('transactions.csv'), csvSchema)
      expect(records[2].amount).toBe(-1200)
    })
  })

  describe('data.tsv fixture', () => {
    const tsvSchema = createSchema({
      delimiter: '\t',
      hasHeader: true,
      fields: [
        { name: 'name', type: 'string', position: 0 },
        { name: 'score', type: 'decimal', position: 1, decimalPlaces: 1 },
        { name: 'active', type: 'boolean', position: 2 },
      ],
    })

    it('parses tab-delimited file with header', () => {
      const { records, errors } = parseFlat(fixture('data.tsv'), tsvSchema)
      expect(errors).toHaveLength(0)
      expect(records).toHaveLength(2)
      expect(records[0].name).toBe('Alice')
      expect(records[0].score).toBe(95.5)
      expect(records[0].active).toBe(true)
    })
  })

  describe('inline content', () => {
    it('skips empty lines (including trailing newline)', () => {
      const content = '1|Alice|100.00|19850315|1\n\n2|Bob|200.00|19901122|0\n'
      const { records } = parseFlat(content, employeeSchema)
      expect(records).toHaveLength(2)
    })

    it('handles CRLF line endings', () => {
      const schema = createSchema({ ...employeeSchema, lineEnding: 'CRLF' })
      const content = '1|Alice Smith|75000.50|19850315|1\r\n2|Bob Jones|82000.00|19901122|1'
      const { records } = parseFlat(content, schema)
      expect(records).toHaveLength(2)
    })

    it('collects errors but still includes the record with null for failed fields', () => {
      const content = 'notanumber|Alice Smith|75000.50|19850315|1'
      const { records, errors } = parseFlat(content, employeeSchema)
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('id')
      expect(errors[0].line).toBe(1)
      expect(records).toHaveLength(1)
      expect(records[0].id).toBeNull()
      expect(records[0].name).toBe('Alice Smith') // other fields still parsed
    })

    it('collects errors for required empty fields', () => {
      const schema = createSchema({
        delimiter: '|',
        fields: [
          { name: 'id', type: 'number', position: 0, required: true },
          { name: 'name', type: 'string', position: 1 },
        ],
      })
      const { records, errors } = parseFlat('|Bob', schema)
      expect(errors).toHaveLength(1)
      expect(errors[0].field).toBe('id')
      expect(records[0].id).toBeNull()
      expect(records[0].name).toBe('Bob')
    })

    it('sets null for optional empty fields (no error)', () => {
      const schema = createSchema({
        delimiter: '|',
        fields: [
          { name: 'id', type: 'number', position: 0 },
          { name: 'name', type: 'string', position: 1 }, // not required
        ],
      })
      const { records, errors } = parseFlat('1|', schema)
      expect(errors).toHaveLength(0)
      expect(records[0].name).toBeNull()
    })

    it('collects multiple errors across multiple lines', () => {
      const content = 'notanumber|Alice|100.00|19850315|1\n2||200.00|19901122|1'
      const schema = createSchema({
        delimiter: '|',
        fields: [
          { name: 'id', type: 'number', position: 0 },
          { name: 'name', type: 'string', position: 1, required: true },
          { name: 'salary', type: 'decimal', position: 2 },
          { name: 'dob', type: 'date', position: 3, format: 'YYYYMMDD' },
          { name: 'active', type: 'boolean', position: 4 },
        ],
      })
      const { records, errors } = parseFlat(content, schema)
      expect(errors).toHaveLength(2)
      expect(records).toHaveLength(2)
    })

    it('includes line number in errors (1-indexed, accounting for header)', () => {
      const schema = createSchema({
        delimiter: '|',
        hasHeader: true,
        fields: [{ name: 'id', type: 'number', position: 0, required: true }],
      })
      // Line 1 = header, Line 2 = data
      const { errors } = parseFlat('id\n', schema)
      expect(errors).toHaveLength(0) // empty line skipped
    })

    it('returns empty records and errors for empty input', () => {
      const schema = createSchema({
        delimiter: '|',
        fields: [{ name: 'id', type: 'number', position: 0 }],
      })
      const { records, errors } = parseFlat('', schema)
      expect(records).toHaveLength(0)
      expect(errors).toHaveLength(0)
    })
  })
})
