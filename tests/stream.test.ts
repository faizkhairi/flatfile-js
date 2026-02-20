import { describe, it, expect } from 'vitest'
import { parseStream } from '../src/stream.js'
import { createSchema } from '../src/schema.js'

/** Helper: encode a string into a single-chunk ReadableStream */
function stringToStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

/** Helper: collect all records from an async generator */
async function collect(gen: AsyncGenerator<Record<string, unknown>>): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = []
  for await (const record of gen) {
    results.push(record)
  }
  return results
}

const schema = createSchema({
  delimiter: '|',
  fields: [
    { name: 'id', type: 'number', position: 0 },
    { name: 'name', type: 'string', position: 1 },
    { name: 'active', type: 'boolean', position: 2 },
  ],
})

describe('parseStream', () => {
  it('yields typed records from a stream', async () => {
    const content = '1|Alice|1\n2|Bob|0'
    const records = await collect(parseStream(stringToStream(content), schema))

    expect(records).toHaveLength(2)
    expect(records[0].id).toBe(1)
    expect(records[0].name).toBe('Alice')
    expect(records[0].active).toBe(true)
    expect(records[1].id).toBe(2)
    expect(records[1].active).toBe(false)
  })

  it('skips header line when hasHeader is true', async () => {
    const s = createSchema({ ...schema, hasHeader: true })
    const content = 'id|name|active\n1|Alice|1'
    const records = await collect(parseStream(stringToStream(content), s))

    expect(records).toHaveLength(1)
    expect(records[0].id).toBe(1)
  })

  it('skips empty lines', async () => {
    const content = '1|Alice|1\n\n2|Bob|0\n'
    const records = await collect(parseStream(stringToStream(content), schema))
    expect(records).toHaveLength(2)
  })

  it('handles CRLF line endings', async () => {
    const content = '1|Alice|1\r\n2|Bob|0'
    const records = await collect(parseStream(stringToStream(content), schema))
    expect(records).toHaveLength(2)
    expect(records[0].id).toBe(1)
    expect(records[1].id).toBe(2)
  })

  it('sets null for invalid field values (no errors collected)', async () => {
    const content = 'notanumber|Alice|1'
    const records = await collect(parseStream(stringToStream(content), schema))
    expect(records).toHaveLength(1)
    expect(records[0].id).toBeNull()
    expect(records[0].name).toBe('Alice') // other fields still parsed
  })

  it('handles chunked data — incomplete lines across chunks', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('1|Ali'))    // incomplete first line
        controller.enqueue(encoder.encode('ce|1\n'))   // completes first line
        controller.enqueue(encoder.encode('2|Bob|0'))  // no trailing newline
        controller.close()
      },
    })

    const records = await collect(parseStream(stream, schema))
    expect(records).toHaveLength(2)
    expect(records[0].name).toBe('Alice')
    expect(records[1].id).toBe(2)
  })

  it('handles a stream with only a header line', async () => {
    const s = createSchema({ ...schema, hasHeader: true })
    const content = 'id|name|active'
    const records = await collect(parseStream(stringToStream(content), s))
    expect(records).toHaveLength(0)
  })

  it('handles empty stream', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })
    const records = await collect(parseStream(stream, schema))
    expect(records).toHaveLength(0)
  })

  it('handles large multi-line content', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `${i + 1}|User${i + 1}|1`)
    const content = lines.join('\n')
    const records = await collect(parseStream(stringToStream(content), schema))
    expect(records).toHaveLength(100)
    expect(records[99].id).toBe(100)
  })
})
