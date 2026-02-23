import { IpluginInputArgs } from '../../../../FlowHelpers/1.0.0/interfaces/interfaces';
import { IpluginDetails, IpluginOutputArgs } from '../../../../FlowHelpers/1.0.0/interfaces/interfaces';

/* -------------- small helpers -------------- */
const PATH_SEP = /[\\/]/;
const getFileName = (p: string): string => String(p || '').split(PATH_SEP).pop() || '';
const getDirParts = (p: string): string[] => String(p || '').split(PATH_SEP).filter(Boolean);
const stripTrailingSlashes = (u: string): string => String(u || '').replace(/\/+$/, '');
const toBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  return !!v;
};

interface ISxxEyy {
  season: number | null;
  episode: number | null;
}

function parseSxxEyyFromPath(p: string): ISxxEyy {
  const base = getFileName(p);
  const m = base.match(/S(\d{1,2})E(\d{1,3})/i);
  return m ? { season: Number(m[1]), episode: Number(m[2]) } : { season: null, episode: null };
}

function looksLikeTvPath(p: string): boolean {
  const parts = getDirParts(p);
  if (parts.some((x) => /^(?:Season|Series)\s+\d+$/i.test(x))) return true;
  const { season, episode } = parseSxxEyyFromPath(p);
  return season !== null && episode !== null;
}

function getSeriesTitleFromPath(p: string): string {
  const parts = getDirParts(p);
  for (let i = 1; i < parts.length; i++) {
    if (/^(?:Season|Series)\s+\d+$/i.test(parts[i])) return parts[i - 1];
  }
  const base = getFileName(p).replace(/\.(mkv|mp4|avi|ts|m4v)$/i, '');
  const idx = base.search(/S\d{1,2}E\d{1,3}/i);
  return (idx > 0 ? base.slice(0, idx) : base).replace(/[._]+/g, ' ').trim();
}

function tvdbIdFromPath(p: string): number | null {
  const m = String(p || '').match(/\{tvdb-(\d+)\}/i);
  return m ? Number(m[1]) : null;
}

function is4KPath(p: string): boolean {
  const s = String(p || '').toLowerCase();
  return /\b(2160p|uhd|4k)\b/.test(s) || /[\s._-](uhd|4k)[\s._-]/.test(s);
}

/* -------------- plugin details -------------- */
const details = (): IpluginDetails => ({
  name: 'AK_NotifyAndUnmonitorArr',
  description:
    'Post-transcode plugin that refreshes Sonarr or Radarr and optionally unmonitors the item. '
    + 'Auto-detects TV vs movie from file path and routes to the correct HD or 4K instance based '
    + 'on path tokens (2160p/UHD/4K). Supports dual Sonarr and dual Radarr instances. No file management.',
  style: { borderColor: 'green' },
  tags: 'arr,sonarr,radarr,unmonitor,post',
  isStartPlugin: false,
  pType: '',
  requiresVersion: '2.00.00',
  sidebarPosition: -1,
  icon: 'faBell',
  inputs: [
    { label: 'Sonarr Host', name: 'sonarr_host', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: 'Base URL for Sonarr. No trailing slash. e.g. http://192.168.1.1:8989' },
    { label: 'Sonarr API Key', name: 'sonarr_api_key', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: 'X-Api-Key for Sonarr' },
    { label: 'Sonarr 4K Host', name: 'sonarr_4k_host', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: '(Optional) Base URL for 4K Sonarr. Falls back to Sonarr Host if not set.' },
    { label: 'Sonarr 4K API Key', name: 'sonarr_4k_api_key', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: '(Optional) X-Api-Key for 4K Sonarr. Falls back to Sonarr API Key if not set.' },
    { label: 'Radarr Host', name: 'radarr_host', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: 'Base URL for Radarr. No trailing slash. e.g. http://192.168.1.1:7878' },
    { label: 'Radarr API Key', name: 'radarr_api_key', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: 'X-Api-Key for Radarr' },
    { label: 'Radarr 4K Host', name: 'radarr_4k_host', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: '(Optional) Base URL for 4K Radarr. Falls back to Radarr Host if not set.' },
    { label: 'Radarr 4K API Key', name: 'radarr_4k_api_key', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: '(Optional) X-Api-Key for 4K Radarr. Falls back to Radarr API Key if not set.' },
    { label: 'Unmonitor after refresh', name: 'unmonitor_after_refresh', type: 'boolean', defaultValue: true, inputUI: { type: 'checkbox' }, tooltip: 'If enabled: Radarr → unmonitor movie; Sonarr → unmonitor SxxEyy' },
    { label: 'Timeout (ms)', name: 'timeout_ms', type: 'number', defaultValue: 15000, inputUI: { type: 'number' }, tooltip: 'HTTP timeout in milliseconds' },
  ],
  outputs: [
    { number: 1, tooltip: 'Arr notified (and possibly unmonitored)' },
    { number: 2, tooltip: 'Arr item not found' },
  ],
});
exports.details = details;

/* -------------- interfaces -------------- */
interface IArrDelegates {
  getIdFromParseResponse: (resp: unknown) => number;
  buildRefreshRequest: (id: number) => object;
}

interface IArrApp {
  name: string;
  host: string;
  key: string;
  headers: Record<string, string>;
  content: string;
  delegates: IArrDelegates;
}

/* -------------- HTTP helpers -------------- */
function httpTimeout(args: IpluginInputArgs): number { return Number(args.inputs.timeout_ms || 15000); }

async function arrPOST(args: IpluginInputArgs, base: string, path: string, headers: Record<string, string>, data: object) {
  return args.deps.axios({ method: 'post', url: `${base}${path}`, headers, data, timeout: httpTimeout(args) });
}

async function arrGET(args: IpluginInputArgs, base: string, path: string, headers: Record<string, string>, params?: object) {
  return args.deps.axios({ method: 'get', url: `${base}${path}`, headers, params, timeout: httpTimeout(args) });
}

async function arrPUT(args: IpluginInputArgs, base: string, path: string, headers: Record<string, string>, data: object) {
  return args.deps.axios({ method: 'put', url: `${base}${path}`, headers, data, timeout: httpTimeout(args) });
}

/* -------------- ID resolution -------------- */
const getId = async (args: IpluginInputArgs, arrApp: IArrApp, fileName: string): Promise<number> => {
  const imdbId = (/\btt\d{7,10}\b/i.exec(fileName)?.at(0)) ?? '';
  let id = -1;

  if (imdbId) {
    const r = await arrGET(args, arrApp.host, `/api/v3/${arrApp.name === 'radarr' ? 'movie' : 'series'}/lookup`, arrApp.headers, { term: `imdb:${imdbId}` });
    id = Number((r as any).data?.at(0)?.id ?? -1);
    args.jobLog(`${arrApp.content} ${id !== -1 ? `'${id}' found` : 'not found'} for imdb '${imdbId}'`);
  }

  if (id === -1) {
    const parsedName = getFileName(fileName);
    const p = await arrGET(args, arrApp.host, `/api/v3/parse`, arrApp.headers, { title: parsedName });
    id = arrApp.delegates.getIdFromParseResponse(p);
    args.jobLog(`${arrApp.content} ${id !== -1 ? `'${id}' found` : 'not found'} for '${parsedName}'`);
  }
  return id;
};

/* -------------- Sonarr helpers -------------- */
async function lookupSonarrSeriesId(args: IpluginInputArgs, base: string, headers: Record<string, string>, srcPath: string): Promise<number> {
  const tvdb = tvdbIdFromPath(srcPath);
  if (tvdb) {
    const lk = await arrGET(args, base, `/api/v3/series/lookup`, headers, { term: `tvdb:${tvdb}` });
    const hit = Array.isArray((lk as any).data) && (lk as any).data.length ? (lk as any).data[0].id : -1;
    if (hit !== -1) return hit;
  }
  const title = getSeriesTitleFromPath(srcPath);
  if (!title) return -1;
  const lookup = await arrGET(args, base, `/api/v3/series/lookup`, headers, { term: title });
  return (Array.isArray((lookup as any).data) && (lookup as any).data.length) ? (lookup as any).data[0].id : -1;
}

async function unmonitorSonarrEpisode(
  args: IpluginInputArgs,
  base: string,
  apiKey: string,
  seriesId: number,
  season: number,
  episode: number,
): Promise<boolean> {
  const headers = { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };
  const timeout = httpTimeout(args);

  const eps = await arrGET(args, base, `/api/v3/episode`, headers, { seriesId });
  const match = Array.isArray((eps as any).data)
    ? (eps as any).data.find((e: any) => Number(e.seasonNumber) === Number(season) && Number(e.episodeNumber) === Number(episode))
    : null;

  if (!match) {
    args.jobLog(`Sonarr: episode S${season}E${episode} not found in seriesId ${seriesId}`);
    return false;
  }

  try {
    await (args.deps.axios as any).put(
      `${base}/api/v3/episode/monitor`,
      { monitored: false, episodeIds: [match.id] },
      { headers, timeout, params: { includeImages: false } },
    );
    args.jobLog(`✔ Sonarr: unmonitored S${season}E${episode} (episodeId=${match.id}) via PUT /episode/monitor`);
    return true;
  } catch (e: any) {
    const code = e?.response?.status;
    if (code !== 405 && code !== 404) throw e;
    args.jobLog(`Sonarr /episode/monitor unsupported (${code}). Falling back to PUT /episode`);
  }

  const epFull = await (args.deps.axios as any).get(`${base}/api/v3/episode/${match.id}`, { headers, timeout });
  const payload = Object.assign({}, epFull.data, { monitored: false });
  await (args.deps.axios as any).put(`${base}/api/v3/episode`, [payload], { headers, timeout });
  args.jobLog(`✔ Sonarr: unmonitored S${season}E${episode} (episodeId=${match.id}) via PUT /episode`);
  return true;
}

async function unmonitorSonarrByPath(
  args: IpluginInputArgs,
  base: string,
  apiKey: string,
  srcPath: string,
  seriesIdFromRefresh: number,
): Promise<boolean> {
  const sxe = parseSxxEyyFromPath(srcPath);
  if (sxe.season === null || sxe.episode === null) {
    args.jobLog(`Sonarr: cannot unmonitor – SxxEyy not detected in "${srcPath}"`);
    return false;
  }
  const headers = { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };
  const seriesId = (seriesIdFromRefresh && seriesIdFromRefresh !== -1)
    ? seriesIdFromRefresh
    : await lookupSonarrSeriesId(args, base, headers, srcPath);
  if (seriesId === -1) {
    args.jobLog('Sonarr: series id not resolved for unmonitor.');
    return false;
  }
  return unmonitorSonarrEpisode(args, base, apiKey, seriesId, sxe.season, sxe.episode);
}

/* -------------- Radarr helpers -------------- */
async function unmonitorRadarr(args: IpluginInputArgs, base: string, headers: Record<string, string>, movieId: number): Promise<void> {
  const m = await arrGET(args, base, `/api/v3/movie/${movieId}`, headers);
  const payload = Object.assign({}, (m as any).data, { monitored: false });
  await arrPUT(args, base, `/api/v3/movie/${movieId}`, headers, payload);
  args.jobLog(`✔ Radarr: movie id=${movieId} unmonitored`);
}

/* -------------- app config (HD/4K with fallback) -------------- */
function pickInstance(args: IpluginInputArgs, appName: string, is4k: boolean): IArrApp {
  if (appName === 'sonarr') {
    const hdHost = stripTrailingSlashes(String(args.inputs.sonarr_host || ''));
    const hdKey = String(args.inputs.sonarr_api_key || '');
    const host = stripTrailingSlashes(is4k ? (String(args.inputs.sonarr_4k_host || '') || hdHost) : hdHost);
    const key = String(is4k ? (String(args.inputs.sonarr_4k_api_key || '') || hdKey) : hdKey);
    const headers = { 'X-Api-Key': key, 'Content-Type': 'application/json', Accept: 'application/json' };
    return {
      name: 'sonarr', host, key, headers, content: 'Serie',
      delegates: {
        getIdFromParseResponse: (resp: any) => Number(resp?.data?.series?.id ?? -1),
        buildRefreshRequest: (id: number) => ({ name: 'RefreshSeries', seriesId: id }),
      },
    };
  }
  const hdHost = stripTrailingSlashes(String(args.inputs.radarr_host || ''));
  const hdKey = String(args.inputs.radarr_api_key || '');
  const host = stripTrailingSlashes(is4k ? (String(args.inputs.radarr_4k_host || '') || hdHost) : hdHost);
  const key = String(is4k ? (String(args.inputs.radarr_4k_api_key || '') || hdKey) : hdKey);
  const headers = { 'X-Api-Key': key, 'Content-Type': 'application/json', Accept: 'application/json' };
  return {
    name: 'radarr', host, key, headers, content: 'Movie',
    delegates: {
      getIdFromParseResponse: (resp: any) => Number(resp?.data?.movie?.id ?? -1),
      buildRefreshRequest: (id: number) => ({ name: 'RefreshMovie', movieIds: [id] }),
    },
  };
}

/* -------------- main plugin -------------- */
const plugin = async (args: IpluginInputArgs): Promise<IpluginOutputArgs> => {
  const lib = require('../../../../../methods/lib')();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
  args.inputs = lib.loadDefaultValues(args.inputs, details);

  const originalFileName = args.originalLibraryFile?._id || '';
  const currentFileName = args.inputFileObj?._id || '';
  const srcPath = currentFileName || originalFileName || '';

  const isTv = looksLikeTvPath(srcPath);
  const is4k = is4KPath(srcPath);
  const unmonitorFlag = toBool(args.inputs.unmonitor_after_refresh);

  const target = isTv ? 'sonarr' : 'radarr';
  const arrApp = pickInstance(args, target, is4k);

  if (!arrApp.host || !arrApp.key) {
    throw new Error(`Missing ${arrApp.name} ${is4k ? '4K' : ''} host or API key`);
  }

  if (arrApp.name === 'sonarr' && /radarr/i.test(arrApp.host)) args.jobLog('Warning: target=sonarr but host looks like Radarr');
  if (arrApp.name === 'radarr' && /sonarr/i.test(arrApp.host)) args.jobLog('Warning: target=radarr but host looks like Sonarr');

  args.jobLog(`AK_NotifyAndUnmonitorArr start — detected: ${target.toUpperCase()} ${is4k ? '4K' : 'HD'}`);

  let id = -1;
  let refreshed = false;

  try {
    args.jobLog('Going to force scan');
    args.jobLog(`Refreshing ${arrApp.name}...`);

    id = await getId(args, arrApp, originalFileName);
    if (id === -1 && currentFileName && currentFileName !== originalFileName) {
      id = await getId(args, arrApp, currentFileName);
    }
    if (id !== -1) {
      await arrPOST(args, arrApp.host, `/api/v3/command`, arrApp.headers, arrApp.delegates.buildRefreshRequest(id));
      refreshed = true;
      args.jobLog(`✔ ${arrApp.content} '${id}' refreshed in ${arrApp.name}.`);
    } else {
      args.jobLog(`${arrApp.content} not found for refresh.`);
    }
  } catch (e: any) {
    args.jobLog(`Arr refresh error: ${e?.message || String(e)}`);
  }

  if (unmonitorFlag) {
    try {
      if (arrApp.name === 'radarr' && id !== -1) {
        await unmonitorRadarr(args, arrApp.host, arrApp.headers, id);
      } else if (arrApp.name === 'sonarr' && srcPath) {
        await unmonitorSonarrByPath(args, arrApp.host, arrApp.key, srcPath, id);
      } else {
        args.jobLog('Unmonitor skipped (insufficient context).');
      }
    } catch (e: any) {
      args.jobLog(`Unmonitor error: ${e?.message || String(e)}`);
    }
  }

  return {
    outputFileObj: args.inputFileObj,
    outputNumber: refreshed ? 1 : 2,
    variables: args.variables,
  };
};
exports.plugin = plugin;
