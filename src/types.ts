export type FieldType = 'string' | 'number' | 'decimal' | 'date' | 'boolean'
export type LineEnding = 'LF' | 'CRLF' | 'auto'

export interface SchemaField {
  /** Field name used as the key in parsed records */
  name: string
  /** Data type for coercion */
  type: FieldType
  /** 0-indexed position in the delimited line */
  position: number
  /** If true, empty values cause a ParseError. Default: false */
  required?: boolean
  /** For 'decimal': number of decimal places. Default: 2 */
  decimalPlaces?: number
  /**
   * For 'date': format string.
   * Supported: 'YYYYMMDD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'ISO'
   * Default: 'ISO'
   */
  format?: string
  /** For 'boolean': string that represents true. Default: matches 'true','1','y','yes' */
  trueValue?: string
  /** For 'boolean': string that represents false. Default: matches 'false','0','n','no' */
  falseValue?: string
}

export interface FlatFileSchema {
  /** Field delimiter character. Common values: '|', ',', '\t' */
  delimiter: string
  /** Field definitions */
  fields: SchemaField[]
  /** If true, first line is treated as a header and skipped. Default: false */
  hasHeader?: boolean
  /** Line ending style. Default: 'auto' (handles both LF and CRLF) */
  lineEnding?: LineEnding
}

export interface ParseError {
  /** 1-indexed line number in the file */
  line: number
  /** Field name that caused the error */
  field: string
  /** 0-indexed position in the line */
  position: number
  /** Human-readable error message */
  message: string
  /** Raw string value that caused the error */
  raw: string
}

export interface ParseResult<T extends Record<string, unknown> = Record<string, unknown>> {
  records: T[]
  errors: ParseError[]
}
