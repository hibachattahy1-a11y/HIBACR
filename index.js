require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');
const fs      = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── Config depuis .env ────────────────────────────────────────
const {
  APS_CLIENT_ID,
  APS_CLIENT_SECRET,
  APS_CALLBACK_URL = 'http://localhost:8080/api/auth/callback',
  PORT = 8080
} = process.env;

// ── Infos maquette ACC ────────────────────────────────────────
const PROJECT_ID    = '34c7de6e-c8f0-4545-aa61-c4fd3adaa031';
const ACC_PROJ_ID   = 'b.' + PROJECT_ID;
const LINEAGE_URN   = 'urn:adsk.wipprod:dm.lineage:bnPxMDurTp2ZPRtmEFUAzw';
const VIEWABLE_GUID = '40d54ded-3c29-f5a3-ed21-dc3126f84375';

// ── Session 3-legged (stockée en mémoire) ────────────────────
let session3LO = { token: null, refresh: null, expiry: 0 };

// ── Token 2-legged (viewer public) ───────────────────────────
let cache2LO = { token: null, expiry: 0 };

async function get2LOToken() {
  if (cache2LO.token && Date.now() < cache2LO.expiry - 60000) return cache2LO.token;
  const resp = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: APS_CLIENT_ID, client_secret: APS_CLIENT_SECRET,
      grant_type: 'client_credentials', scope: 'data:read viewables:read'
    })
  });
  const d = await resp.json();
  if (!d.access_token) throw new Error(JSON.stringify(d));
  cache2LO = { token: d.access_token, expiry: Date.now() + d.expires_in * 1000 };
  return cache2LO.token;
}

// ── Rafraîchir le token 3LO si expiré ────────────────────────
async function refreshToken3LO() {
  if (!session3LO.refresh) return false;
  try {
    const resp = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(APS_CLIENT_ID + ':' + APS_CLIENT_SECRET).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: session3LO.refresh,
        scope: 'data:read viewables:read'
      })
    });
    const d = await resp.json();
    if (!d.access_token) return false;
    session3LO = { token: d.access_token, refresh: d.refresh_token, expiry: Date.now() + d.expires_in * 1000 };
    console.log('✅ Token 3LO rafraîchi');
    return true;
  } catch { return false; }
}

// ── Obtenir token 3LO valide ──────────────────────────────────
async function get3LOToken() {
  if (!session3LO.token) return null;
  if (Date.now() > session3LO.expiry - 60000) {
    const ok = await refreshToken3LO();
    if (!ok) { session3LO = { token: null, refresh: null, expiry: 0 }; return null; }
  }
  return session3LO.token;
}

// ── Utilitaire base64 URL-safe ────────────────────────────────
function toBase64(urn) {
  return Buffer.from(urn).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Récupérer le VERSION_URN depuis ACC ───────────────────────
let _versionUrnCache = null;

async function getVersionUrn(token) {
  if (_versionUrnCache) return _versionUrnCache;
  const url = `https://developer.api.autodesk.com/data/v1/projects/${ACC_PROJ_ID}/items/${encodeURIComponent(LINEAGE_URN)}/versions`;
  const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!resp.ok) {
    const err = await resp.text();
    console.warn('⚠️  Versions API:', resp.status, err.substring(0, 100));
    return LINEAGE_URN; // fallback
  }
  const json = await resp.json();
  if (!json.data?.length) return LINEAGE_URN;
  _versionUrnCache = json.data[0].id;
  console.log('✅ VERSION_URN:', _versionUrnCache.substring(0, 60) + '...');
  return _versionUrnCache;
}

// ════════════════════════════════════════════════════════════
//  ROUTES AUTH 3-LEGGED
// ════════════════════════════════════════════════════════════

// Étape 1 : redirige vers la page de login Autodesk
app.get('/api/auth/login', (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     APS_CLIENT_ID,
    redirect_uri:  APS_CALLBACK_URL,
    scope:         'data:read viewables:read',
    prompt:        'login'
  });
  const url = 'https://developer.api.autodesk.com/authentication/v2/authorize?' + params;
  console.log('🔐 Redirection vers login Autodesk...');
  res.redirect(url);
});

// Étape 2 : Autodesk redirige ici avec le code
app.get('/api/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    console.error('❌ Auth error:', error);
    return res.redirect('/?error=' + encodeURIComponent(error));
  }
  if (!code) return res.redirect('/?error=no_code');
  try {
    const resp = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(APS_CLIENT_ID + ':' + APS_CLIENT_SECRET).toString('base64')
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code:          code,
        redirect_uri:  APS_CALLBACK_URL
      })
    });
    const d = await resp.json();
    if (!d.access_token) throw new Error('Pas de token : ' + JSON.stringify(d));
    session3LO = { token: d.access_token, refresh: d.refresh_token || null, expiry: Date.now() + d.expires_in * 1000 };
    _versionUrnCache = null; // reset pour re-fetch avec le bon token
    console.log('✅ Connecté via ACC (3LO) — token valide', d.expires_in, 'sec');
    res.redirect('/?connected=1');
  } catch (e) {
    console.error('❌ Callback error:', e.message);
    res.redirect('/?error=' + encodeURIComponent(e.message));
  }
});

// Étape 3 : déconnexion
app.get('/api/auth/logout', (req, res) => {
  session3LO = { token: null, refresh: null, expiry: 0 };
  _versionUrnCache = null;
  console.log('👋 Déconnexion');
  res.json({ ok: true });
});

// État de la session
app.get('/api/auth/status', async (req, res) => {
  const t3 = await get3LOToken();
  res.json({ logged_in: !!t3, login_url: '/api/auth/login' });
});

// ════════════════════════════════════════════════════════════
//  ROUTES API DASHBOARD
// ════════════════════════════════════════════════════════════

// /api/token — envoie le meilleur token disponible au viewer
app.get('/api/token', async (req, res) => {
  try {
    // Préfère le token 3LO (accès complet ACC), sinon 2LO (viewer seulement)
    const t3 = await get3LOToken();
    if (t3) return res.json({ access_token: t3, source: '3lo' });
    const t2 = await get2LOToken();
    res.json({ access_token: t2, source: '2lo' });
  } catch (e) {
    console.error('❌ /api/token:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// /api/model — renvoie l'URN derivative + metadata
app.get('/api/model', async (req, res) => {
  try {
    const t3 = await get3LOToken();
    const token = t3 || await get2LOToken();
    const versionUrn = await getVersionUrn(token);
    const urn = toBase64(versionUrn);
    res.json({ urn, viewable_guid: VIEWABLE_GUID, project_id: PROJECT_ID, logged_in: !!t3 });
  } catch (e) {
    console.error('❌ /api/model:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// /api/levees — données chambords
app.get('/api/levees', (req, res) => {
  const f = path.join(__dirname, '../assets/levees.json');
  fs.existsSync(f) ? res.sendFile(f) : res.json({ chambords: [] });
});

// ── Démarrage ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   SGTM BIM Dashboard — Chambords         ║');
  console.log(`║   http://localhost:${PORT}                     ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(APS_CLIENT_ID ? '✅ Identifiants APS détectés' : '⚠️  Identifiants APS manquants');
  console.log('📁 Projet ACC  : ' + PROJECT_ID);
  console.log('🔗 Maquette    : ' + LINEAGE_URN.substring(0, 50) + '...');
  console.log('🔐 Login URL   : http://localhost:' + PORT + '/api/auth/login');
  console.log('');
});
