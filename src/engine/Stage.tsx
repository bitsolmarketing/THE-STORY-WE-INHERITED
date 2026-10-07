import { Suspense, useEffect, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { Color, NoToneMapping, SRGBColorSpace } from 'three'
import { useCinematicStore, frame, cinematic } from '@/engine/store/cinematicStore'
import { CinematicLoop } from '@/engine/loop/CinematicLoop'
import { SceneManager } from '@/engine/scenes/SceneManager'
import { createCameraDirector } from '@/scenes/cameraPath'
import { stepDown } from '@/engine/quality/quality'
import { scrollToProgress } from '@/engine/progress/ScrollProgress'
import { PALETTE } from '@/scenes/world/layout'

/** Exposes verification hooks on window (used by e2e/verify.mjs and the debug HUD). */
function ExposeDebug() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    window.__CINEMA__ = {
      frame,
      store: useCinematicStore,
      scrollToProgress,
      renderer: gl,
      scene,
      camera,
      stats: () => ({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        textures: gl.info.memory.textures,
        geometries: gl.info.memory.geometries,
        programs: gl.info.programs?.length ?? 0,
      }),
    }
    const onLost = (e: Event) => {
      e.preventDefault()
      console.error('[cinema] WebGL context lost')
    }
    const onRestored = () => console.warn('[cinema] WebGL context restored')
    const canvas = gl.domElement
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [gl, scene, camera])
  return null
}

export function Stage() {
  const quality = useCinematicStore((s) => s.quality)
  const timeline = useCinematicStore((s) => s.timeline)
  const director = useMemo(() => createCameraDirector(timeline), [timeline])

  return (
    <div className="stage" aria-hidden="true">
      <Canvas
        dpr={quality.dpr}
        shadows={quality.shadows ? 'soft' : false}
        flat
        gl={{
          antialias: quality.antialias,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
          preserveDrawingBuffer: false,
          toneMapping: NoToneMapping,
          outputColorSpace: SRGBColorSpace,
        }}
        camera={{ fov: 32, near: 0.05, far: 900, position: [0, 5.2, 0.9] }}
        onCreated={({ gl }) => {
          gl.setClearColor(new Color(PALETTE.ivory), 1)
        }}
        frameloop="always"
      >
        <PerformanceMonitor
          onDecline={() => {
            const q = cinematic.get().quality
            const next = stepDown(q)
            if (next.tier !== q.tier) cinematic.get().setQuality(next)
          }}
          flipflops={2}
        />
        <CinematicLoop director={director} />
        <Suspense fallback={null}>
          <SceneManager />
        </Suspense>
        <ExposeDebug />
      </Canvas>
    </div>
  )
}
