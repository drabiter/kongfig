import semVer from 'semver';
import kongState from './kongState';
import { parseUpstreams } from './parsers/upstreams';
import { parseCertificates } from './parsers/certificates';
import getCurrentStateSelector from './stateSelector';

export default async (adminApi) => {
    return Promise.all([kongState(adminApi), adminApi.fetchPluginSchemas(), adminApi.fetchKongVersion()])
        .then(([state, schemas, version]) => {
            return getCurrentStateSelector({
                _info: { version },
                services: parseServices(state.services),
                routes: parseRoutes(state.routes, version),
                consumers: parseConsumers(state.consumers),
                plugins: parseGlobalPlugins(state.plugins),
                upstreams: semVer.gte(version, '0.10.0') ? parseUpstreams(state.upstreams) : undefined,
                certificates: semVer.gte(version, '0.10.0') ? parseCertificates(state.certificates) : undefined,
            });
        })
};

function parseServices(services) {
    return services.map(({
        id, created_at, host, port, connect_timeout, read_timeout, write_timeout,
        protocol, name, path, retries }) => {
            return {
                name,
                attributes: {
                    host,
                    port,
                    connect_timeout,
                    read_timeout,
                    write_timeout,
                    protocol,
                    path,
                    retries
                },
                _info: {
                    id,
                    created_at
                }
            };
        });
}

export const parseConsumer = ({ username, custom_id, credentials, acls, ..._info }) => {
    return {
        username,
        custom_id,
        _info,
    };
};

export const parseAcl = ({group, ..._info}) => ({group, _info});

function parseConsumers(consumers) {
    return consumers.map(({username, custom_id, credentials, acls, ..._info}) => {
        return {
            ...parseConsumer({ username, custom_id, ..._info}),
            acls: Array.isArray(acls) ? acls.map(parseAcl) : [],
            credentials: zip(Object.keys(credentials), Object.values(credentials))
                .map(parseCredential)
                .reduce((acc, x) => acc.concat(x), [])
        };
    });
}

function zip(a, b) {
    return a.map((n, index) => [n, b[index]]);
}

function parseCredential([credentialName, credentials]) {
    if (!Array.isArray(credentials)) {
      return [];
    }

    return credentials.map(({consumer_id, id, created_at, ...attributes}) => {
        return {
            name: credentialName,
            attributes,
            _info: {id, consumer_id, created_at}
        }
    });
}

function parseRoutes(routes, kongVersion) {
    if (semVer.gte(kongVersion, '0.14.0')) {
        return parseApisV14(routes);
    }
    if (semVer.gte(kongVersion, '0.10.0')) {
        return parseApisV10(routes);
    }

    return parseApisBeforeV10(routes);
}

const parseApiPreV10 = ({
    name,
    request_host, request_path, strip_request_path, preserve_host, upstream_url,
    id, created_at}) => {
    return {
        name,
        plugins: [],
        attributes: {
            request_host,
            request_path,
            strip_request_path,
            preserve_host,
            upstream_url,
        },
        _info: {
            id,
            created_at
        }
    };
};

export const parseApiPostV10 = ({
    name, plugins,
    hosts, uris, methods,
    strip_uri, preserve_host, upstream_url, id, created_at,
    https_only, http_if_terminated,
    retries, upstream_connect_timeout, upstream_read_timeout, upstream_send_timeout}) => {
    return {
        name,
        attributes: {
            hosts,
            uris,
            methods,
            strip_uri,
            preserve_host,
            upstream_url,
            retries,
            upstream_connect_timeout,
            upstream_read_timeout,
            upstream_send_timeout,
            https_only,
            http_if_terminated
        },
        _info: {
            id,
            created_at
        }
    };
};

export const parseRoute = ({
    service, hosts, paths, methods, plugins,
    strip_path, preserve_host, id, created_at, regex_priority}) => {
    return {
        plugins,
        attributes: {
            service: {
                name: service.name
            },
            hosts,
            paths,
            methods,
            strip_path,
            preserve_host,
            regex_priority
        },
        _info: {
            id,
            created_at,
            service_id: service.id
        }
    };
};

const withParseApiPlugins = (parseApi) => route => {
    const { ...rest } = parseApi(route);

    return { ...rest, plugins: parseApiPlugins(route.plugins) };
};

function parseApisBeforeV10(apis) {
    return apis.map(withParseApiPlugins(parseApiPreV10));
}

function parseApisV10(apis) {
    return apis.map(withParseApiPlugins(parseApiPostV10));
}

function parseApisV14(apis) {
    return apis.map(withParseApiPlugins(parseRoute));
}

export const parsePlugin = ({
    name,
    config,
    id, route_id, consumer_id, enabled
}) => {
    return {
        name,
        attributes: {
            enabled,
            consumer_id,
            config: stripConfig(config)
        },
        _info: {
            id,
            route_id,
            consumer_id
        }
    };
};

function parseApiPlugins(plugins) {
    if (!Array.isArray(plugins)) {
      return [];
    }

    return plugins.map(parsePlugin);
}

export const parseGlobalPlugin = ({
    name,
    enabled,
    config,
    id, api_id, consumer_id, created_at
}) => {
    return {
        name,
        attributes: {
            enabled,
            consumer_id,
            config: stripConfig(config)
        },
        _info: {
            id,
            api_id,
            consumer_id,
            created_at
        }
    };
};

function parseGlobalPlugins(plugins) {
    if (!Array.isArray(plugins)) {
      return [];
    }

    return plugins
        .map(parseGlobalPlugin)
        .filter(x => x.name);
}

function stripConfig(config) {
    const mutableConfig = {...config};

    // remove some cache values
    delete mutableConfig['_key_der_cache'];
    delete mutableConfig['_cert_der_cache'];

    return mutableConfig;
}
