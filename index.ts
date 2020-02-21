import Bluebird from 'bluebird';
import { isBoolean, isFunction, isObject, isString } from 'lodash';
import pino from 'pino';

const log = pino({ prettyPrint: true });

const CHECK_TIMEOUT_MSEC = 1000;

export interface ClientInterface {
  NAME: string;
  ping(): Promise<boolean>;
}

export interface HealthSummaryInterface {
  services: { [k: string]: CONNECT_STATUS };
  status: HEALTH_STATUS;
}

export enum HEALTH_STATUS {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
}

export enum CONNECT_STATUS {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
}

/**
 * @class
 */
export class Healthz {
  private readonly clients: ClientInterface[];

  private readonly pingTimeoutMs: number;

  /**
   * @param {array<object>} clients clients to check the health of
   * @param {number} [pingTimeoutMs=1000] ping timeout
   */
  constructor(clients, pingTimeoutMs = CHECK_TIMEOUT_MSEC) {
    if (!Array.isArray(clients)) {
      throw new TypeError('clients must be an array');
    }

    clients.forEach((client) => {
      if (!isObject(client) || !isFunction(client.ping) || !isString(client.NAME)) {
        throw new TypeError(`client ${client.NAME} must have ping() function and client.NAME must be a string`);
      }
    });

    this.clients = clients;
    this.pingTimeoutMs = pingTimeoutMs;
  }

  /**
   * Check the health of each client
   * @return {Promise<HealthSummaryInterface>}
   */
  async check(): Promise<HealthSummaryInterface> {
    const wrapPing = async (client): Promise<{ name: string; found: boolean; error?: any }> => {
      const pingResult = await Bluebird.try(() => client.ping())
        .timeout(this.pingTimeoutMs)
        .catch((error) => ({
          found: false,
          error,
        }));

      if (!pingResult || (isBoolean(pingResult.found) && !pingResult.found)) {
        const error = !pingResult ? 'ping returned falsey' : pingResult.error;

        log.error(`Error: '${error}' during ping of service: ${client.NAME}`);

        return {
          name: client.NAME,
          found: false,
          error,
        };
      }
      return {
        name: client.NAME,
        found: true,
      };
    };

    const healthCheckResults = await Bluebird.map(this.clients, (client) => wrapPing(client));

    const healthSummary = {
      services: {},
      status: healthCheckResults.every((result) => result.found) ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.UNHEALTHY,
    };

    return healthCheckResults.reduce((results, result) => {
      results.services[result.name] = result.found ? CONNECT_STATUS.CONNECTED : CONNECT_STATUS.DISCONNECTED;
      return results;
    }, healthSummary);
  }
}
