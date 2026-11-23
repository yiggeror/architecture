import * as T from 'three'

// Three's scene/material format keeps transforms, draw flags and texture sampling
// intact. Mesh buffers travel by ownership transfer instead of becoming JSON
// number arrays. A seated figure alone has over a million attribute values.
function packGeometry(g, transfers) {
  function attribute(a) {
    transfers.add(a.array.buffer)
    return { array: a.array, itemSize: a.itemSize, normalized: a.normalized, name: a.name }
  }
  return {
    attributes: Object.fromEntries(Object.entries(g.attributes).map(([k, a]) => [k, attribute(a)])),
    index: g.index && attribute(g.index),
    morphs: Object.fromEntries(Object.entries(g.morphAttributes).map(([k, list]) => [k, list.map(attribute)])),
    relative: g.morphTargetsRelative,
    groups: g.groups,
    name: g.name,
    sphere: g.boundingSphere && [g.boundingSphere.center.toArray(), g.boundingSphere.radius],
    box: g.boundingBox && [g.boundingBox.min.toArray(), g.boundingBox.max.toArray()],
  }
}
function unpackGeometry(data) {
  function attribute(a) {
    const result = new T.BufferAttribute(a.array, a.itemSize, a.normalized)
    result.name = a.name
    return result
  }
  const g = new T.BufferGeometry()
  for (const [key, a] of Object.entries(data.attributes)) g.setAttribute(key, attribute(a))
  if (data.index) g.setIndex(attribute(data.index))
  for (const [key, list] of Object.entries(data.morphs)) g.morphAttributes[key] = list.map(attribute)
  g.morphTargetsRelative = data.relative
  g.groups = data.groups
  g.name = data.name
  if (data.sphere) g.boundingSphere = new T.Sphere(new T.Vector3().fromArray(data.sphere[0]), data.sphere[1])
  if (data.box) g.boundingBox = new T.Box3(...data.box.map((point) => new T.Vector3().fromArray(point)))
  return g
}
function pixelData(texture) {
  const image = texture.image, { width, height } = image
  // Shared weave and prop atlases are also used by the next worker job. Keep
  // their source buffers there and send each texture just once while resident.
  const data = texture.isDataTexture
    ? image.data.slice()
    : new Uint8Array(image.getContext('2d').getImageData(0, 0, width, height).data.buffer)
  return { data, width, height }
}
function mapValues(value, replace) {
  if (!value || typeof value !== 'object') return value
  const replacement = replace(value)
  if (replacement !== undefined) return replacement
  if (Array.isArray(value)) return value.map((item) => mapValues(item, replace))
  return Object.fromEntries(Object.entries(value).map(([k, item]) => [k, mapValues(item, replace)]))
}

export function packFigureArt(art, knownTextures) {
  const meta = { geometries: {}, materials: {}, textures: {}, images: {}, skeletons: {} }
  const nodes = new Set(), transfers = new Set(), colors = {}, pixels = {}
  function material(m) {
    if (meta.materials[m.uuid]) return
    const linear = {}
    for (const [key, value] of Object.entries(m)) {
      if (value?.isColor) linear[key] = value.toArray()
      if (!value?.isTexture || meta.textures[value.uuid]) continue
      // The standard image serializer encodes a canvas as a data URL. Supply
      // its source separately so even a file:// visit needs no image requests.
      meta.images[value.source.uuid] = { uuid: value.source.uuid }
      value.toJSON(meta)
      if (!knownTextures.has(value.uuid)) {
        const image = pixelData(value)
        pixels[value.source.uuid] = image
        transfers.add(image.data.buffer)
      }
    }
    colors[m.uuid] = linear
    meta.materials[m.uuid] = m.toJSON(meta)
  }
  const model = mapValues(art, (value) => {
    if (value.isObject3D) {
      nodes.add(value)
      return { node: value.uuid }
    }
    if (value.isMaterial) {
      material(value)
      return { material: value.uuid }
    }
  })
  const roots = []
  for (const node of nodes) {
    let ancestor = node.parent
    while (ancestor && !nodes.has(ancestor)) ancestor = ancestor.parent
    if (ancestor) continue
    node.traverse((child) => {
      if (child.matrixAutoUpdate) child.updateMatrix()
      if (!child.isMesh) return
      const g = child.geometry
      meta.geometries[g.uuid] ??= packGeometry(g, transfers)
      for (const m of [].concat(child.material)) material(m)
    })
    roots.push(node.toJSON(meta).object)
  }
  return {
    packet: {
      model, roots, geometries: meta.geometries, materials: Object.values(meta.materials),
      textures: Object.values(meta.textures), colors, pixels,
    },
    transfers: [...transfers],
  }
}

export function unpackFigureArt(packet, textureCache) {
  const loader = new T.ObjectLoader(), textures = {}, nodes = new Map()
  for (const data of packet.textures) {
    let texture = textureCache.get(data.uuid)
    if (!texture) {
      const image = new T.Source(packet.pixels[data.image])
      texture = loader.parseTextures([data], { [data.image]: image })[data.uuid]
      textureCache.set(data.uuid, texture)
    }
    textures[data.uuid] = texture
  }
  const materials = loader.parseMaterials(packet.materials, textures)
  // Material JSON stores pigment as sRGB hex. Restore the original linear
  // floats as well, including the mixed dyes on selected tools and jewellery.
  for (const [id, colors] of Object.entries(packet.colors))
    for (const [key, rgb] of Object.entries(colors)) materials[id][key].fromArray(rgb)
  const geometries = Object.fromEntries(Object.entries(packet.geometries).map(([id, g]) => [id, unpackGeometry(g)]))
  for (const data of packet.roots)
    loader.parseObject(data, geometries, materials, textures, {}).traverse((node) => nodes.set(node.uuid, node))
  return mapValues(packet.model, (ref) => {
    if (ref.node) return nodes.get(ref.node)
    if (ref.material) return materials[ref.material]
  })
}
