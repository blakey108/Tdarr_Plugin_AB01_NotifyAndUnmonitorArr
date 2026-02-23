import { plugin } from
  '../../../../../../FlowPluginsTs/CommunityFlowPlugins/tools/notifyAndUnmonitorArr/1.0.0/index';
import { IpluginInputArgs } from '../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/interfaces/interfaces';
import { IFileObject } from '../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/interfaces/synced/IFileObject';
import getConfigVars from '../../../../configVars';

const sampleH264 = require('../../../../../sampleData/media/sampleH264_1.json');

// Helper to build base args
const buildBaseArgs = (
  overrides: Partial<IpluginInputArgs['inputs']> = {},
): IpluginInputArgs => ({
  inputs: {
    sonarr_host: 'http://localhost:8989',
    sonarr_api_key: 'sonarr-key',
    sonarr_4k_host: '',
    sonarr_4k_api_key: '',
    radarr_host: 'http://localhost:7878',
    radarr_api_key: 'radarr-key',
    radarr_4k_host: '',
    radarr_4k_api_key: '',
    unmonitor_after_refresh: 'true',
    timeout_ms: '5000',
    ...overrides,
  },
  variables: {} as IpluginInputArgs['variables'],
  inputFileObj: JSON.parse(JSON.stringify(sampleH264)) as IFileObject,
  originalLibraryFile: {
    _id: '/media/movies/The.Movie.tt1234567.2021.1080p.BluRay.x264/The.Movie.tt1234567.2021.1080p.mkv',
  } as IFileObject,
  jobLog: jest.fn(),
  deps: {
    axios: jest.fn(),
    fsextra: {},
    parseArgsStringToArgv: jest.fn(),
    importFresh: jest.fn(),
    axiosMiddleware: jest.fn(),
    requireFromString: jest.fn(),
    yargsParser: jest.fn(),
    fs: {},
    path: {},
    os: {},
    nodeModules: {},
    configVars: getConfigVars(),
  },
} as unknown as IpluginInputArgs);

describe('notifyAndUnmonitorArr Plugin', () => {
  let baseArgs: IpluginInputArgs;

  beforeEach(() => {
    baseArgs = buildBaseArgs();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Path detection ────────────────────────────────────────────────────────

  describe('path detection', () => {
    it('routes a TV path (SxxEyy in filename) to Sonarr', async () => {
      baseArgs.originalLibraryFile._id = '/media/tv/Breaking.Bad/Season 01/Breaking.Bad.tt0903747.S01E01.1080p.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      // IMDB series/lookup → found
      mockAxios.mockResolvedValueOnce({ data: [{ id: 42 }] });
      // RefreshSeries command
      mockAxios.mockResolvedValueOnce({ data: {} });
      // GET /episode list for unmonitor
      mockAxios.mockResolvedValueOnce({ data: [{ id: 99, seasonNumber: 1, episodeNumber: 1 }] });
      // PUT /episode/monitor
      (baseArgs.deps.axios as any).put = jest.fn().mockResolvedValue({});

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('8989') }),
      );
    });

    it('routes a movie path to Radarr', async () => {
      // originalLibraryFile is already a movie path (default baseArgs)
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      // IMDB lookup
      mockAxios.mockResolvedValueOnce({ data: [{ id: 1588 }] });
      // RefreshMovie command
      mockAxios.mockResolvedValueOnce({ data: {} });
      // GET /movie/{id} for unmonitor
      mockAxios.mockResolvedValueOnce({ data: { id: 1588, monitored: true, title: 'The Movie' } });
      // PUT /movie/{id}
      mockAxios.mockResolvedValueOnce({ data: {} });

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('7878') }),
      );
    });

    it('detects 4K path and uses 4K Radarr instance', async () => {
      baseArgs = buildBaseArgs({
        radarr_4k_host: 'http://localhost:7879',
        radarr_4k_api_key: 'radarr-4k-key',
      });
      baseArgs.originalLibraryFile._id = '/media/movies/4K/The.Movie.tt1234567.2160p.UHD.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValueOnce({ data: [{ id: 200 }] });
      mockAxios.mockResolvedValueOnce({ data: {} });
      mockAxios.mockResolvedValueOnce({ data: { id: 200, monitored: true } });
      mockAxios.mockResolvedValueOnce({ data: {} });

      await plugin(baseArgs);

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('7879') }),
      );
    });

    it('falls back to HD Radarr when 4K host is empty', async () => {
      baseArgs.originalLibraryFile._id = '/media/movies/4K/The.Movie.tt1234567.2160p.UHD.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;
      // 4K host not set — should fall back to HD host (7878)

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValueOnce({ data: [{ id: 200 }] });
      mockAxios.mockResolvedValueOnce({ data: {} });
      mockAxios.mockResolvedValueOnce({ data: { id: 200, monitored: true } });
      mockAxios.mockResolvedValueOnce({ data: {} });

      await plugin(baseArgs);

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('7878') }),
      );
    });
  });

  // ─── Radarr refresh ────────────────────────────────────────────────────────

  describe('Radarr refresh', () => {
    it('refreshes movie via IMDB lookup and returns output 1', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValueOnce({ data: [{ id: 1588 }] }); // IMDB lookup
      mockAxios.mockResolvedValueOnce({ data: {} }); // command
      mockAxios.mockResolvedValueOnce({ data: { id: 1588, monitored: true } }); // GET movie
      mockAxios.mockResolvedValueOnce({ data: {} }); // PUT movie

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.jobLog).toHaveBeenCalledWith(expect.stringContaining("'1588' found"));
      expect(baseArgs.jobLog).toHaveBeenCalledWith(expect.stringContaining('refreshed in radarr'));
    });

    it('falls back to parse API when IMDB not found', async () => {
      baseArgs.originalLibraryFile._id = '/media/movies/No.IMDB.Movie.2021.1080p.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValueOnce({ data: { movie: { id: 999 } } }); // parse
      mockAxios.mockResolvedValueOnce({ data: {} }); // command
      mockAxios.mockResolvedValueOnce({ data: { id: 999, monitored: true } }); // GET movie
      mockAxios.mockResolvedValueOnce({ data: {} }); // PUT movie

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('/api/v3/parse') }),
      );
    });

    it('returns output 2 when movie not found at all', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValueOnce({ data: [] }); // IMDB lookup — empty
      mockAxios.mockResolvedValueOnce({ data: { movie: null } }); // parse — not found

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
      expect(baseArgs.jobLog).toHaveBeenCalledWith(expect.stringContaining('not found for refresh'));
    });

    it('strips trailing slash from host URL', async () => {
      baseArgs = buildBaseArgs({ radarr_host: 'http://localhost:7878/' });
      baseArgs.originalLibraryFile._id = '/media/movies/The.Movie.tt1234567.2021.1080p.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValueOnce({ data: [{ id: 1 }] });
      mockAxios.mockResolvedValueOnce({ data: {} });
      mockAxios.mockResolvedValueOnce({ data: { id: 1, monitored: true } });
      mockAxios.mockResolvedValueOnce({ data: {} });

      await plugin(baseArgs);

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:7878/api/v3/movie/lookup',
        }),
      );
    });
  });

  // ─── Radarr unmonitor ──────────────────────────────────────────────────────

  describe('Radarr unmonitor', () => {
    it('unmonitors movie after refresh', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValueOnce({ data: [{ id: 1588 }] }); // IMDB lookup
      mockAxios.mockResolvedValueOnce({ data: {} }); // command
      mockAxios.mockResolvedValueOnce({ data: { id: 1588, monitored: true, title: 'The Movie' } }); // GET
      mockAxios.mockResolvedValueOnce({ data: {} }); // PUT

      await plugin(baseArgs);

      // 4th call should be the PUT to unmonitor
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'put', url: expect.stringContaining('/api/v3/movie/1588') }),
      );
      expect(baseArgs.jobLog).toHaveBeenCalledWith('✔ Radarr: movie id=1588 unmonitored');
    });

    it('skips unmonitor when flag is false', async () => {
      baseArgs = buildBaseArgs({ unmonitor_after_refresh: 'false' });
      baseArgs.originalLibraryFile._id = '/media/movies/The.Movie.tt1234567.2021.1080p.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValueOnce({ data: [{ id: 1 }] }); // IMDB lookup
      mockAxios.mockResolvedValueOnce({ data: {} }); // command

      await plugin(baseArgs);

      // Only 2 axios calls — no unmonitor GET/PUT
      expect(mockAxios).toHaveBeenCalledTimes(2);
      expect(baseArgs.jobLog).not.toHaveBeenCalledWith(expect.stringContaining('unmonitored'));
    });
  });

  // ─── Sonarr refresh + unmonitor ────────────────────────────────────────────

  describe('Sonarr refresh + unmonitor', () => {
    beforeEach(() => {
      baseArgs.originalLibraryFile._id = '/media/tv/Breaking.Bad/Season 01/Breaking.Bad.tt0903747.S01E01.1080p.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;
    });

    it('refreshes series and unmonitors episode via PUT /episode/monitor', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      // IMDB series/lookup → found
      mockAxios.mockResolvedValueOnce({ data: [{ id: 42 }] });
      // RefreshSeries command
      mockAxios.mockResolvedValueOnce({ data: {} });
      // GET /episode
      mockAxios.mockResolvedValueOnce({
        data: [{ id: 99, seasonNumber: 1, episodeNumber: 1 }],
      });
      (baseArgs.deps.axios as any).put = jest.fn().mockResolvedValue({});

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect((baseArgs.deps.axios as any).put).toHaveBeenCalledWith(
        expect.stringContaining('/api/v3/episode/monitor'),
        { monitored: false, episodeIds: [99] },
        expect.any(Object),
      );
      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('unmonitored S1E1 (episodeId=99) via PUT /episode/monitor'),
      );
    });

    it('falls back to PUT /episode when /episode/monitor returns 405', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      // IMDB series/lookup → found
      mockAxios.mockResolvedValueOnce({ data: [{ id: 42 }] });
      // RefreshSeries command
      mockAxios.mockResolvedValueOnce({ data: {} });
      // GET /episode
      mockAxios.mockResolvedValueOnce({ data: [{ id: 99, seasonNumber: 1, episodeNumber: 1 }] });

      const err405 = Object.assign(new Error('Method Not Allowed'), { response: { status: 405 } });
      const mockPut = jest.fn()
        .mockRejectedValueOnce(err405) // PUT /episode/monitor → 405
        .mockResolvedValueOnce({}); // PUT /episode
      const mockGet = jest.fn().mockResolvedValue({ data: { id: 99, monitored: true } });
      (baseArgs.deps.axios as any).put = mockPut;
      (baseArgs.deps.axios as any).get = mockGet;

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(mockPut).toHaveBeenCalledTimes(2);
      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to PUT /episode'),
      );
      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('via PUT /episode'),
      );
    });

    it('logs and skips unmonitor when episode not found in Sonarr', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      // IMDB series/lookup → found
      mockAxios.mockResolvedValueOnce({ data: [{ id: 42 }] });
      // RefreshSeries command
      mockAxios.mockResolvedValueOnce({ data: {} });
      // GET /episode → empty list
      mockAxios.mockResolvedValueOnce({ data: [] });

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1); // still refreshed
      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('not found in seriesId 42'),
      );
    });

    it('handles Series folder name as TV detection', async () => {
      baseArgs.originalLibraryFile._id = '/media/tv/Breaking Bad/Series 1/Breaking.Bad.S01E01.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValueOnce({ data: { series: { id: 10 } } });
      mockAxios.mockResolvedValueOnce({ data: {} });
      mockAxios.mockResolvedValueOnce({ data: [{ id: 5, seasonNumber: 1, episodeNumber: 1 }] });
      (baseArgs.deps.axios as any).put = jest.fn().mockResolvedValue({});

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('8989') }),
      );
    });
  });

  // ─── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('catches refresh errors and returns output 2', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockRejectedValueOnce(new Error('Connection refused')); // IMDB lookup fails
      mockAxios.mockRejectedValueOnce(new Error('Connection refused')); // parse also fails

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('Arr refresh error: Connection refused'),
      );
    });

    it('throws when host is missing', async () => {
      baseArgs = buildBaseArgs({ radarr_host: '' });
      baseArgs.originalLibraryFile._id = '/media/movies/The.Movie.tt1234567.2021.1080p.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      await expect(plugin(baseArgs)).rejects.toThrow('Missing radarr HD host or API key');
    });

    it('catches unmonitor errors non-fatally and still returns output 1', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValueOnce({ data: [{ id: 1588 }] }); // IMDB lookup
      mockAxios.mockResolvedValueOnce({ data: {} }); // command
      mockAxios.mockRejectedValueOnce(new Error('Radarr GET failed')); // GET movie for unmonitor

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('Unmonitor error: Radarr GET failed'),
      );
    });
  });

  // ─── Misc ──────────────────────────────────────────────────────────────────

  describe('misc', () => {
    it('warns when sonarr host looks like radarr', async () => {
      baseArgs.originalLibraryFile._id = '/media/tv/Show/Season 1/Show.S01E01.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;
      baseArgs = buildBaseArgs({ sonarr_host: 'http://localhost:7878-radarr' });
      baseArgs.originalLibraryFile._id = '/media/tv/Show/Season 1/Show.S01E01.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValueOnce({ data: { series: { id: 1 } } });
      mockAxios.mockResolvedValueOnce({ data: {} });
      mockAxios.mockResolvedValueOnce({ data: [] }); // no episodes found

      await plugin(baseArgs);

      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        'Warning: target=sonarr but host looks like Radarr',
      );
    });

    it('tries currentFileName when originalFileName lookup fails', async () => {
      baseArgs.originalLibraryFile._id = '/old/path/The.Movie.tt1234567.mkv';
      baseArgs.inputFileObj._id = '/new/transcoded/The.Movie.tt9999999.mkv';

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      // original IMDB lookup → not found
      mockAxios.mockResolvedValueOnce({ data: [] });
      // original parse → not found
      mockAxios.mockResolvedValueOnce({ data: { movie: null } });
      // current IMDB lookup → found
      mockAxios.mockResolvedValueOnce({ data: [{ id: 777 }] });
      // command
      mockAxios.mockResolvedValueOnce({ data: {} });
      // GET movie for unmonitor
      mockAxios.mockResolvedValueOnce({ data: { id: 777, monitored: true } });
      // PUT movie
      mockAxios.mockResolvedValueOnce({ data: {} });

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.jobLog).toHaveBeenCalledWith(expect.stringContaining("'777' found"));
    });
  });
});
