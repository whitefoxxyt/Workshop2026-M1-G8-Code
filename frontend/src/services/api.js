const API_BASE = (
  import.meta.env.VITE_API_URL || "http://backend:3000/api"
).replace(/\/$/, "");

/*
  Flux caméra diffusé par le module IA (ia/script_ia.py).
  - non défini  -> flux local par défaut
  - ""          -> panneau caméra désactivé
  - une URL mp4/m3u8 -> lue avec <video>, sinon MJPEG avec <img>
*/
const CAMERA_STREAM_URL =
  import.meta.env.VITE_CAMERA_URL ?? "/camera/stream.mjpg";

const COMMANDS_API_URL = import.meta.env.VITE_COMMANDS_API_URL || `${API_BASE}/v1/commandes`;

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json", ...options.headers },
      ...options,
    });
  } catch {
    throw new Error(`API injoignable (${API_BASE})`);
  }

  if (!response.ok) {
    throw new Error(`Erreur ${response.status} sur ${path}`);
  }

  return response.json();
}

export const getTelemetry = (limit = 48) =>
  request(`/v1/telemetrie?limit=${limit}`);

export const getMovements = (limit = 200) =>
  request(`/v1/mouvement?limit=${limit}`);

export const getFingerprintEvents = (limit = 200) =>
  request(`/v1/empreinte?limit=${limit}`);

export const getDashboardData = async (limits = {}) => {
  const [telemetry, movements, fingerprints] = await Promise.all([
    getTelemetry(limits.telemetry),
    getMovements(limits.movements),
    getFingerprintEvents(limits.fingerprints),
  ]);

  return { telemetry, movements, fingerprints };
};

export const sendCommand = async (action) => {
  let response;

  try {
    response = await fetch(COMMANDS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        action_id: `${Date.now()}`,
        sent_at: new Date().toISOString(),
      }),
    });
  } catch {
    throw new Error(`API matérielle injoignable (${COMMANDS_API_URL})`);
  }

  if (!response.ok) {
    throw new Error(
      `Réponse ${response.status} — endpoint absent ou refusé (${COMMANDS_API_URL})`
    );
  }

  return response.json().catch(() => null);
};

/* ------------------------------- Caméra -------------------------------- */

const cameraEndpoint = (path) => {
  if (/^https?:\/\//i.test(CAMERA_STREAM_URL)) {
    return new URL(path, CAMERA_STREAM_URL).toString();
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const base = CAMERA_STREAM_URL.replace(/\/stream\.mjpg(?:\?.*)?$/, "");
  return `${origin}${base}${path}`;
};

/*
  État du module IA : personnes détectées + caméra active ou en veille.
  Renvoyé par le serveur Flask de ia/script_ia.py (GET /nombre_personnes).
*/
export const getCameraStatus = async () => {
  if (!CAMERA_STREAM_URL) return null;

  const url = cameraEndpoint("/nombre_personnes");

  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Module IA injoignable — lancer ia/script_ia.py");
  }

  if (!response.ok) {
    throw new Error(`Module IA : réponse ${response.status}`);
  }

  return response.json();
};

export { API_BASE, CAMERA_STREAM_URL, COMMANDS_API_URL };
