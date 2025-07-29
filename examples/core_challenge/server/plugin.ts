/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { Plugin, PluginInitializerContext, CoreSetup, CoreStart } from '@kbn/core/server';
import { registerRoutes } from './src/routes';
import { todoElementSavedObjectType } from './src/types';
import { ConfigType } from './src/config';

export class CoreChallengeServerPlugin implements Plugin {
  private readonly config: ConfigType;

  constructor(initializerContext: PluginInitializerContext) {
    this.config = initializerContext.config.get<ConfigType>();
  }

  public setup(core: CoreSetup) {
    // called when plugin is setting up during Kibana's startup sequence
    registerRoutes(core.http.createRouter(), this.config);

    const savedObjects = core.savedObjects;
    savedObjects.registerType(todoElementSavedObjectType);
  }

  public start(core: CoreStart) {
    // called after all plugins are set up
  }

  public stop() {
    // called when plugin is torn down during Kibana's shutdown sequence
  }
}
