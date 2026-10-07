import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, InstancedBufferAttribute, InstancedMesh, LinearFilter, Matrix4, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three'
import { srgbVec3 } from '@/engine/assets/color'
import { frame } from '@/engine/store/cinematicStore'
import { PALETTE } from '@/scenes/world/layout'
import { spineFrame, spinePoint, type YearMark } from './layout'

const COLS = 10
const CELL_W = 160
const CELL_H = 56

/**
 * Every year is a small mono numeral set beside its tick on the spine: the ledger under the film.
 * One canvas atlas (1947–2026), one InstancedMesh, one draw call. Marks ahead of the camera are
 * faint; the one under the focus is darkest.
 */
export function YearTicks({ marks, focus }: { marks: YearMark[]; focus: () => number }) {
  const atlas = useMemo(() => {
    const years = marks.map((m) => m.year)
    const rows = Math.ceil(years.length / COLS)
    const c = document.createElement('canvas')
    c.width = COLS * CELL_W
    c.height = rows * CELL_H
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'right'
    ctx.font = '400 34px "JetBrains Mono", ui-monospace, monospace'
    years.forEach((y, i) => ctx.fillText(String(y), (i % COLS) * CELL_W + CELL_W - 10, Math.floor(i / COLS) * CELL_H + CELL_H / 2 + 2))
    const t = new CanvasTexture(c)
    t.minFilter = LinearFilter
    t.generateMipmaps = false
    return { texture: t, rows }
  }, [marks])

  const mesh = useMemo(() => {
    const w = 1.05
    const h = w * (CELL_H / CELL_W)
    const geo = new PlaneGeometry(w, h)
    const n = marks.length
    const uv = new Float32Array(n * 2)
    const sAttr = new Float32Array(n)
    marks.forEach((m, i) => {
      uv[i * 2] = (i % COLS) / COLS
      uv[i * 2 + 1] = 1 - (Math.floor(i / COLS) + 1) / atlas.rows
      sAttr[i] = m.s
    })
    geo.setAttribute('aCell', new InstancedBufferAttribute(uv, 2))
    geo.setAttribute('aS', new InstancedBufferAttribute(sAttr, 1))
    const mat = new ShaderMaterial({
      uniforms: {
        uAtlas: { value: atlas.texture },
        uCell: { value: [1 / COLS, 1 / atlas.rows] },
        uFocus: { value: 0 },
        cInk: { value: srgbVec3(PALETTE.charcoal) },
        cBrass: { value: srgbVec3(PALETTE.brass) },
      },
      vertexShader: /* glsl */ `
        attribute vec2 aCell;
        attribute float aS;
        uniform vec2 uCell;
        uniform float uFocus;
        varying vec2 vUv;
        varying float vNear;
        varying float vAhead;
        void main() {
          vUv = aCell + uv * uCell;
          float d = aS - uFocus;
          vNear = 1.0 - smoothstep(0.0, 6.0, abs(d));
          vAhead = smoothstep(-2.0, 40.0, d);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uAtlas;
        uniform vec3 cInk, cBrass;
        varying vec2 vUv;
        varying float vNear;
        varying float vAhead;
        void main() {
          float a = texture2D(uAtlas, vUv).r;
          // Only years already reached are written; the next few are pencil-faint.
          float written = 1.0 - smoothstep(0.0, 1.0, vAhead) * 0.85;
          float alpha = a * mix(0.26, 0.8, vNear) * written;
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(mix(cInk, cBrass, vNear * 0.6), alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
    const im = new InstancedMesh(geo, mat, n)
    const m4 = new Matrix4()
    const q = new Quaternion()
    const pos = new Vector3()
    const scale = new Vector3(1, 1, 1)
    const p = { x: 0, z: 0 }
    const f = { tx: 1, tz: 0, nx: 0, nz: 1 }
    // Text lies flat; it reads left→right along the normal, its top points forward along the spine.
    const basis = new Matrix4()
    marks.forEach((m, i) => {
      spinePoint(m.s, p)
      spineFrame(m.s, f)
      // Beside the railway's milepost, clear of the sleepers.
      const lateral = -1.25
      pos.set(p.x + f.nx * lateral, 0.03, p.z + f.nz * lateral)
      basis.makeBasis(new Vector3(f.nx, 0, f.nz), new Vector3(0, 1, 0), new Vector3(-f.tx, 0, -f.tz))
      q.setFromRotationMatrix(basis)
      // Plane faces +Z; lay it flat (rotate −90° about X in its own frame) after orienting it.
      const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
      q.multiply(flat)
      m4.compose(pos, q, scale)
      im.setMatrixAt(i, m4)
    })
    im.instanceMatrix.needsUpdate = true
    im.frustumCulled = false
    im.renderOrder = 3
    return im
  }, [marks, atlas])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      ;(mesh.material as ShaderMaterial).dispose()
      atlas.texture.dispose()
    },
    [mesh, atlas],
  )

  useFrame(() => {
    void frame.progress
    ;(mesh.material as ShaderMaterial).uniforms.uFocus.value = focus()
  })

  return <primitive object={mesh} />
}
