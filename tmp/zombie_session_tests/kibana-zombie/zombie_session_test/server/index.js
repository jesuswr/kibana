'use strict';

const { execSync } = require('child_process');
const { firstValueFrom } = require('rxjs');

const activeRules = [];
let cleanupRegistered = false;

function sh(cmd) {
  try {
    const output = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    return { success: true, output };
  } catch (e) {
    return { success: false, output: e.stderr ? e.stderr.toString().trim() : e.message };
  }
}

function registerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const cleanup = () => {
    for (const rule of activeRules) {
      sh(rule.replace(' -A ', ' -D '));
    }
    activeRules.length = 0;
  };

  process.on('exit', cleanup);
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
}

class ZombieSessionTestPlugin {
  setup(core) {
    const router = core.http.createRouter();
    registerCleanup();

    router.post(
      {
        path: '/api/zombie_session_test/blackhole',
        security: {
          authz: { enabled: false, reason: 'Test route for zombie session reproduction' },
        },
        validate: {
          body: (value) => {
            if (value && typeof value === 'object') return { value };
            return { value: {} };
          },
        },
      },
      async (context, req, res) => {
        let targets = req.body.targets;
        const direction = req.body.direction || 'both';

        if (!targets || targets.length === 0) {
          const esConfig = await firstValueFrom(core.elasticsearch.legacy.config$);
          targets = esConfig.hosts.map((hostUrl) => {
            const url = new URL(hostUrl);
            const port = url.port
              ? parseInt(url.port, 10)
              : url.protocol === 'https:' ? 443 : 80;
            return { host: url.hostname, port };
          });
        }

        const iptablesCheck = sh('which iptables');
        if (!iptablesCheck.success) {
          return res.customError({
            statusCode: 500,
            body: { message: 'iptables not found. Is it installed in the Docker image?' },
          });
        }

        const permCheck = sh('iptables -L -n');
        if (!permCheck.success) {
          return res.customError({
            statusCode: 500,
            body: {
              message: `iptables permission denied. Container needs NET_ADMIN and root. Error: ${permCheck.output}`,
            },
          });
        }

        const appliedRules = [];
        const errors = [];

        for (const target of targets) {
          const { host, port } = target;
          const rules = [];

          if (direction === 'output' || direction === 'both') {
            rules.push(`iptables -A OUTPUT -p tcp -d ${host} --dport ${port} -j DROP`);
          }
          if (direction === 'input' || direction === 'both') {
            rules.push(`iptables -A INPUT -p tcp -s ${host} --sport ${port} -j DROP`);
          }

          for (const rule of rules) {
            const result = sh(rule);
            if (result.success) {
              activeRules.push(rule);
              appliedRules.push(rule);
            } else {
              errors.push(`Failed: ${rule} -- ${result.output}`);
            }
          }
        }

        return res.ok({
          body: { applied: appliedRules, errors, targets, activeRuleCount: activeRules.length },
        });
      }
    );

    router.delete(
      {
        path: '/api/zombie_session_test/blackhole',
        security: {
          authz: { enabled: false, reason: 'Test route for zombie session reproduction' },
        },
        validate: false,
      },
      async (context, req, res) => {
        const removedRules = [];
        const errors = [];

        for (const rule of [...activeRules]) {
          const deleteRule = rule.replace(' -A ', ' -D ');
          const result = sh(deleteRule);
          if (result.success) {
            removedRules.push(deleteRule);
          } else {
            errors.push(`Failed: ${deleteRule} -- ${result.output}`);
          }
        }
        activeRules.length = 0;

        return res.ok({
          body: { removed: removedRules, errors, activeRuleCount: activeRules.length },
        });
      }
    );

    router.get(
      {
        path: '/api/zombie_session_test/status',
        security: {
          authz: { enabled: false, reason: 'Test route for zombie session reproduction' },
        },
        validate: false,
      },
      async (context, req, res) => {
        const esConfig = await firstValueFrom(core.elasticsearch.legacy.config$);
        const iptablesListing = sh('iptables -L -n --line-numbers');

        return res.ok({
          body: {
            platform: process.platform,
            uid: process.getuid ? process.getuid() : 'N/A',
            nodeVersion: process.version,
            esHosts: esConfig.hosts,
            activeRules,
            activeRuleCount: activeRules.length,
            iptablesAvailable: sh('which iptables').success,
            iptablesListing: iptablesListing.output,
          },
        });
      }
    );

    return {};
  }

  start() { return {}; }
  stop() {}
}

module.exports.plugin = () => new ZombieSessionTestPlugin();
