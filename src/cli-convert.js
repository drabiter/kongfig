import execute from './core';
import adminApi from './adminApi';
import colors from 'colors';
import configLoader from './configLoader';
import program from 'commander';
import requester from './requester';
import {repeatableOptionCallback} from './utils';
import { screenLogger } from './logger';
import {addSchemasFromOptions, addSchemasFromConfig} from './consumerCredentials';
import {pretty} from './prettyConfig';

program
    .version(require("../package.json").version)
    .option('--path <value>', 'Path to the configuration file')
    .option('--host <value>', 'Kong admin host (default: localhost:8001)')
    .option('--https', 'Use https for admin API requests')
    .option('--no-cache', 'Do not cache kong state in memory')
    .option('--ignore-consumers', 'Do not sync consumers')
    .option('--header [value]', 'Custom headers to be added to all requests', (nextHeader, headers) => { headers.push(nextHeader); return headers }, [])
    .option('--credential-schema <value>', 'Add custom auth plugin in <name>:<key> format. Ex: custom_jwt:key. Repeat option for multiple custom plugins', repeatableOptionCallback, [])
    .parse(process.argv);

if (!program.path) {
  console.error('--path to the config file is required'.red);
  process.exit(1);
}

try{
    addSchemasFromOptions(program.credentialSchema);
}catch(e){
    console.error(e.message.red);
    process.exit(1);
}

console.log(`Loading config ${program.path}`);

let config = configLoader(program.path);
let host = program.host || config.host || 'localhost:8001';
let https = program.https || config.https || false;
let ignoreConsumers = program.ignoreConsumers || !config.consumers || config.consumers.length === 0 || false;
let cache = program.cache;

config.headers = config.headers || [];

let headers = new Map();
([...config.headers, ...program.header])
  .map((h) => h.split(':'))
  .forEach(([name, value]) => headers.set(name, value));

headers
  .forEach((value, name) => requester.addHeader(name, value));

if (!host) {
  console.error('Kong admin host must be specified in config or --host'.red);
  process.exit(1);
}

if (ignoreConsumers) {
    config.consumers = [];
}
else {
  try{
      addSchemasFromConfig(config);
  } catch(e) {
      console.error(e.message.red);
      process.exit(1);
  }
}

let output = { };
output.consumers = config.consumers;
output.plugins = config.plugins.map(p => {
  if (p.name == 'statsd') {
    delete p.attributes.config.metrics;
    delete p.attributes.config.timeout;
  }
  return p;
});
output.services = config.services;
output.routes = config.apis.map(api => {
  let _name = undefined;
  if (api.attributes.upstream_url.includes('hermes')) {
    _name = (api.attributes.upstream_url.includes('merchants'))? 'hermes-merchant' : 'hermes';
    _name = (api.attributes.upstream_url.includes('api'))? 'hermes-api' : 'hermes';
  }
  if (api.attributes.upstream_url.includes('phoenix')) {
    _name = (api.attributes.upstream_url.includes('ping'))? 'phoenix-ping' : 'phoenix';
  }
  if (api.attributes.upstream_url.includes('papi')) {
    _name = (api.attributes.upstream_url.includes('ping'))? 'papi-ping' : 'papi';
  }
  if (api.attributes.upstream_url.includes('payment-api')) {
    _name = (api.attributes.upstream_url.includes('ping'))? 'papi-ping' : 'papi';
  }
  if (api.attributes.upstream_url.includes('promo')) {
    _name = (api.attributes.upstream_url.includes('ping'))? 'promo-app-ping' : 'promo-app';
  }
  if (api.attributes.upstream_url.includes('saudagar')) {
    _name = (api.attributes.upstream_url.includes('ping'))? 'saudagar-ping' : 'saudagar';
  }
  if (api.attributes.upstream_url.includes('pato')) _name = 'pato';
  if (api.attributes.upstream_url.includes('transcript')) {
    _name = (api.attributes.upstream_url.includes('3ds'))? 'transcript-3ds' : 'transcript';
  }
  if (api.attributes.upstream_url.includes('rhea-api')) {
    _name = (api.attributes.upstream_url.includes('public'))? 'rhea-api-public' : 'rhea-api';
    _name = (api.attributes.upstream_url.includes('transactions'))? 'rhea-transaction' : 'rhea-api';
  }
  if (api.attributes.upstream_url.includes('paycon')) _name = 'paycon';
  if (api.attributes.upstream_url.includes('athena-ui')) {
    _name = (api.attributes.upstream_url.includes('account'))? 'iris-ui-account-validation' : (api.attributes.upstream_url.includes('iris'))? 'iris-ui-api' : 'iris-ui';
  }
  if (api.attributes.upstream_url.includes('wallstreet')) {
    _name = (api.attributes.upstream_url.includes('payouts'))? 'wallstreet-merchant-payouts' : 'wallstreet';
    _name = (api.attributes.upstream_url.includes('billings'))? 'wallstreet-merchant-billings' : 'wallstreet';
  }
  if (api.attributes.upstream_url.includes('nexus')) {
    _name = (api.attributes.upstream_url.includes('api'))? 'nexus-api' : 'nexus';
  }
  if (api.attributes.upstream_url.includes('ex-pegasus')) _name = 'ex-pegasus';
  if (!_name) {
    console.error(api.attributes.upstream_url);
    process.exit(1);
  }

  let _plugins = api.plugins || [];

  const phoenix_host = 'phoenix-consul.stg.veritrans.co.id';
  const papi_host = 'payment-api-consul.stg.veritrans.co.id';
  const snap_host = 'midtrans-checkout.stg.veritrans.co.id';
  const rba_host = 'promo-app-consul.stg.veritrans.co.id';
  const rba_port = 443;
  const promo_host = 'promo-app-consul.stg.veritrans.co.id';
  const promo_port = 443;

  // const phoenix_host = 'phoenix-consul.mid.veritrans.co.id';
  // const papi_host = 'payment-api-consul.mid.veritrans.co.id';
  // const snap_host = 'midtrans-checkout.mid.veritrans.co.id';
  // const rba_host = 'promo-app-consul.mid.veritrans.co.id';
  // const rba_port = 443;
  // const promo_host = 'promo-app-consul.mid.veritrans.co.id';
  // const promo_port = 443;

  return {
    plugins: _plugins.map(p => {

      if (p.name.includes('piloting')) {
        let _p = {
          ...p,
          attributes: {
            ...p.attributes,
            config: {
              ...p.attributes.config,
              papi_host: papi_host,
              phoenix_host: phoenix_host,
              papi_port: 8080,
              phoenix_port: 8080
            }
          }
        };
        delete _p.attributes.config.papi_url;
        delete _p.attributes.config.phoenix_url;
        return _p;
      }

      if (p.name == 'router-payment') {
        let _p = {
          ...p,
          attributes: {
            ...p.attributes,
            config: {
              ...p.attributes.config,
              host: phoenix_host,
              port: 8080
            }
          }
        };
        delete _p.attributes.config.target;
        return _p;
      }

      if (p.name == 'router-payment-type') {
        let _p = {
          ...p,
          attributes: {
            ...p.attributes,
            config: {
              ...p.attributes.config,
              phoenix_host: phoenix_host,
              phoenix_port: 8080
            }
          }
        };
        delete _p.attributes.config.papi_host;
        return _p;
      }

      if (p.name == 'router-random') {
        let _p = {
          ...p,
          attributes: {
            ...p.attributes,
            config: {
              ...p.attributes.config,
              upstream_host: '',
              upstream_port: 8081
            }
          }
        };
        return _p;
      }

      if (p.name == 'router-vtweb-snap') {
        let _p = {
          ...p,
          attributes: {
            ...p.attributes,
            config: {
              ...p.attributes.config,
              snap_host: snap_host,
              snap_path: '/snap/v2/charge',
              snap_port: 443
            }
          }
        };
        return _p;
      }

      if (p.name == 'router-rba') {
        let _p = {
          ...p,
          attributes: {
            ...p.attributes,
            config: {
              ...p.attributes.config,
              rba_host: rba_host,
              rba_port: rba_port
            }
          }
        };
        return _p;
      }

      if (p.name == 'router-promo') {
        let _p = {
          ...p,
          attributes: {
            ...p.attributes,
            config: {
              ...p.attributes.config,
              promo_host: promo_host,
              promo_port: promo_port
            }
          }
        };
        return _p;
      }

      if (p.name == 'statsd-uri') {
        delete p.attributes.config.timeout;
        delete p.attributes.config.metrics;
        return p;
      }

      if (p.name == 'cors' && p.attributes.config.credentials) {
        delete p.attributes.config.origin;
        return p;
      }

      return p;

    }),
    attributes: {
      service: { name: _name },
      preserve_host: api.attributes.preserve_host,
      paths: [api.attributes.request_path].filter(p => p != null),
      hosts: [api.attributes.request_host].filter(h => h != null),
      methods: [api.attributes.request_host].filter(h => h != null),
      strip_path: api.attributes.strip_request_path
    }
  };
});
process.stdout.write(pretty('yaml')(output) + '\n');
