import * as ProtobufReader from "effect/protobuf/ProtobufReader"
import * as ProtobufWriter from "effect/protobuf/ProtobufWriter"

const LEN = ProtobufWriter.WireType.Len

/** OTLP's export requests: the resource groups of each signal, as JSON names them. */
const GROUPS = ["resourceSpans", "resourceLogs", "resourceMetrics"] as const

interface JsonKeyValue {
  readonly key: string
}

interface JsonGroup {
  resource?: { attributes?: Array<JsonKeyValue | { key: string; value: { stringValue: string } }> }
}

/**
 * The OTLP/JSON export request `body` with each of `stamps` added to every resource that lacks it, so the web app's
 * telemetry says which deployment it came from even when the browser didn't say.
 *
 * Fails (throws) on a body that isn't JSON.
 */
export const stampJson = (body: string, stamps: Readonly<Record<string, string>>): string => {
  const request = JSON.parse(body) as Record<string, unknown>
  for (const name of GROUPS) {
    const groups = request[name]
    if (!Array.isArray(groups)) continue
    for (const group of groups as Array<JsonGroup>) {
      const resource = group.resource ??= {}
      const attributes = resource.attributes ??= []
      for (const [key, value] of Object.entries(stamps)) {
        if (!attributes.some((attribute) => attribute.key === key)) {
          attributes.push({ key, value: { stringValue: value } })
        }
      }
    }
  }
  return JSON.stringify(request)
}

// The keys of a `Resource` message's attributes (`repeated KeyValue attributes = 1`, `string key = 1`).
const keysOf = (resource: Uint8Array): ReadonlySet<string> => {
  const keys = new Set<string>()
  const reader = ProtobufReader.make(resource)
  while (!reader.isDone()) {
    const tag = reader.tag()
    if (ProtobufReader.fieldNumber(tag) !== 1 || ProtobufReader.wireType(tag) !== LEN) {
      reader.skip(tag)
      continue
    }
    const keyValue = reader.delimited()
    while (!keyValue.isDone()) {
      const inner = keyValue.tag()
      if (ProtobufReader.fieldNumber(inner) === 1) keys.add(keyValue.string({ validateUtf8: false }))
      else keyValue.skip(inner)
    }
  }
  return keys
}

const keyValue = (key: string, value: string) =>
  ProtobufWriter.make()
    .tag(1, LEN).string(key)
    .tag(2, LEN).bytes(ProtobufWriter.make().tag(1, LEN).string(value).finish())
    .finish()

// The resource with the stamps it lacks appended as attributes (the last fields of the message).
const stampResource = (resource: Uint8Array, stamps: Readonly<Record<string, string>>) => {
  const keys = keysOf(resource)
  const writer = ProtobufWriter.make().raw(resource)
  for (const [key, value] of Object.entries(stamps)) {
    if (!keys.has(key)) writer.tag(1, LEN).bytes(keyValue(key, value))
  }
  return writer.finish()
}

// A resource group (`ResourceSpans`, `ResourceLogs`, `ResourceMetrics`: `Resource resource = 1`), its resource
// stamped, its other fields as they were.
const stampGroup = (group: Uint8Array, stamps: Readonly<Record<string, string>>) => {
  const reader = ProtobufReader.make(group)
  const writer = ProtobufWriter.make()
  let stamped = false
  while (!reader.isDone()) {
    const start = reader.offset
    const tag = reader.tag()
    if (!stamped && ProtobufReader.fieldNumber(tag) === 1 && ProtobufReader.wireType(tag) === LEN) {
      writer.tag(1, LEN).bytes(stampResource(reader.bytesView(), stamps))
      stamped = true
      continue
    }
    reader.skip(tag)
    writer.raw(group.subarray(start, reader.offset))
  }
  if (!stamped) writer.tag(1, LEN).bytes(stampResource(new Uint8Array(), stamps))
  return writer.finish()
}

/**
 * The OTLP/protobuf export request `body` with each of `stamps` added to every resource that lacks it: the request's
 * resource groups (field 1 of every `Export*ServiceRequest`) are rewritten, everything else is copied byte for byte.
 *
 * Throws a `ProtobufReaderError` on a body that isn't protobuf.
 */
export const stampProtobuf = (body: Uint8Array, stamps: Readonly<Record<string, string>>): Uint8Array => {
  const reader = ProtobufReader.make(body)
  const writer = ProtobufWriter.make()
  while (!reader.isDone()) {
    const start = reader.offset
    const tag = reader.tag()
    if (ProtobufReader.fieldNumber(tag) === 1 && ProtobufReader.wireType(tag) === LEN) {
      writer.tag(1, LEN).bytes(stampGroup(reader.bytesView(), stamps))
      continue
    }
    reader.skip(tag)
    writer.raw(body.subarray(start, reader.offset))
  }
  return writer.finish()
}
