# flatfile-js

Schema-first parser and generator for pipe, comma, and tab-delimited flat files — with type coercion, validation, and streaming support.

[![CI](https://github.com/faizkhairi/flatfile-js/actions/workflows/ci.yml/badge.svg)](https://github.com/faizkhairi/flatfile-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@faizkhairi/flatfile-js)](https://www.npmjs.com/package/@faizkhairi/flatfile-js)

---

## Why flatfile-js?

Enterprise data exchange often uses pipe-delimited flat files (SAP IDocs, bank statements, government B2B integrations). Parsing them correctly means:

- Trimming whitespace and coercing types
- Collecting errors per-field without aborting the whole file
- Streaming multi-GB files without loading them into memory

`flatfile-js` handles all of this with a single schema definition.

---

## Install

```bash
npm install @faizkhairi/flatfile-js
```

Zero dependencies. Works in Node.js 18+ and modern browsers.

---

## Quick Start

```typescript
import { createSchema, parseFlat, stringifyFlat } from '@faizkhairi/flatfile-js'

// 1. Define your schema once
const schema = createSchema({
  delimiter: '|',
  hasHeader: false,
  fields: [
    { name: 'id',     type: 'number',  position: 0 },
    { name: 'name',   type: 'string',  position: 1, required: true },
    { name: 'salary', type: 'decimal', position: 2, decimalPlaces: 2 },
    { name: 'dob',    type: 'date',    position: 3, format: 'YYYYMMDD' },
    { name: 'active', type: 'boolean', position: 4 },
  ],
})

// 2. Parse a flat file string
const fileContent = `
1|Alice Smith|75000.50|19850315|1
2|Bob Jones|82000.00|19901122|1
3|Carol White|91500.75|19781005|0
`.trim()

const { records, errors } = parseFlat(fileContent, schema)

if (errors.length > 0) {
  console.error('Parse errors:', errors)
}

records.forEach(record => {
  // record.id     → number
  // record.name   → string
  // record.salary → number (precision-controlled decimal)
  // record.dob    → Date object
  // record.active → boolean
  console.log(record)
})

// 3. Generate a flat file from records
const output = stringifyFlat(records, schema)
// → '1|Alice Smith|75000.50|19850315|1\n2|...'
```

---

## Streaming Large Files

For files too large to load into memory, use `parseStream`. It yields one typed record at a time with no error collection (optimized for throughput):

```typescript
import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import { parseStream } from '@faizkhairi/flatfile-js'

// Convert Node.js stream to Web ReadableStream
const nodeStream = createReadStream('large-file.dat')
const webStream = Readable.toWeb(nodeStream)

for await (const record of parseStream(webStream, schema)) {
  await db.insert(record)
}
```

> For error diagnostics, use `parseFlat` instead — `parseStream` prioritizes throughput.

---

## API Reference

### `createSchema(config)`

Validates and normalizes a schema at creation time (fail-fast). Sorts fields by position.

```typescript
const schema = createSchema({
  delimiter: '|',       // Required. Common: '|', ',', '\t'
  fields: [...],        // Required. At least one field.
  hasHeader?: false,    // Default: false. If true, first line is skipped on parse.
  lineEnding?: 'auto',  // 'LF' | 'CRLF' | 'auto'. Default: 'auto'.
})
```

Throws if: delimiter is empty, no fields, duplicate positions, or duplicate names.

---

### `parseFlat(content, schema)`

Parses a flat file string into typed records. Returns `{ records, errors }`.

- Records with field errors are **still included** — failed fields are set to `null`.
- Empty optional fields → `null` (no error).
- Empty required fields → error collected, field set to `null`.

```typescript
const { records, errors } = parseFlat(content, schema)
// records: Record<string, unknown>[]
// errors:  ParseError[]
```

**ParseError shape:**
```typescript
{
  line:     number   // 1-indexed line number
  field:    string   // field name
  position: number   // 0-indexed column position
  message:  string   // human-readable error
  raw:      string   // the raw string value that caused the error
}
```

---

### `stringifyFlat(records, schema)`

Serializes typed records back to a flat file string.

```typescript
const output = stringifyFlat(records, schema)
fs.writeFileSync('output.dat', output)
```

- `null` / `undefined` → empty string
- `number` → `Math.round()` (integer)
- `decimal` → `.toFixed(decimalPlaces)`
- `date` → formatted per `field.format` (default: ISO 8601)
- `boolean` → `trueValue ?? '1'` or `falseValue ?? '0'`

---

### `parseStream(stream, schema)`

Async generator that yields one record per line. No error collection.

```typescript
for await (const record of parseStream(webReadableStream, schema)) {
  process(record)
}
```

---

## Field Types

| Type | Input Example | Output |
|------|--------------|--------|
| `string` | `' Alice '` | `'Alice'` (trimmed) |
| `number` | `'1001'` | `1001` |
| `decimal` | `'75000.50'` | `75000.5` (precision float) |
| `date` | `'19850315'` | `Date` object (UTC) |
| `boolean` | `'1'` / `'yes'` | `true` |

### Date Formats

| Format | Example Input |
|--------|--------------|
| `YYYYMMDD` | `19850315` |
| `DD/MM/YYYY` | `15/03/1985` |
| `MM/DD/YYYY` | `03/15/1985` |
| `YYYY-MM-DD` | `1985-03-15` |
| `ISO` (default) | `1985-03-15T00:00:00.000Z` |

All dates are parsed and stored in **UTC** to avoid timezone drift.

### Boolean Defaults

| True | False |
|------|-------|
| `true`, `1`, `y`, `yes` | `false`, `0`, `n`, `no` |

Case-insensitive. Override with `trueValue` / `falseValue` per field.

---

## Error Handling Strategy

`parseFlat` uses a **collect-and-continue** approach designed for enterprise data processing:

```typescript
const { records, errors } = parseFlat(content, schema)

// records always has one entry per non-empty line
// failed fields are null, not omitted
records.forEach((record, i) => {
  if (record.salary === null) {
    console.warn(`Line ${i + 1}: salary could not be parsed`)
  }
  db.insert(record) // still processable as partial data
})
```

This matches how enterprise ETL systems work — you want to see *all* the data and *all* the errors together, not halt at the first failure.

---

## License

MIT © [Faiz Khairi](https://github.com/faizkhairi)
