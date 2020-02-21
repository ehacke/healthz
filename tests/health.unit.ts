/* eslint-disable unicorn/import-index */
import Bluebird from 'bluebird';
import { expect } from 'chai';

import { CONNECT_STATUS, HEALTH_STATUS, Healthz } from '../index';

describe('health service tests', () => {
  it('returns healthy when all services are healthy', async () => {
    const clients = [
      {
        NAME: 'redis',
        ping: async () => true,
      },
      {
        NAME: 'postgres',
        ping: async () => true,
      },
    ];

    const health = new Healthz(clients, 100);

    const result = {
      services: {
        postgres: CONNECT_STATUS.CONNECTED,
        redis: CONNECT_STATUS.CONNECTED,
      },
      status: HEALTH_STATUS.HEALTHY,
    };

    expect(await health.check()).to.eql(result);
  });

  it('returns unhealthy when one service rejects', async () => {
    const clients = [
      {
        NAME: 'redis',
        ping: () => Promise.reject(new Error('fail')),
      },
      {
        NAME: 'postgres',
        ping: async () => true,
      },
    ];

    const health = new Healthz(clients, 100);

    const result = {
      services: {
        postgres: CONNECT_STATUS.CONNECTED,
        redis: CONNECT_STATUS.DISCONNECTED,
      },
      status: HEALTH_STATUS.UNHEALTHY,
    };

    expect(await health.check()).to.eql(result);
  });

  it('returns unhealthy when one service returns false from ping', async () => {
    const clients = [
      {
        NAME: 'redis',
        ping: async () => false,
      },
      {
        NAME: 'postgres',
        ping: async () => true,
      },
    ];

    const health = new Healthz(clients, 100);

    const result = {
      services: {
        postgres: CONNECT_STATUS.CONNECTED,
        redis: CONNECT_STATUS.DISCONNECTED,
      },
      status: HEALTH_STATUS.UNHEALTHY,
    };

    expect(await health.check()).to.eql(result);
  });

  it('returns unhealthy when one service throws during ping', async () => {
    const clients = [
      {
        NAME: 'redis',
        ping: () => {
          throw new Error('boom');
        },
      },
      {
        NAME: 'postgres',
        ping: async () => true,
      },
    ];

    const health = new Healthz(clients, 100);

    const result = {
      services: {
        postgres: CONNECT_STATUS.CONNECTED,
        redis: CONNECT_STATUS.DISCONNECTED,
      },
      status: HEALTH_STATUS.UNHEALTHY,
    };

    expect(await health.check()).to.eql(result);
  });

  it('returns unhealthy when one service takes too long during ping', async () => {
    const clients = [
      {
        NAME: 'redis',
        ping: () => Bluebird.delay(200),
      },
      {
        NAME: 'postgres',
        ping: async () => true,
      },
    ];

    const health = new Healthz(clients, 100);

    const result = {
      services: {
        postgres: CONNECT_STATUS.CONNECTED,
        redis: CONNECT_STATUS.DISCONNECTED,
      },
      status: HEALTH_STATUS.UNHEALTHY,
    };

    expect(await health.check()).to.eql(result);
  });
});
