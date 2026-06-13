import { startLoop, toggleDevice, setO2Held, doReset } from './game/loop'
import { setupControls } from './ui/controls'

setupControls({ toggleDevice, setO2Held, doReset })
startLoop()
