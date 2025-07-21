/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import ReactDOM from 'react-dom';
import type {
  AppMountParameters,
  CoreSetup,
  CoreStart,
  Plugin,
  PluginInitializerContext,
} from '@kbn/core/public';
import { DeveloperExamplesSetup } from '@kbn/developer-examples-plugin/public';

interface SetupDeps {
  developerExamples: DeveloperExamplesSetup;
}

export class CoreChallengePlugin implements Plugin<void, void, SetupDeps> {
  constructor(context: PluginInitializerContext) {}

  public setup(core: CoreSetup, deps: SetupDeps) {
    // Register an application into the side navigation menu
    core.application.register({
      id: 'coreChallenge',
      title: 'Core Challenge',
      async mount({ element }: AppMountParameters) {
        ReactDOM.render(<div data-test-subj="coreChallengeDiv">Core Challenge!</div>, element);
        return () => ReactDOM.unmountComponentAtNode(element);
      },
    });
    // This section is only needed to get this example plugin to show up in our Developer Examples.
    deps.developerExamples.register({
      appId: 'coreChallenge',
      title: 'Core Challenge Application',
      description: `Core Challenge plugin`,
    });
  }

  public start(core: CoreStart) {
    return {};
  }

  public stop() {}
}
