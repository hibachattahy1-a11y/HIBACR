// ════════════════════════════════════════════════════
//  config.js  —  Constantes projet ACC / APS
// ════════════════════════════════════════════════════

const CONFIG = {
  // ── Identifiants ACC (extraits du lien fourni) ──
  PROJECT_ID:    '34c7de6e-c8f0-4545-aa61-c4fd3adaa031',
  FOLDER_URN:    'urn:adsk.wipprod:fs.folder:co.yMDvu4GXSESts_j_Q1k2zA',
  LINEAGE_URN:   'urn:adsk.wipprod:dm.lineage:I8IKjQM-RGKkNGdOUwKbhA',
  VIEWABLE_GUID: '40d54ded-3c29-f5a3-ed21-dc3126f84375',

  // ── Endpoints API (servis par server/index.js) ──
  API_TOKEN:  '/api/token',
  API_MODEL:  '/api/model',
  API_LEVEES: '/api/levees',
  API_STATUS: '/api/status',

  // ── Couleurs thème ──
  COLORS: {
    orange:  '#FFA500',
    green:   '#2ECC71',
    red:     '#C0392B',
    gray:    '#999999',
    yellow:  '#f39c12',
  }
};
