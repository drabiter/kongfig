import {fetchOauth2, fetchOauthClient} from './adminApi';
import requester from './requester';
import yaml from 'js-yaml';
import {migrateOauth2Token} from './actions';
import createRouter from './router';

import program from 'commander';
import assign from 'object-assign';

program
    .version(require("../package.json").version)
    .option('--source <value>', 'Kong admin host (default: localhost:8001)', 'localhost:8001')
    .option('--dest <value>', 'Kong admin host (default: localhost:8001)', 'localhost:8001')
    .option('--https', 'Use https for admin API requests')
    .option('--header [value]', 'Custom headers to be added to all requests', (nextHeader, headers) => { headers.push(nextHeader); return headers }, [])
    .parse(process.argv);

if (!program.source || !program.dest) {
    console.error('--host to the kong admin is required e.g. localhost:8001'.red);
    process.exit(1);
}

let headers = program.header || [];
let router = createRouter(program.dest, program.https);

headers
    .map((h) => h.split(':'))
    .forEach(([name, value]) => requester.addHeader(name, value));
            
async function sleep(millis) {
      return new Promise(resolve => setTimeout(resolve, millis));
}

fetchOauth2({ host: program.source, https: program.https})
    .then(results => {
        results.forEach(async r => {
            await sleep(1000);
            // console.log(r);
            fetchOauthClient({ host: program.source, https: program.https, id: r.credential_id})
                .then(c1 => {
                    fetchOauthClient({ host: program.dest, https: program.https, id: c1.client_id})
                        .then(c2 => {
                            console.log(`${c1.id} ${c1.client_id} ${c2.id} ${c2.client_id}`);
                            let params = migrateOauth2Token(assign({}, r, { credential_id: c2.id }));
                            console.log(params.endpoint);
                            requester.request(router(params.endpoint), {
                                method: params.method,
                                headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json'
                                  },
                                body: JSON.stringify(params.body)
                            })
                            .then(resp => {
                                if (resp.status == 201) {
                                    console.log(`${r.id} ${c1.client_id} migrated\n\n`);
                                } else if (resp.status == 409) {
                                    console.log(`${r.id} ${c1.client_id} existed\n\n`);
                                } else {
                                    console.log(`${r.id} ${c1.client_id} got ${resp.status}\n\n`);
                                }
                            })
                            .catch(err => console.error(err));
                        })
                        .catch(err => console.error(err));
                })
                .catch(err => console.error(err));
        });
    })
    .catch(error => {
        console.error(`${error}`.red, '\n', error.stack);
        process.exit(1);
    });
