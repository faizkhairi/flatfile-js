import type { SchemaField, ParseError } from './types.js'

/**
 * Validate a raw field value against schema constraints.
 * Returns a ParseError if validation fails, or null if valid.
 */
export function validateField(
  raw: string,
  field: SchemaField,
  lineNumber: number
): ParseError | null {
  const trimmed = raw.trim()

  if (field.required && trimmed === '') {
    return {
      line: lineNumber,
      field: field.name,
      position: field.position,
      message: `Field "${field.name}" at position ${field.position} is required but empty`,
      raw,
    }
  }

  return null
}
