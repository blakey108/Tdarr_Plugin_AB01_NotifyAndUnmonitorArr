"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = exports.details = void 0;
/* -------------- small helpers -------------- */
var PATH_SEP = /[\\/]/;
var getFileName = function (p) { return String(p || '').split(PATH_SEP).pop() || ''; };
var getDirParts = function (p) { return String(p || '').split(PATH_SEP).filter(Boolean); };
var stripTrailingSlashes = function (u) { return String(u || '').replace(/\/+$/, ''); };
var toBool = function (v) {
    if (typeof v === 'boolean')
        return v;
    if (typeof v === 'string')
        return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
    return !!v;
};
var parseSxxEyyFromPath = function (p) {
    var base = getFileName(p);
    var m = base.match(/S(\d{1,2})E(\d{1,3})/i);
    return m ? { season: Number(m[1]), episode: Number(m[2]) } : { season: null, episode: null };
};
var looksLikeTvPath = function (p) {
    var parts = getDirParts(p);
    if (parts.some(function (x) { return /^(?:Season|Series)\s+\d+$/i.test(x); }))
        return true;
    var _a = parseSxxEyyFromPath(p), season = _a.season, episode = _a.episode;
    return season !== null && episode !== null;
};
var getSeriesTitleFromPath = function (p) {
    var parts = getDirParts(p);
    for (var i = 1; i < parts.length; i += 1) {
        if (/^(?:Season|Series)\s+\d+$/i.test(parts[i]))
            return parts[i - 1];
    }
    var base = getFileName(p).replace(/\.(mkv|mp4|avi|ts|m4v)$/i, '');
    var idx = base.search(/S\d{1,2}E\d{1,3}/i);
    return (idx > 0 ? base.slice(0, idx) : base).replace(/[._]+/g, ' ').trim();
};
var tvdbIdFromPath = function (p) {
    var m = String(p || '').match(/\{tvdb-(\d+)\}/i);
    return m ? Number(m[1]) : null;
};
var is4KPath = function (p) {
    var s = String(p || '').toLowerCase();
    return /\b(2160p|uhd|4k)\b/.test(s) || /[\s._-](uhd|4k)[\s._-]/.test(s);
};
/* -------------- plugin details -------------- */
var details = function () { return ({
    name: 'AB_NotifyAndUnmonitorArr',
    description: 'Post-transcode plugin that refreshes Sonarr or Radarr and optionally unmonitors the item. '
        + 'Auto-detects TV vs movie from file path and routes to the correct HD or 4K instance based '
        + 'on path tokens (2160p/UHD/4K). Supports dual Sonarr and dual Radarr instances. No file management.',
    style: { borderColor: 'green' },
    tags: 'arr,sonarr,radarr,unmonitor,notify,post',
    isStartPlugin: false,
    pType: '',
    requiresVersion: '2.00.00',
    sidebarPosition: -1,
    icon: 'faBell',
    inputs: [
        {
            label: 'Sonarr Host',
            name: 'sonarr_host',
            type: 'string',
            defaultValue: '',
            inputUI: { type: 'text' },
            tooltip: 'Base URL for Sonarr. No trailing slash. e.g. http://192.168.1.1:8989',
        },
        {
            label: 'Sonarr API Key',
            name: 'sonarr_api_key',
            type: 'string',
            defaultValue: '',
            inputUI: { type: 'text' },
            tooltip: 'X-Api-Key for Sonarr',
        },
        {
            label: 'Sonarr 4K Host',
            name: 'sonarr_4k_host',
            type: 'string',
            defaultValue: '',
            inputUI: { type: 'text' },
            tooltip: '(Optional) Base URL for 4K Sonarr. Falls back to Sonarr Host if not set.',
        },
        {
            label: 'Sonarr 4K API Key',
            name: 'sonarr_4k_api_key',
            type: 'string',
            defaultValue: '',
            inputUI: { type: 'text' },
            tooltip: '(Optional) X-Api-Key for 4K Sonarr. Falls back to Sonarr API Key if not set.',
        },
        {
            label: 'Radarr Host',
            name: 'radarr_host',
            type: 'string',
            defaultValue: '',
            inputUI: { type: 'text' },
            tooltip: 'Base URL for Radarr. No trailing slash. e.g. http://192.168.1.1:7878',
        },
        {
            label: 'Radarr API Key',
            name: 'radarr_api_key',
            type: 'string',
            defaultValue: '',
            inputUI: { type: 'text' },
            tooltip: 'X-Api-Key for Radarr',
        },
        {
            label: 'Radarr 4K Host',
            name: 'radarr_4k_host',
            type: 'string',
            defaultValue: '',
            inputUI: { type: 'text' },
            tooltip: '(Optional) Base URL for 4K Radarr. Falls back to Radarr Host if not set.',
        },
        {
            label: 'Radarr 4K API Key',
            name: 'radarr_4k_api_key',
            type: 'string',
            defaultValue: '',
            inputUI: { type: 'text' },
            tooltip: '(Optional) X-Api-Key for 4K Radarr. Falls back to Radarr API Key if not set.',
        },
        {
            label: 'Unmonitor after refresh',
            name: 'unmonitor_after_refresh',
            type: 'boolean',
            defaultValue: 'true',
            inputUI: { type: 'switch' },
            tooltip: 'If enabled: Radarr → unmonitor movie; Sonarr → unmonitor SxxEyy episode.',
        },
        {
            label: 'Timeout (ms)',
            name: 'timeout_ms',
            type: 'number',
            defaultValue: '15000',
            inputUI: { type: 'text' },
            tooltip: 'HTTP timeout in milliseconds.',
        },
    ],
    outputs: [
        { number: 1, tooltip: 'Arr notified (and possibly unmonitored)' },
        { number: 2, tooltip: 'Arr item not found' },
    ],
}); };
exports.details = details;
/* -------------- HTTP helpers -------------- */
var httpTimeout = function (args) { return Number(args.inputs.timeout_ms || 15000); };
var arrPOST = function (args, base, path, headers, data) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, args.deps.axios({
                method: 'post', url: "".concat(base).concat(path),
                headers: headers,
                data: data,
                timeout: httpTimeout(args),
            })];
    });
}); };
var arrGET = function (args, base, path, headers, params) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, args.deps.axios({
                method: 'get', url: "".concat(base).concat(path),
                headers: headers,
                params: params,
                timeout: httpTimeout(args),
            })];
    });
}); };
var arrPUT = function (args, base, path, headers, data) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, args.deps.axios({
                method: 'put', url: "".concat(base).concat(path),
                headers: headers,
                data: data,
                timeout: httpTimeout(args),
            })];
    });
}); };
/* -------------- ID resolution -------------- */
var getId = function (args, arrApp, fileName) { return __awaiter(void 0, void 0, void 0, function () {
    var imdbId, id, r, parsedName, p;
    var _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                imdbId = (_b = ((_a = /\btt\d{7,10}\b/i.exec(fileName)) === null || _a === void 0 ? void 0 : _a.at(0))) !== null && _b !== void 0 ? _b : '';
                id = -1;
                if (!imdbId) return [3 /*break*/, 2];
                return [4 /*yield*/, arrGET(args, arrApp.host, "/api/v3/".concat(arrApp.name === 'radarr' ? 'movie' : 'series', "/lookup"), arrApp.headers, { term: "imdb:".concat(imdbId) })];
            case 1:
                r = _f.sent();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                id = Number((_e = (_d = (_c = r.data) === null || _c === void 0 ? void 0 : _c.at(0)) === null || _d === void 0 ? void 0 : _d.id) !== null && _e !== void 0 ? _e : -1);
                args.jobLog("".concat(arrApp.content, " ").concat(id !== -1 ? "'".concat(id, "' found") : 'not found', " for imdb '").concat(imdbId, "'"));
                _f.label = 2;
            case 2:
                if (!(id === -1)) return [3 /*break*/, 4];
                parsedName = getFileName(fileName);
                return [4 /*yield*/, arrGET(args, arrApp.host, '/api/v3/parse', arrApp.headers, { title: parsedName })];
            case 3:
                p = _f.sent();
                id = arrApp.delegates.getIdFromParseResponse(p);
                args.jobLog("".concat(arrApp.content, " ").concat(id !== -1 ? "'".concat(id, "' found") : 'not found', " for '").concat(parsedName, "'"));
                _f.label = 4;
            case 4: return [2 /*return*/, id];
        }
    });
}); };
/* -------------- Sonarr helpers -------------- */
var lookupSonarrSeriesId = function (args, base, headers, srcPath) { return __awaiter(void 0, void 0, void 0, function () {
    var tvdb, lk, hit, title, lookup;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tvdb = tvdbIdFromPath(srcPath);
                if (!tvdb) return [3 /*break*/, 2];
                return [4 /*yield*/, arrGET(args, base, '/api/v3/series/lookup', headers, { term: "tvdb:".concat(tvdb) })];
            case 1:
                lk = _a.sent();
                hit = Array.isArray(lk.data) && lk.data.length ? lk.data[0].id : -1;
                if (hit !== -1)
                    return [2 /*return*/, hit];
                _a.label = 2;
            case 2:
                title = getSeriesTitleFromPath(srcPath);
                if (!title)
                    return [2 /*return*/, -1];
                return [4 /*yield*/, arrGET(args, base, '/api/v3/series/lookup', headers, { term: title })];
            case 3:
                lookup = _a.sent();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return [2 /*return*/, (Array.isArray(lookup.data) && lookup.data.length) ? lookup.data[0].id : -1];
        }
    });
}); };
var unmonitorSonarrEpisode = function (args, base, apiKey, seriesId, season, episode) { return __awaiter(void 0, void 0, void 0, function () {
    var headers, timeout, eps, match, e_1, code, epFull, payload;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                headers = {
                    'X-Api-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json',
                };
                timeout = httpTimeout(args);
                return [4 /*yield*/, arrGET(args, base, '/api/v3/episode', headers, { seriesId: seriesId })];
            case 1:
                eps = _b.sent();
                match = Array.isArray(eps.data)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ? eps.data.find(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    function (e) { return Number(e.seasonNumber) === Number(season) && Number(e.episodeNumber) === Number(episode); })
                    : null;
                if (!match) {
                    args.jobLog("Sonarr: episode S".concat(season, "E").concat(episode, " not found in seriesId ").concat(seriesId));
                    return [2 /*return*/, false];
                }
                _b.label = 2;
            case 2:
                _b.trys.push([2, 4, , 5]);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return [4 /*yield*/, args.deps.axios.put("".concat(base, "/api/v3/episode/monitor"), { monitored: false, episodeIds: [match.id] }, { headers: headers, timeout: timeout, params: { includeImages: false } })];
            case 3:
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                _b.sent();
                args.jobLog("\u2714 Sonarr: unmonitored S".concat(season, "E").concat(episode, " (episodeId=").concat(match.id, ") via PUT /episode/monitor"));
                return [2 /*return*/, true];
            case 4:
                e_1 = _b.sent();
                code = (_a = e_1 === null || e_1 === void 0 ? void 0 : e_1.response) === null || _a === void 0 ? void 0 : _a.status;
                if (code !== 405 && code !== 404)
                    throw e_1;
                args.jobLog("Sonarr /episode/monitor unsupported (".concat(code, "). Falling back to PUT /episode"));
                return [3 /*break*/, 5];
            case 5: return [4 /*yield*/, args.deps.axios.get("".concat(base, "/api/v3/episode/").concat(match.id), { headers: headers, timeout: timeout })];
            case 6:
                epFull = _b.sent();
                payload = Object.assign({}, epFull.data, { monitored: false });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return [4 /*yield*/, args.deps.axios.put("".concat(base, "/api/v3/episode"), [payload], { headers: headers, timeout: timeout })];
            case 7:
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                _b.sent();
                args.jobLog("\u2714 Sonarr: unmonitored S".concat(season, "E").concat(episode, " (episodeId=").concat(match.id, ") via PUT /episode"));
                return [2 /*return*/, true];
        }
    });
}); };
var unmonitorSonarrByPath = function (args, base, apiKey, srcPath, seriesIdFromRefresh) { return __awaiter(void 0, void 0, void 0, function () {
    var sxe, headers, seriesId, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                sxe = parseSxxEyyFromPath(srcPath);
                if (sxe.season === null || sxe.episode === null) {
                    args.jobLog("Sonarr: cannot unmonitor \u2013 SxxEyy not detected in \"".concat(srcPath, "\""));
                    return [2 /*return*/, false];
                }
                headers = {
                    'X-Api-Key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json',
                };
                if (!(seriesIdFromRefresh && seriesIdFromRefresh !== -1)) return [3 /*break*/, 1];
                _a = seriesIdFromRefresh;
                return [3 /*break*/, 3];
            case 1: return [4 /*yield*/, lookupSonarrSeriesId(args, base, headers, srcPath)];
            case 2:
                _a = _b.sent();
                _b.label = 3;
            case 3:
                seriesId = _a;
                if (seriesId === -1) {
                    args.jobLog('Sonarr: series id not resolved for unmonitor.');
                    return [2 /*return*/, false];
                }
                return [2 /*return*/, unmonitorSonarrEpisode(args, base, apiKey, seriesId, sxe.season, sxe.episode)];
        }
    });
}); };
/* -------------- Radarr helpers -------------- */
var unmonitorRadarr = function (args, base, headers, movieId) { return __awaiter(void 0, void 0, void 0, function () {
    var m, payload;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, arrGET(args, base, "/api/v3/movie/".concat(movieId), headers)];
            case 1:
                m = _a.sent();
                payload = Object.assign({}, m.data, { monitored: false });
                return [4 /*yield*/, arrPUT(args, base, "/api/v3/movie/".concat(movieId), headers, payload)];
            case 2:
                _a.sent();
                args.jobLog("\u2714 Radarr: movie id=".concat(movieId, " unmonitored"));
                return [2 /*return*/];
        }
    });
}); };
/* -------------- app config (HD/4K with fallback) -------------- */
var pickInstance = function (args, appName, is4k) {
    if (appName === 'sonarr') {
        var hdHost_1 = stripTrailingSlashes(String(args.inputs.sonarr_host || ''));
        var hdKey_1 = String(args.inputs.sonarr_api_key || '');
        var host_1 = stripTrailingSlashes(is4k ? (String(args.inputs.sonarr_4k_host || '') || hdHost_1) : hdHost_1);
        var key_1 = String(is4k ? (String(args.inputs.sonarr_4k_api_key || '') || hdKey_1) : hdKey_1);
        var headers_1 = {
            'X-Api-Key': key_1, 'Content-Type': 'application/json', Accept: 'application/json',
        };
        return {
            name: 'sonarr',
            host: host_1,
            key: key_1,
            headers: headers_1,
            content: 'Serie',
            delegates: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                getIdFromParseResponse: function (resp) { var _a, _b, _c; return Number((_c = (_b = (_a = resp === null || resp === void 0 ? void 0 : resp.data) === null || _a === void 0 ? void 0 : _a.series) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : -1); },
                buildRefreshRequest: function (id) { return ({ name: 'RefreshSeries', seriesId: id }); },
            },
        };
    }
    var hdHost = stripTrailingSlashes(String(args.inputs.radarr_host || ''));
    var hdKey = String(args.inputs.radarr_api_key || '');
    var host = stripTrailingSlashes(is4k ? (String(args.inputs.radarr_4k_host || '') || hdHost) : hdHost);
    var key = String(is4k ? (String(args.inputs.radarr_4k_api_key || '') || hdKey) : hdKey);
    var headers = {
        'X-Api-Key': key, 'Content-Type': 'application/json', Accept: 'application/json',
    };
    return {
        name: 'radarr',
        host: host,
        key: key,
        headers: headers,
        content: 'Movie',
        delegates: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            getIdFromParseResponse: function (resp) { var _a, _b, _c; return Number((_c = (_b = (_a = resp === null || resp === void 0 ? void 0 : resp.data) === null || _a === void 0 ? void 0 : _a.movie) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : -1); },
            buildRefreshRequest: function (id) { return ({ name: 'RefreshMovie', movieIds: [id] }); },
        },
    };
};
/* -------------- main plugin -------------- */
var plugin = function (args) { return __awaiter(void 0, void 0, void 0, function () {
    var lib, originalFileName, currentFileName, srcPath, isTv, is4k, unmonitorFlag, target, arrApp, id, refreshed, e_2, e_3;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                lib = require('../../../../../methods/lib')();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars,no-param-reassign
                args.inputs = lib.loadDefaultValues(args.inputs, details);
                originalFileName = ((_a = args.originalLibraryFile) === null || _a === void 0 ? void 0 : _a._id) || '';
                currentFileName = ((_b = args.inputFileObj) === null || _b === void 0 ? void 0 : _b._id) || '';
                srcPath = currentFileName || originalFileName || '';
                isTv = looksLikeTvPath(srcPath);
                is4k = is4KPath(srcPath);
                unmonitorFlag = toBool(args.inputs.unmonitor_after_refresh);
                target = isTv ? 'sonarr' : 'radarr';
                arrApp = pickInstance(args, target, is4k);
                if (!arrApp.host || !arrApp.key) {
                    throw new Error("Missing ".concat(arrApp.name, " ").concat(is4k ? '4K' : 'HD', " host or API key"));
                }
                if (arrApp.name === 'sonarr' && /radarr/i.test(arrApp.host)) {
                    args.jobLog('Warning: target=sonarr but host looks like Radarr');
                }
                if (arrApp.name === 'radarr' && /sonarr/i.test(arrApp.host)) {
                    args.jobLog('Warning: target=radarr but host looks like Sonarr');
                }
                args.jobLog("AB_NotifyAndUnmonitorArr start \u2014 detected: ".concat(target.toUpperCase(), " ").concat(is4k ? '4K' : 'HD'));
                id = -1;
                refreshed = false;
                _c.label = 1;
            case 1:
                _c.trys.push([1, 8, , 9]);
                args.jobLog('Going to force scan');
                args.jobLog("Refreshing ".concat(arrApp.name, "..."));
                return [4 /*yield*/, getId(args, arrApp, originalFileName)];
            case 2:
                id = _c.sent();
                if (!(id === -1 && currentFileName && currentFileName !== originalFileName)) return [3 /*break*/, 4];
                return [4 /*yield*/, getId(args, arrApp, currentFileName)];
            case 3:
                id = _c.sent();
                _c.label = 4;
            case 4:
                if (!(id !== -1)) return [3 /*break*/, 6];
                return [4 /*yield*/, arrPOST(args, arrApp.host, '/api/v3/command', arrApp.headers, arrApp.delegates.buildRefreshRequest(id))];
            case 5:
                _c.sent();
                refreshed = true;
                args.jobLog("\u2714 ".concat(arrApp.content, " '").concat(id, "' refreshed in ").concat(arrApp.name, "."));
                return [3 /*break*/, 7];
            case 6:
                args.jobLog("".concat(arrApp.content, " not found for refresh."));
                _c.label = 7;
            case 7: return [3 /*break*/, 9];
            case 8:
                e_2 = _c.sent();
                args.jobLog("Arr refresh error: ".concat((e_2 === null || e_2 === void 0 ? void 0 : e_2.message) || String(e_2)));
                return [3 /*break*/, 9];
            case 9:
                if (!unmonitorFlag) return [3 /*break*/, 17];
                _c.label = 10;
            case 10:
                _c.trys.push([10, 16, , 17]);
                if (!(arrApp.name === 'radarr' && id !== -1)) return [3 /*break*/, 12];
                return [4 /*yield*/, unmonitorRadarr(args, arrApp.host, arrApp.headers, id)];
            case 11:
                _c.sent();
                return [3 /*break*/, 15];
            case 12:
                if (!(arrApp.name === 'sonarr' && srcPath)) return [3 /*break*/, 14];
                return [4 /*yield*/, unmonitorSonarrByPath(args, arrApp.host, arrApp.key, srcPath, id)];
            case 13:
                _c.sent();
                return [3 /*break*/, 15];
            case 14:
                args.jobLog('Unmonitor skipped (insufficient context).');
                _c.label = 15;
            case 15: return [3 /*break*/, 17];
            case 16:
                e_3 = _c.sent();
                args.jobLog("Unmonitor error: ".concat((e_3 === null || e_3 === void 0 ? void 0 : e_3.message) || String(e_3)));
                return [3 /*break*/, 17];
            case 17: return [2 /*return*/, {
                    outputFileObj: args.inputFileObj,
                    outputNumber: refreshed ? 1 : 2,
                    variables: args.variables,
                }];
        }
    });
}); };
exports.plugin = plugin;
