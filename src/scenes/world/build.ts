import { InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3, Euler, type BufferGeometry, type Material } from 'three'

/** Small helpers for building instanced diorama pieces. */
export interface Placement {
  x: number
  y: number
  z: number
  ry?: number
  rx?: number
  rz?: number
  s?: number
  sx?: number
  sy?: number
  sz?: number
  delay?: number
}

const m4 = new Matrix4()
const q = new Quaternion()
const e = new Euler()
const p = new Vector3()
const s = new Vector3()

export function instanced(geometry: BufferGeometry, material: Material, items: Placement[], opts: { shadows?: boolean } = {}): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, items.length)
  const delays = new Float32Array(items.length)
  items.forEach((it, i) => {
    e.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0)
    q.setFromEuler(e)
    p.set(it.x, it.y, it.z)
    const k = it.s ?? 1
    s.set((it.sx ?? 1) * k, (it.sy ?? 1) * k, (it.sz ?? 1) * k)
    m4.compose(p, q, s)
    mesh.setMatrixAt(i, m4)
    delays[i] = it.delay ?? 0
  })
  geometry.setAttribute('aDelay', new InstancedBufferAttribute(delays, 1))
  mesh.instanceMatrix.needsUpdate = true
  mesh.castShadow = Boolean(opts.shadows)
  mesh.receiveShadow = Boolean(opts.shadows)
  mesh.frustumCulled = false
  return mesh
}

/** Base-at-origin box geometry helper is applied by callers via geometry.translate. */
export function range(from: number, to: number, step: number): number[] {
  const out: number[] = []
  for (let v = from; v <= to + 1e-6; v += step) out.push(v)
  return out
}
