/** 貼皮路徑與建議尺寸 — 對應 public/textures/README.md */
export const TEXTURE_MANIFEST = {
  spacecraft: {
    body:           { path: '/textures/spacecraft/body.png',           w: 1024, h: 2048 },
    shield:         { path: '/textures/spacecraft/shield.png',         w: 512,  h: 512  },
    tunnel:         { path: '/textures/spacecraft/tunnel.png',         w: 512,  h: 512  },
    panel:          { path: '/textures/spacecraft/panel.png',          w: 1024, h: 512  },
    window:         { path: '/textures/spacecraft/window.png',         w: 256,  h: 256  },
    cabinInterior:  { path: '/textures/spacecraft/cabin-interior.png', w: 2048, h: 1024 },
  },
  cockpit: {
    instrumentPanel: { path: '/textures/cockpit/instrument-panel.png', w: 2048, h: 1024 },
    button:          { path: '/textures/cockpit/button.png',           w: 128,  h: 64   },
    gaugeFace:       { path: '/textures/cockpit/gauge-face.png',       w: 256,  h: 256  },
    frame:           { path: '/textures/cockpit/frame.png',            w: 512,  h: 1024 },
    glass:           { path: '/textures/cockpit/glass.png',            w: 1024, h: 768  },
  },
  earth: {
    diffuse:     { path: '/textures/earth/diffuse.png',     w: 2048, h: 1024 },
    atmosphere:  { path: '/textures/earth/atmosphere.png',  w: 2048, h: 1024 },
  },
  stars: {
    skybox:    { path: '/textures/stars/skybox.png',    w: 4096, h: 2048 },
    particle:  { path: '/textures/stars/particle.png',  w: 64,   h: 64   },
  },
} as const
