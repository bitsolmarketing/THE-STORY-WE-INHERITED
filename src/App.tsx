import { useEffect } from 'react'
import { Stage } from '@/engine/Stage'
import { ScrollTrack } from '@/engine/ScrollTrack'
import { UILayer } from '@/ui/UILayer'
import { Loader } from '@/ui/Loader/Loader'
import { GrainVeil } from '@/ui/GrainVeil'
import { useScrollProgress } from '@/engine/progress/ScrollProgress'
import { useAudioController } from '@/engine/audio/AudioController'
import { installJudgesInterrupts } from '@/engine/judgesCut'
import { installNavigationKeys } from '@/engine/navigation'

/**
 * Composition root (ExperienceShell). Each child owns one responsibility:
 *  ScrollTrack  — the document's scroll length (derived from the paced timeline)
 *  Stage        — fixed WebGL canvas: CinematicLoop, camera director, SceneManager
 *  UILayer      — the shell (identity, menu, year, captions, rail, Judges' Cut player, archive,
 *                 sound) and the secondary layers (entry, menu, timeline, archive, sources, about)
 *  Loader       — boot state
 */
export default function App() {
  useScrollProgress()
  useAudioController()
  useEffect(() => installJudgesInterrupts(), [])
  useEffect(() => installNavigationKeys(), [])

  return (
    <>
      <ScrollTrack />
      <Stage />
      <GrainVeil />
      <UILayer />
      <Loader />
    </>
  )
}
