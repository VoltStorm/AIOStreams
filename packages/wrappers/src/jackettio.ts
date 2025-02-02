import { AddonDetail, StreamRequest } from '@aiostreams/types';
import { ParsedStream, Config } from '@aiostreams/types';
import { BaseWrapper } from './base';
import { addonDetails } from '@aiostreams/utils';
import { Settings } from '@aiostreams/utils';

// name, title, url
export class Jackettio extends BaseWrapper {
  constructor(
    configString: string | null,
    overrideUrl: string | null,
    addonName: string = 'Jackettio',
    addonId: string,
    userConfig: Config,
    indexerTimeout?: number
  ) {
    let url = overrideUrl
      ? overrideUrl
      : Settings.JACKETTIO_URL + (configString ? configString + '/' : '');

    super(
      addonName,
      url,
      addonId,
      userConfig,
      indexerTimeout || Settings.DEFAULT_JACKETTIO_TIMEOUT
    );
  }
}

const getJackettioConfigString = (
  debridService: string,
  debridApiKey: string
) => {
  return Buffer.from(
    JSON.stringify({
      maxTorrents: 30,
      priotizePackTorrents: 2,
      excludeKeywords: [],
      debridId: debridService,
      hideUncached: false,
      sortCached: [
        ['quality', true],
        ['size', true],
      ],
      sortUncached: [['seeders', true]],
      forceCacheNextEpisode: false,
      priotizeLanguages: [],
      indexerTimeoutSec: 60,
      metaLanguage: '',
      enableMediaFlow: false,
      mediaflowProxyUrl: '',
      mediaflowApiPassword: '',
      mediaflowPublicIp: '',
      qualities: [0, 360, 480, 720, 1080, 2160],
      indexers: ['bitsearch', 'eztv', 'thepiratebay', 'therarbg', 'yts'],
      debridApiKey: debridApiKey,
    })
  ).toString('base64');
};

export async function getJackettioStreams(
  config: Config,
  jackettioOptions: {
    prioritiseDebrid?: string;
    overrideUrl?: string;
    indexerTimeout?: string;
    overrideName?: string;
  },
  streamRequest: StreamRequest,
  addonId: string
): Promise<{
  addonStreams: ParsedStream[];
  addonErrors: string[];
}> {
  const supportedServices: string[] =
    addonDetails.find((addon: AddonDetail) => addon.id === 'jackettio')
      ?.supportedServices || [];
  const addonStreams: ParsedStream[] = [];

  const indexerTimeout = jackettioOptions.indexerTimeout
    ? parseInt(jackettioOptions.indexerTimeout)
    : undefined;

  // If overrideUrl is provided, use it to get streams and skip all other steps
  if (jackettioOptions.overrideUrl) {
    const jackettio = new Jackettio(
      null,
      jackettioOptions.overrideUrl as string,
      jackettioOptions.overrideName,
      addonId,
      config,
      indexerTimeout
    );
    return jackettio.getParsedStreams(streamRequest);
  }

  // find all usable and enabled services
  const usableServices = config.services.filter(
    (service) => supportedServices.includes(service.id) && service.enabled
  );

  // if no usable services found, throw an error
  if (usableServices.length < 1) {
    throw new Error('No supported service(s) enabled');
  }

  // otherwise, depending on the configuration, create multiple instances of jackettio or use a single instance with the prioritised service

  if (
    jackettioOptions.prioritiseDebrid &&
    !supportedServices.includes(jackettioOptions.prioritiseDebrid)
  ) {
    throw new Error('Invalid debrid service');
  }

  if (jackettioOptions.prioritiseDebrid) {
    const debridService = usableServices.find(
      (service) => service.id === jackettioOptions.prioritiseDebrid
    );
    if (!debridService) {
      throw new Error(
        'Debrid service not found for ' + jackettioOptions.prioritiseDebrid
      );
    }
    if (!debridService.credentials.apiKey) {
      throw new Error(
        'Debrid service API key not found for ' +
          jackettioOptions.prioritiseDebrid
      );
    }

    // get the jackettio config and b64 encode it

    const configString = getJackettioConfigString(
      debridService.id,
      debridService.credentials.apiKey
    );
    const jackettio = new Jackettio(
      configString,
      null,
      jackettioOptions.overrideName,
      addonId,
      config,
      indexerTimeout
    );

    return jackettio.getParsedStreams(streamRequest);
  }

  // if no prioritised service is provided, create a jackettio instance for each service
  const addonErrors: string[] = [];
  const servicesToUse = usableServices.filter((service) => service.enabled);
  if (servicesToUse.length < 1) {
    throw new Error('No supported service(s) enabled');
  }

  const streamPromises = servicesToUse.map(async (service) => {
    const configString = getJackettioConfigString(
      service.id,
      service.credentials.apiKey
    );
    const jackettio = new Jackettio(
      configString,
      null,
      jackettioOptions.overrideName,
      addonId,
      config,
      indexerTimeout
    );
    return jackettio.getParsedStreams(streamRequest);
  });

  const streamsArray = await Promise.allSettled(streamPromises);
  streamsArray.forEach((result) => {
    if (result.status === 'fulfilled') {
      addonStreams.push(...result.value.addonStreams);
      addonErrors.push(...result.value.addonErrors);
    } else {
      addonErrors.push(result.reason.message);
    }
  });

  return {
    addonStreams,
    addonErrors,
  };
}
