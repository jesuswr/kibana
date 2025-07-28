/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { schema } from '@kbn/config-schema';
import { SavedObjectsType } from '@kbn/core/server';

export const todoElementSavedObjectTypeName = 'todo-element-core-challenge';

export interface TodoElement {
  title: string;
  description?: string;
  completed?: boolean;
}

export interface TodoElementHttpResponse extends TodoElement {
  id: string;
}

export const todoElementSchemaV1 = schema.object({
  title: schema.string({ minLength: 1 }),
  description: schema.maybe(schema.string()),
});

export const todoElementSchemaV2 = todoElementSchemaV1.extends({
  completed: schema.maybe(schema.boolean()),
});

export const todoElementSavedObjectType: SavedObjectsType = {
  name: todoElementSavedObjectTypeName,
  hidden: false,
  namespaceType: 'agnostic',
  mappings: {
    properties: {
      title: { type: 'text' },
      description: { type: 'text' },
      completed: { type: 'boolean' },
    },
  },
  modelVersions: {
    1: {
      changes: [],
      schemas: {
        forwardCompatibility: todoElementSchemaV1.extends({}, { unknowns: 'ignore' }),
        create: todoElementSchemaV1,
      },
    },
    2: {
      changes: [
        {
          type: 'mappings_addition',
          addedMappings: {
            completed: { type: 'boolean' },
          },
        },
      ],
      schemas: {
        forwardCompatibility: todoElementSchemaV2.extends({}, { unknowns: 'ignore' }),
        create: todoElementSchemaV2,
      },
    },
  },
};
