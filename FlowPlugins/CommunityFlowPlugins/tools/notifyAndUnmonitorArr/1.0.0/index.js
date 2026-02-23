"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = exports.details = void 0;
/* -------------- small helpers -------------- */
const PATH_SEP = /[\\/]/;
const getFileName = (p) => String(p || '').split(PATH_SEP).pop() || '';
const getDirParts = (p) => String(p || '').split(PATH_SEP).filter(Boolean);
const stripTrailingSlashes = (u) => String(u || '').replace(/\/+$/, '');
const toBool = (v) => {
    if (typeof v === 'boolean')
        return v;
    if (typeof v === 'string')
        return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
    return !!v;
};
function parseSxxEyyFromPath(p) {
    const base = getFileName(p);
    const m = base.match(/S(\d{1,2})E(\d{1,3})/i);
    return m ? { season: Number(m[1]), episode: Number(m[2]) } : { season: null, episode: null };
}
function looksLikeTvPath(p) {
    const parts = getDirParts(p);
    if (parts.some((x) => /^(?:Season|Series)\s+\d+$/i.test(x)))
        return true;
    const { season, episode } = parseSxxEyyFromPath(p);
    return season !== null && episode !== null;
}
function tvdbIdFromPath(p) {
    const m = String(p || '').match(/\{tvdb-(\d+)\}/i);
    return m ? Number(m[1]) : null;
}
function is4KPath(p) {
    const s = String(p || '').toLowerCase();
    return /\b(2160p|uhd|4k)\b/.test(s) || /[\s._-](uhd|4k)[\s._-]/.test(s);
}
function getSeriesTitleFromPath(p) {
    const parts = getDirParts(p);
    for (let i = 1; i < parts.length; i++) {
        if (/^(?:Season|Series)\s+\d+$/i.test(parts[i]))
            return parts[i - 1];
    }
    const base = getFileName(p).replace(/\.(mkv|mp4|avi|ts|m4v)$/i, '');
    const idx = base.search(/S\d{1,2}E\d{1,3}/i);
    return (idx > 0 ? base.slice(0, idx) : base).replace(/[._]+/g, ' ').trim();
}
/* -------------- plugin details -------------- */
const details = () => ({
    name: 'AB_ReMonitorAndSearchArr',
    description: 'On transcode failure: re-monitors the episode or movie in Sonarr/Radarr, optionally deletes '
        + 'the file via the arr so it is tracked correctly, optionally applies a failure tag to the '
        + 'series/movie, then triggers an automatic search for a new version. '
        + 'Auto-detects TV vs movie from file path. Supports dual HD and 4K instances with fallback.',
    style: { borderColor: 'red' },
    tags: 'arr,sonarr,radarr,monitor,search,failure',
    isStartPlugin: false,
    pType: '',
    requiresVersion: '2.00.00',
    sidebarPosition: -1,
    icon: 'faRotateRight',
    inputs: [
        { label: 'Sonarr Host', name: 'sonarr_host', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: 'Base URL for Sonarr. No trailing slash. e.g. http://192.168.1.1:8989' },
        { label: 'Sonarr API Key', name: 'sonarr_api_key', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: 'X-Api-Key for Sonarr' },
        { label: 'Sonarr 4K Host', name: 'sonarr_4k_host', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: '(Optional) Base URL for 4K Sonarr. Falls back to Sonarr Host if not set.' },
        { label: 'Sonarr 4K API Key', name: 'sonarr_4k_api_key', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: '(Optional) X-Api-Key for 4K Sonarr. Falls back to Sonarr API Key if not set.' },
        { label: 'Radarr Host', name: 'radarr_host', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: 'Base URL for Radarr. No trailing slash. e.g. http://192.168.1.1:7878' },
        { label: 'Radarr API Key', name: 'radarr_api_key', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: 'X-Api-Key for Radarr' },
        { label: 'Radarr 4K Host', name: 'radarr_4k_host', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: '(Optional) Base URL for 4K Radarr. Falls back to Radarr Host if not set.' },
        { label: 'Radarr 4K API Key', name: 'radarr_4k_api_key', type: 'string', defaultValue: '', inputUI: { type: 'text' }, tooltip: '(Optional) X-Api-Key for 4K Radarr. Falls back to Radarr API Key if not set.' },
        {
            label: 'Delete file via arr',
            name: 'delete_file',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'checkbox' },
            tooltip: 'If enabled: delete the file via Sonarr/Radarr so the arr tracks the removal correctly. '
                + 'Disable if you want Sonarr/Radarr to replace the file in place rather than re-download to a new path.',
        },
        {
            label: 'Tag on failure',
            name: 'tag_on_failure',
            type: 'boolean',
            defaultValue: true,
            inputUI: { type: 'checkbox' },
            tooltip: 'If enabled: apply a tag to the series/movie in Sonarr/Radarr so you can easily find '
                + 'items that failed transcoding. The tag will be created automatically if it does not exist.',
        },
        {
            label: 'Failure tag label',
            name: 'failure_tag_label',
            type: 'string',
            defaultValue: 'tdarr-failed',
            inputUI: { type: 'text' },
            tooltip: 'The tag label to apply when transcoding fails. Defaults to "tdarr-failed".',
        },
        { label: 'Timeout (ms)', name: 'timeout_ms', type: 'number', defaultValue: 15000, inputUI: { type: 'number' }, tooltip: 'HTTP timeout in milliseconds' },
    ],
    outputs: [],
});
exports.details = details;
/* -------------- HTTP helpers -------------- */
function httpTimeout(args) { return Number(args.inputs.timeout_ms || 15000); }
async function arrGET(args, base, path, headers, params) {
    return args.deps.axios({ method: 'get', url: `${base}${path}`, headers, params, timeout: httpTimeout(args) });
}
async function arrPOST(args, base, path, headers, data) {
    return args.deps.axios({ method: 'post', url: `${base}${path}`, headers, data, timeout: httpTimeout(args) });
}
async function arrPUT(args, base, path, headers, data) {
    return args.deps.axios({ method: 'put', url: `${base}${path}`, headers, data, timeout: httpTimeout(args) });
}
async function arrDELETE(args, base, path, headers) {
    return args.deps.axios({ method: 'delete', url: `${base}${path}`, headers, timeout: httpTimeout(args) });
}
/* -------------- tag helpers -------------- */
async function ensureTagId(args, base, headers, tagLabel) {
    const tagsResp = await arrGET(args, base, `/api/v3/tag`, headers);
    const tags = Array.isArray(tagsResp.data) ? tagsResp.data : [];
    const existing = tags.find((t) => String(t.label).toLowerCase() === tagLabel.toLowerCase());
    if (existing) {
        args.jobLog(`Tag "${tagLabel}" already exists (id=${existing.id})`);
        return existing.id;
    }
    const created = await arrPOST(args, base, `/api/v3/tag`, headers, { label: tagLabel });
    args.jobLog(`✔ Created tag "${tagLabel}" (id=${created.data.id})`);
    return created.data.id;
}
async function applyTagToSeries(args, base, headers, seriesId, tagId) {
    var _a;
    const seriesResp = await arrGET(args, base, `/api/v3/series/${seriesId}`, headers);
    const existingTags = Array.isArray((_a = seriesResp.data) === null || _a === void 0 ? void 0 : _a.tags) ? seriesResp.data.tags : [];
    if (existingTags.includes(tagId)) {
        args.jobLog(`Tag id=${tagId} already on series id=${seriesId}`);
        return;
    }
    const payload = Object.assign({}, seriesResp.data, { tags: [...existingTags, tagId] });
    await arrPUT(args, base, `/api/v3/series/${seriesId}`, headers, payload);
    args.jobLog(`✔ Sonarr: applied tag id=${tagId} to series id=${seriesId}`);
}
async function applyTagToMovie(args, base, headers, movieId, tagId) {
    var _a;
    const movieResp = await arrGET(args, base, `/api/v3/movie/${movieId}`, headers);
    const existingTags = Array.isArray((_a = movieResp.data) === null || _a === void 0 ? void 0 : _a.tags) ? movieResp.data.tags : [];
    if (existingTags.includes(tagId)) {
        args.jobLog(`Tag id=${tagId} already on movie id=${movieId}`);
        return;
    }
    const payload = Object.assign({}, movieResp.data, { tags: [...existingTags, tagId] });
    await arrPUT(args, base, `/api/v3/movie/${movieId}`, headers, payload);
    args.jobLog(`✔ Radarr: applied tag id=${tagId} to movie id=${movieId}`);
}
async function getId(args, arrApp, fileName) {
    var _a, _b, _c, _d, _e;
    const imdbId = (_b = ((_a = /\btt\d{7,10}\b/i.exec(fileName)) === null || _a === void 0 ? void 0 : _a[0])) !== null && _b !== void 0 ? _b : '';
    let id = -1;
    if (imdbId) {
        const r = await arrGET(args, arrApp.host, `/api/v3/${arrApp.name === 'radarr' ? 'movie' : 'series'}/lookup`, arrApp.headers, { term: `imdb:${imdbId}` });
        id = Number((_e = (_d = (_c = r.data) === null || _c === void 0 ? void 0 : _c.at(0)) === null || _d === void 0 ? void 0 : _d.id) !== null && _e !== void 0 ? _e : -1);
        args.jobLog(`${arrApp.content} ${id !== -1 ? `'${id}' found` : 'not found'} for imdb '${imdbId}'`);
    }
    if (id === -1) {
        const parsedName = getFileName(fileName);
        const p = await arrGET(args, arrApp.host, `/api/v3/parse`, arrApp.headers, { title: parsedName });
        id = arrApp.delegates.getIdFromParseResponse(p);
        args.jobLog(`${arrApp.content} ${id !== -1 ? `'${id}' found` : 'not found'} for '${parsedName}'`);
    }
    return id;
}
/* -------------- Sonarr helpers -------------- */
async function lookupSonarrSeriesId(args, base, headers, srcPath) {
    const tvdb = tvdbIdFromPath(srcPath);
    if (tvdb) {
        const lk = await arrGET(args, base, `/api/v3/series/lookup`, headers, { term: `tvdb:${tvdb}` });
        const hit = Array.isArray(lk.data) && lk.data.length ? lk.data[0].id : -1;
        if (hit !== -1)
            return hit;
    }
    const title = getSeriesTitleFromPath(srcPath);
    if (!title)
        return -1;
    const lookup = await arrGET(args, base, `/api/v3/series/lookup`, headers, { term: title });
    return (Array.isArray(lookup.data) && lookup.data.length) ? lookup.data[0].id : -1;
}
async function reMonitorAndSearchSonarr(args, base, apiKey, srcPath, seriesIdFromLookup, deleteFile, tagOnFailure, tagLabel) {
    var _a;
    const sxe = parseSxxEyyFromPath(srcPath);
    if (sxe.season === null || sxe.episode === null) {
        args.jobLog(`Sonarr: cannot re-monitor – SxxEyy not detected in "${srcPath}"`);
        return false;
    }
    const headers = { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };
    const seriesId = (seriesIdFromLookup && seriesIdFromLookup !== -1)
        ? seriesIdFromLookup
        : await lookupSonarrSeriesId(args, base, headers, srcPath);
    if (seriesId === -1) {
        args.jobLog('Sonarr: series id not resolved.');
        return false;
    }
    if (tagOnFailure) {
        try {
            const tagId = await ensureTagId(args, base, headers, tagLabel);
            await applyTagToSeries(args, base, headers, seriesId, tagId);
        }
        catch (e) {
            args.jobLog(`Sonarr: tagging failed (non-fatal): ${(e === null || e === void 0 ? void 0 : e.message) || String(e)}`);
        }
    }
    const eps = await arrGET(args, base, `/api/v3/episode`, headers, { seriesId });
    const match = Array.isArray(eps.data)
        ? eps.data.find((e) => Number(e.seasonNumber) === sxe.season && Number(e.episodeNumber) === sxe.episode)
        : null;
    if (!match) {
        args.jobLog(`Sonarr: episode S${sxe.season}E${sxe.episode} not found in seriesId ${seriesId}`);
        return false;
    }
    try {
        await args.deps.axios.put(`${base}/api/v3/episode/monitor`, { monitored: true, episodeIds: [match.id] }, { headers, timeout: httpTimeout(args), params: { includeImages: false } });
        args.jobLog(`✔ Sonarr: re-monitored S${sxe.season}E${sxe.episode} (episodeId=${match.id})`);
    }
    catch (e) {
        const code = (_a = e === null || e === void 0 ? void 0 : e.response) === null || _a === void 0 ? void 0 : _a.status;
        if (code !== 405 && code !== 404)
            throw e;
        args.jobLog(`Sonarr /episode/monitor unsupported (${code}). Falling back to PUT /episode`);
        const epFull = await args.deps.axios.get(`${base}/api/v3/episode/${match.id}`, { headers, timeout: httpTimeout(args) });
        const payload = Object.assign({}, epFull.data, { monitored: true });
        await args.deps.axios.put(`${base}/api/v3/episode`, [payload], { headers, timeout: httpTimeout(args) });
        args.jobLog(`✔ Sonarr: re-monitored S${sxe.season}E${sxe.episode} via PUT /episode`);
    }
    if (deleteFile) {
        if (match.episodeFileId && match.episodeFileId > 0) {
            await arrDELETE(args, base, `/api/v3/episodefile/${match.episodeFileId}`, headers);
            args.jobLog(`✔ Sonarr: deleted episodeFileId=${match.episodeFileId}`);
        }
        else {
            args.jobLog('Sonarr: no episodeFileId found — file may already be untracked.');
        }
    }
    else {
        args.jobLog('Sonarr: file deletion skipped — Sonarr will replace the file in place.');
    }
    await arrPOST(args, base, `/api/v3/command`, headers, { name: 'EpisodeSearch', episodeIds: [match.id] });
    args.jobLog(`✔ Sonarr: search triggered for S${sxe.season}E${sxe.episode}`);
    return true;
}
/* -------------- Radarr helpers -------------- */
async function reMonitorAndSearchRadarr(args, base, headers, movieId, deleteFile, tagOnFailure, tagLabel) {
    var _a, _b, _c, _d, _e;
    if (tagOnFailure) {
        try {
            const tagId = await ensureTagId(args, base, headers, tagLabel);
            await applyTagToMovie(args, base, headers, movieId, tagId);
        }
        catch (e) {
            args.jobLog(`Radarr: tagging failed (non-fatal): ${(e === null || e === void 0 ? void 0 : e.message) || String(e)}`);
        }
    }
    const m = await arrGET(args, base, `/api/v3/movie/${movieId}`, headers);
    const payload = Object.assign({}, m.data, { monitored: true });
    await arrPUT(args, base, `/api/v3/movie/${movieId}`, headers, payload);
    args.jobLog(`✔ Radarr: re-monitored movie id=${movieId}`);
    if (deleteFile) {
        const movieFileId = (_e = (_c = (_b = (_a = m.data) === null || _a === void 0 ? void 0 : _a.movieFile) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : (_d = m.data) === null || _d === void 0 ? void 0 : _d.movieFileId) !== null && _e !== void 0 ? _e : -1;
        if (movieFileId !== -1) {
            await arrDELETE(args, base, `/api/v3/moviefile/${movieFileId}`, headers);
            args.jobLog(`✔ Radarr: deleted movieFileId=${movieFileId}`);
        }
        else {
            args.jobLog('Radarr: no movieFileId found — file may already be untracked.');
        }
    }
    else {
        args.jobLog('Radarr: file deletion skipped — Radarr will replace the file in place.');
    }
    await arrPOST(args, base, `/api/v3/command`, headers, { name: 'MoviesSearch', movieIds: [movieId] });
    args.jobLog(`✔ Radarr: search triggered for movie id=${movieId}`);
}
/* -------------- app config (HD/4K with fallback) -------------- */
function pickInstance(args, appName, is4k) {
    if (appName === 'sonarr') {
        const hdHost = stripTrailingSlashes(String(args.inputs.sonarr_host || ''));
        const hdKey = String(args.inputs.sonarr_api_key || '');
        const host = stripTrailingSlashes(is4k ? (String(args.inputs.sonarr_4k_host || '') || hdHost) : hdHost);
        const key = String(is4k ? (String(args.inputs.sonarr_4k_api_key || '') || hdKey) : hdKey);
        const headers = { 'X-Api-Key': key, 'Content-Type': 'application/json', Accept: 'application/json' };
        return { name: 'sonarr', host, key, headers, content: 'Serie', delegates: { getIdFromParseResponse: (resp) => { var _a, _b, _c; return Number((_c = (_b = (_a = resp === null || resp === void 0 ? void 0 : resp.data) === null || _a === void 0 ? void 0 : _a.series) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : -1); } } };
    }
    const hdHost = stripTrailingSlashes(String(args.inputs.radarr_host || ''));
    const hdKey = String(args.inputs.radarr_api_key || '');
    const host = stripTrailingSlashes(is4k ? (String(args.inputs.radarr_4k_host || '') || hdHost) : hdHost);
    const key = String(is4k ? (String(args.inputs.radarr_4k_api_key || '') || hdKey) : hdKey);
    const headers = { 'X-Api-Key': key, 'Content-Type': 'application/json', Accept: 'application/json' };
    return { name: 'radarr', host, key, headers, content: 'Movie', delegates: { getIdFromParseResponse: (resp) => { var _a, _b, _c; return Number((_c = (_b = (_a = resp === null || resp === void 0 ? void 0 : resp.data) === null || _a === void 0 ? void 0 : _a.movie) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : -1); } } };
}
/* -------------- main plugin -------------- */
const plugin = async (args) => {
    var _a, _b;
    const lib = require('../../../../../methods/lib')();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
    args.inputs = lib.loadDefaultValues(args.inputs, details);
    const originalFileName = ((_a = args.originalLibraryFile) === null || _a === void 0 ? void 0 : _a._id) || '';
    const currentFileName = ((_b = args.inputFileObj) === null || _b === void 0 ? void 0 : _b._id) || '';
    const srcPath = currentFileName || originalFileName || '';
    const isTv = looksLikeTvPath(srcPath);
    const is4k = is4KPath(srcPath);
    const deleteFile = toBool(args.inputs.delete_file);
    const tagOnFailure = toBool(args.inputs.tag_on_failure);
    const tagLabel = String(args.inputs.failure_tag_label || 'tdarr-failed').trim();
    const target = isTv ? 'sonarr' : 'radarr';
    const arrApp = pickInstance(args, target, is4k);
    if (!arrApp.host || !arrApp.key)
        throw new Error(`Missing ${arrApp.name} ${is4k ? '4K' : ''} host or API key`);
    if (arrApp.name === 'sonarr' && /radarr/i.test(arrApp.host))
        args.jobLog('Warning: target=sonarr but host looks like Radarr');
    if (arrApp.name === 'radarr' && /sonarr/i.test(arrApp.host))
        args.jobLog('Warning: target=radarr but host looks like Sonarr');
    args.jobLog(`AB_ReMonitorAndSearchArr start — detected: ${target.toUpperCase()} ${is4k ? '4K' : 'HD'}`);
    let id = -1;
    let success = false;
    try {
        id = await getId(args, arrApp, originalFileName);
        if (id === -1 && currentFileName && currentFileName !== originalFileName) {
            id = await getId(args, arrApp, currentFileName);
        }
        if (id === -1) {
            args.jobLog(`${arrApp.content} not found — cannot re-monitor or search.`);
        }
        else if (arrApp.name === 'radarr') {
            await reMonitorAndSearchRadarr(args, arrApp.host, arrApp.headers, id, deleteFile, tagOnFailure, tagLabel);
            success = true;
        }
        else if (arrApp.name === 'sonarr') {
            success = await reMonitorAndSearchSonarr(args, arrApp.host, arrApp.key, srcPath, id, deleteFile, tagOnFailure, tagLabel);
        }
    }
    catch (e) {
        args.jobLog(`Error: ${(e === null || e === void 0 ? void 0 : e.message) || String(e)}`);
    }
    throw new Error('AB_ReMonitorAndSearchArr: transcode failure — arr notified, flow forced to error page.');
};
exports.plugin = plugin;
