/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { schema, TypeOf, type Type } from '@kbn/config-schema';
import type { ServiceConfigDescriptor } from '@kbn/core-base-server-internal';
import { KIBANA_PROJECTS, type KibanaProject } from '@kbn/projects-solutions-groups';

// Config validation for how to run Kibana in Serverless mode.
// Clients need to specify the project type to run in.
// Going for a simple `serverless` string because it serves as
// a direct replacement to the legacy --serverless CLI flag.
// If we even decide to extend this further, and converting it into an object,
// BWC can be ensured by adding the object definition as another alternative to `schema.oneOf`.

// BOOKMARK - List of Kibana project types
const serverlessConfigSchema = schema.maybe(
  schema.oneOf(
    KIBANA_PROJECTS.map((projectName) => schema.literal(projectName)) as [
      Type<KibanaProject> // This cast is needed because it's different to Type<T>[] :sight:
    ]
  )
);

export type ServerlessConfigType = TypeOf<typeof serverlessConfigSchema>;

export const serverlessConfig: ServiceConfigDescriptor<ServerlessConfigType> = {
  path: 'serverless',
  schema: serverlessConfigSchema,
};
