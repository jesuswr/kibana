/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Plugin, PluginInitializerContext, CoreSetup, CoreStart } from '@kbn/core/server';

export class CoreChallengeServerPlugin implements Plugin {
  constructor(initializerContext: PluginInitializerContext) {}

  public setup(core: CoreSetup) {
    // called when plugin is setting up during Kibana's startup sequence
    const router = core.http.createRouter();
    router.get(
      {
        path: '/api/todos',
        validate: false,
        security: { authz: { enabled: false, reason: 'testing' } },
      },
      (context, req, res) => res.ok({ body: { response: 'ok' } })
    );
  }

  public start(core: CoreStart) {
    // called after all plugins are set up
  }

  public stop() {
    // called when plugin is torn down during Kibana's shutdown sequence
  }
}
