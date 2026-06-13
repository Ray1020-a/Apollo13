import { initialState } from './state'
import { FIXED_DT, MAX_FRAME } from './constants'
import { step } from './systems/index'
import { render } from '../ui/dashboard'

let state = initialState()
let last = performance.now()
let acc = 0
let tick = 0

function frame(now: number): void {
  acc += Math.min((now - last) / 1000, MAX_FRAME)
  last = now
  while (acc >= FIXED_DT) {
    state = step(state, FIXED_DT)
    tick++
    acc -= FIXED_DT
  }
  render(state, tick)
  requestAnimationFrame(frame)
}

export function startLoop(): void {
  requestAnimationFrame(frame)
}
