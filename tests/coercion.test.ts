import { describe, it, expect } from 'vitest'
import { coerceValue } from '../src/coercion.js'
import type { SchemaField } from '../src/types.js'

function field(overrides: Partial<SchemaField> & { type: SchemaField['type'] }): SchemaField {
  return { name: 'test', position: 0, ...overrides }
}

describe('coerceValue', () => {
  describe('string', () => {
    it('returns trimmed string', () => {
      expect(coerceValue('  hello  ', field({ type: 'string' }))).toBe('hello')
    })

    it('returns empty string for whitespace-only input', () => {
      expect(coerceValue('   ', field({ type: 'string' }))).toBe('')
    })

    it('preserves internal spaces', () => {
      expect(coerceValue('Alice Smith', field({ type: 'string' }))).toBe('Alice Smith')
    })
  })

  describe('number', () => {
    it('converts integer string', () => {
      expect(coerceValue('1001', field({ type: 'number' }))).toBe(1001)
    })

    it('converts float string', () => {
      expect(coerceValue('3.14', field({ type: 'number' }))).toBe(3.14)
    })

    it('converts negative number', () => {
      expect(coerceValue('-42', field({ type: 'number' }))).toBe(-42)
    })

    it('throws TypeError on non-numeric string', () => {
      expect(() => coerceValue('abc', field({ type: 'number' }))).toThrow(TypeError)
    })

    it('throws TypeError on empty string', () => {
      expect(() => coerceValue('', field({ type: 'number' }))).toThrow(TypeError)
    })

    it('throws TypeError on whitespace-only string', () => {
      expect(() => coerceValue('  ', field({ type: 'number' }))).toThrow(TypeError)
    })
  })

  describe('decimal', () => {
    it('applies default 2 decimal places', () => {
      expect(coerceValue('75000.50', field({ type: 'decimal' }))).toBe(75000.5)
    })

    it('rounds to custom decimalPlaces', () => {
      expect(coerceValue('3.14159', field({ type: 'decimal', decimalPlaces: 3 }))).toBe(3.142)
    })

    it('applies 0 decimal places (integer-like)', () => {
      expect(coerceValue('42.9', field({ type: 'decimal', decimalPlaces: 0 }))).toBe(43)
    })

    it('handles negative decimal', () => {
      expect(coerceValue('-1200.00', field({ type: 'decimal' }))).toBe(-1200)
    })

    it('throws TypeError on non-numeric string', () => {
      expect(() => coerceValue('abc', field({ type: 'decimal' }))).toThrow(TypeError)
    })
  })

  describe('date', () => {
    it('parses YYYYMMDD format', () => {
      const d = coerceValue('19850315', field({ type: 'date', format: 'YYYYMMDD' })) as Date
      expect(d.getUTCFullYear()).toBe(1985)
      expect(d.getUTCMonth()).toBe(2) // March is 0-indexed month 2
      expect(d.getUTCDate()).toBe(15)
    })

    it('parses DD/MM/YYYY format', () => {
      const d = coerceValue('15/03/1985', field({ type: 'date', format: 'DD/MM/YYYY' })) as Date
      expect(d.getUTCFullYear()).toBe(1985)
      expect(d.getUTCMonth()).toBe(2)
      expect(d.getUTCDate()).toBe(15)
    })

    it('parses MM/DD/YYYY format', () => {
      const d = coerceValue('03/15/1985', field({ type: 'date', format: 'MM/DD/YYYY' })) as Date
      expect(d.getUTCFullYear()).toBe(1985)
      expect(d.getUTCMonth()).toBe(2)
      expect(d.getUTCDate()).toBe(15)
    })

    it('parses YYYY-MM-DD format', () => {
      const d = coerceValue('2024-01-15', field({ type: 'date', format: 'YYYY-MM-DD' })) as Date
      expect(d instanceof Date).toBe(true)
      expect(isNaN(d.getTime())).toBe(false)
    })

    it('parses ISO format by default', () => {
      const d = coerceValue('2024-01-15T00:00:00.000Z', field({ type: 'date' })) as Date
      expect(d instanceof Date).toBe(true)
      expect(isNaN(d.getTime())).toBe(false)
    })

    it('throws TypeError on invalid date string', () => {
      expect(() => coerceValue('not-a-date', field({ type: 'date' }))).toThrow(TypeError)
    })

    it('throws TypeError when value does not match format', () => {
      // ISO date provided but YYYYMMDD expected
      expect(() =>
        coerceValue('2024-01-15', field({ type: 'date', format: 'YYYYMMDD' }))
      ).toThrow(TypeError)
    })
  })

  describe('boolean', () => {
    it.each(['true', '1', 'y', 'yes', 'YES', 'True', 'Y'])(
      'converts "%s" to true (default true set)',
      (val) => {
        expect(coerceValue(val, field({ type: 'boolean' }))).toBe(true)
      }
    )

    it.each(['false', '0', 'n', 'no', 'NO', 'False', 'N'])(
      'converts "%s" to false (default false set)',
      (val) => {
        expect(coerceValue(val, field({ type: 'boolean' }))).toBe(false)
      }
    )

    it('uses custom trueValue (case-insensitive)', () => {
      const f = field({ type: 'boolean', trueValue: 'Y' })
      expect(coerceValue('Y', f)).toBe(true)
      expect(coerceValue('y', f)).toBe(true)
    })

    it('uses custom falseValue (case-insensitive)', () => {
      const f = field({ type: 'boolean', falseValue: 'N' })
      expect(coerceValue('N', f)).toBe(false)
      expect(coerceValue('n', f)).toBe(false)
    })

    it('throws TypeError on unrecognized value', () => {
      expect(() => coerceValue('maybe', field({ type: 'boolean' }))).toThrow(TypeError)
    })

    it('throws TypeError on empty string', () => {
      expect(() => coerceValue('', field({ type: 'boolean' }))).toThrow(TypeError)
    })
  })
})
