/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { schema } from '@kbn/config-schema';
import { pluck } from 'rxjs';
import { CoreSetup, Plugin, HttpResponsePayload } from '@kbn/core/server';
import { PluginStart as DataPluginStart } from '@kbn/data-plugin/server';
import { ExpressionsServerStart } from '@kbn/expressions-plugin/server';

export interface TestStartDeps {
  data: DataPluginStart;
  expressions: ExpressionsServerStart;
}

export class TestPlugin implements Plugin<TestPluginSetup, TestPluginStart, {}, TestStartDeps> {
  public setup(core: CoreSetup<TestStartDeps>) {
    const router = core.http.createRouter();

    router.post(
      {
        path: '/api/interpreter_functional/run_expression',
        security: {
          authz: {
            enabled: false,
            reason: 'This route is opted out from authorization',
          },
        },
        validate: {
          body: schema.object({
            input: schema.maybe(schema.nullable(schema.object({}, { unknowns: 'allow' }))),
            expression: schema.string(),
          }),
        },
      },
      async (context, req, res) => {
        const [, { expressions }] = await core.getStartServices();
        const output = await expressions
          .run<unknown, HttpResponsePayload>(req.body.expression, req.body.input, {
            kibanaRequest: req,
          })
          .pipe(pluck('result'))
          .toPromise();
        return res.ok({ body: output });
      }
    );
  }

  public start() {}
  public stop() {}
}

export type TestPluginSetup = ReturnType<TestPlugin['setup']>;
export type TestPluginStart = ReturnType<TestPlugin['start']>;
