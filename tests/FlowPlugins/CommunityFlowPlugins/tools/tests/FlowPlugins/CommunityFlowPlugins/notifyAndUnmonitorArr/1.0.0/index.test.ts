import { plugin } from
  '../../../../../../FlowPluginsTs/CommunityFlowPlugins/arr/notifyAndUnmonitorArr/1.0.0/index';
import { IpluginInputArgs } from '../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/interfaces/interfaces';
import { IFileObject } from '../../../../../../FlowPluginsTs/FlowHelpers/1.0.0/interfaces/synced/IFileObject';
import getConfigVars from '../../../../configVars';

const sampleH264 = require('../../../../../sampleData/media/sampleH264_1.json');

describe('AK_NotifyAndUnmonitorArr Plugin', () => {
  let baseArgs: IpluginInputArgs;

  beforeEach(() => {
    baseArgs = {
      inputs: {
        sonarr_host: 'http://localhost:8989',
        sonarr_api_key: 'test-sonarr-key',
        sonarr_4k_host: '',
        sonarr_4k_api_key: '',
        radarr_host: 'http://localhost:7878',
        radarr_api_key: 'test-radarr-key',
        radarr_4k_host: '',
        radarr_4k_api_key: '',
        unmonitor_after_refresh: false,
        timeout_ms: 15000,
      },
      variables: {} as IpluginInputArgs['variables'],
      inputFileObj: JSON.parse(JSON.stringify(sampleH264)) as IFileObject,
      originalLibraryFile: {
        _id: '/movies/The Movie (2021)/The Movie.tt1234567.2021.1080p.BluRay.x264-GROUP.mkv',
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
    } as unknown as IpluginInputArgs;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /* ------------------------------------------------------------------ */
  describe('Path detection — TV vs Movie', () => {
    it('should detect a Season folder as TV', async () => {
      baseArgs.originalLibraryFile._id = '/tv/Show Name/Season 1/Show.Name.S01E01.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValue({ data: [] });

      await plugin(baseArgs);

      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('SONARR'),
      );
    });

    it('should detect a Series folder as TV', async () => {
      baseArgs.originalLibraryFile._id = '/tv/Show Name/Series 1/Show.Name.S01E01.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValue({ data: [] });

      await plugin(baseArgs);

      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('SONARR'),
      );
    });

    it('should detect SxxEyy pattern in filename as TV', async () => {
      baseArgs.originalLibraryFile._id = '/tv/Show.Name.S03E12.1080p.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValue({ data: [] });

      await plugin(baseArgs);

      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('SONARR'),
      );
    });

    it('should route non-TV path to Radarr', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValue({ data: [] });

      await plugin(baseArgs);

      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('RADARR'),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  describe('4K routing with fallback', () => {
    it('should route 4K path to 4K Radarr instance when configured', async () => {
      baseArgs.originalLibraryFile._id = '/movies/4K/The Movie (2021)/The Movie.tt1234567.2160p.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;
      baseArgs.inputs.radarr_4k_host = 'http://localhost:7879';
      baseArgs.inputs.radarr_4k_api_key = 'test-radarr-4k-key';

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValue({ data: [] });

      await plugin(baseArgs);

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('localhost:7879'),
        }),
      );
    });

    it('should fall back to HD Radarr when 4K host not configured', async () => {
      baseArgs.originalLibraryFile._id = '/movies/4K/The Movie (2021)/The Movie.tt1234567.2160p.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValue({ data: [] });

      await plugin(baseArgs);

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('localhost:7878'),
        }),
      );
    });

    it('should fall back to HD Sonarr when 4K host not configured', async () => {
      baseArgs.originalLibraryFile._id = '/tv/Show Name/Series 1/Show.Name.S01E01.2160p.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValue({ data: [] });

      await plugin(baseArgs);

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('localhost:8989'),
        }),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Radarr — refresh', () => {
    it('should refresh movie found via IMDB lookup and return output 1', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios
        .mockResolvedValueOnce({ data: [{ id: 123 }] })  // IMDB lookup
        .mockResolvedValueOnce({ data: {} });             // POST command

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.jobLog).toHaveBeenCalledWith("Movie '123' found for imdb 'tt1234567'");
      expect(baseArgs.jobLog).toHaveBeenCalledWith("✔ Movie '123' refreshed in radarr.");
    });

    it('should return output 2 when movie not found', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios
        .mockResolvedValueOnce({ data: [] })   // IMDB lookup — not found
        .mockResolvedValueOnce({ data: {} });  // parse fallback — not found

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
    });

    it('should fall back to parse API when IMDB lookup returns nothing', async () => {
      baseArgs.originalLibraryFile._id = '/movies/Some Movie (2021)/Some.Movie.2021.1080p.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios
        .mockResolvedValueOnce({ data: { movie: { id: 456 } } })  // parse response
        .mockResolvedValueOnce({ data: {} });                      // POST command

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('/api/v3/parse'),
        }),
      );
    });

    it('should strip trailing slash from host URL', async () => {
      baseArgs.inputs.radarr_host = 'http://localhost:7878/';

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValue({ data: [] });

      await plugin(baseArgs);

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('localhost:7878/api/v3'),
        }),
      );
      expect(mockAxios).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('localhost:7878//api/v3'),
        }),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Sonarr — refresh', () => {
    beforeEach(() => {
      baseArgs.originalLibraryFile._id = '/tv/Show Name/Season 1/Show.Name.tt7654321.S01E05.1080p.WEB-DL.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;
    });

    it('should refresh episode found via IMDB lookup and return output 1', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios
        .mockResolvedValueOnce({ data: [{ id: 789 }] })  // IMDB lookup
        .mockResolvedValueOnce({ data: {} });             // POST command

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
      expect(baseArgs.jobLog).toHaveBeenCalledWith("Serie '789' found for imdb 'tt7654321'");
    });

    it('should return output 2 when series not found', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: {} });

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(2);
    });

    it('should detect Series folder name as TV (UK naming)', async () => {
      baseArgs.originalLibraryFile._id = '/tv/Show Name/Series 2/Show.Name.tt7654321.S02E03.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios.mockResolvedValue({ data: [] });

      await plugin(baseArgs);

      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('SONARR'),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Unmonitor — Radarr', () => {
    beforeEach(() => {
      baseArgs.inputs.unmonitor_after_refresh = true;
    });

    it('should unmonitor movie after successful refresh', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios
        .mockResolvedValueOnce({ data: [{ id: 123 }] })                      // IMDB lookup
        .mockResolvedValueOnce({ data: {} })                                  // POST command (refresh)
        .mockResolvedValueOnce({ data: { id: 123, monitored: true, title: 'The Movie' } }) // GET movie
        .mockResolvedValueOnce({ data: {} });                                 // PUT unmonitor

      await plugin(baseArgs);

      expect(baseArgs.jobLog).toHaveBeenCalledWith('✔ Radarr: movie id=123 unmonitored');
    });

    it('should skip unmonitor when movie id not resolved', async () => {
      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: {} });

      await plugin(baseArgs);

      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('not found for refresh'),
      );
      expect(baseArgs.jobLog).not.toHaveBeenCalledWith(
        expect.stringContaining('unmonitored'),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  describe('Unmonitor — Sonarr', () => {
    beforeEach(() => {
      baseArgs.inputs.unmonitor_after_refresh = true;
      baseArgs.originalLibraryFile._id = '/tv/Show Name/Season 1/Show.Name.tt7654321.S01E05.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;
    });

    it('should unmonitor episode via PUT /episode/monitor', async () => {
      const putMock = jest.fn().mockResolvedValue({});
      (baseArgs.deps.axios as any).put = putMock;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios
        .mockResolvedValueOnce({ data: [{ id: 789 }] })                // IMDB lookup
        .mockResolvedValueOnce({ data: {} })                            // POST command (refresh)
        .mockResolvedValueOnce({ data: [{ id: 501, seasonNumber: 1, episodeNumber: 5 }] }); // GET episodes

      await plugin(baseArgs);

      expect(putMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v3/episode/monitor'),
        expect.objectContaining({ monitored: false, episodeIds: [501] }),
        expect.anything(),
      );
    });

    it('should fall back to PUT /episode when /episode/monitor returns 404', async () => {
      const putMock = jest.fn()
        .mockRejectedValueOnce({ response: { status: 404 } })  // /episode/monitor fails
        .mockResolvedValueOnce({});                             // /episode succeeds
      const getMock = jest.fn().mockResolvedValue({ data: { id: 501, seasonNumber: 1, episodeNumber: 5, monitored: true } });
      (baseArgs.deps.axios as any).put = putMock;
      (baseArgs.deps.axios as any).get = getMock;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios
        .mockResolvedValueOnce({ data: [{ id: 789 }] })
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: [{ id: 501, seasonNumber: 1, episodeNumber: 5 }] });

      await plugin(baseArgs);

      expect(putMock).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/v3/episode'),
        expect.arrayContaining([expect.objectContaining({ monitored: false })]),
        expect.anything(),
      );
    });

    it('should log warning when SxxEyy not detected in path', async () => {
      baseArgs.originalLibraryFile._id = '/tv/Show Name/Season 1/Show.Name.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;
      baseArgs.inputs.sonarr_host = 'http://localhost:8989';

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios
        .mockResolvedValueOnce({ data: [{ id: 789 }] })
        .mockResolvedValueOnce({ data: {} });

      await plugin(baseArgs);

      expect(baseArgs.jobLog).toHaveBeenCalledWith(
        expect.stringContaining('SxxEyy not detected'),
      );
    });
  });

  /* ------------------------------------------------------------------ */
  describe('S00 specials', () => {
    it('should handle S00 specials without error', async () => {
      baseArgs.originalLibraryFile._id = '/tv/Show Name/Season 0/Show.Name.tt7654321.S00E01.mkv';
      baseArgs.inputFileObj._id = baseArgs.originalLibraryFile._id;

      const mockAxios = baseArgs.deps.axios as jest.MockedFunction<() => Promise<unknown>>;
      mockAxios
        .mockResolvedValueOnce({ data: [{ id: 789 }] })
        .mockResolvedValueOnce({ data: {} });

      const result = await plugin(baseArgs);

      expect(result.outputNumber).toBe(1);
    });
  });
});
