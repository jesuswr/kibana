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
}

export const todoElementSchema = schema.object({
  title: schema.string({ minLength: 1 }),
  description: schema.maybe(schema.string()),
});

export const todoElementSavedObjectType: SavedObjectsType = {
  name: todoElementSavedObjectTypeName,
  hidden: false,
  namespaceType: 'agnostic',
  mappings: {
    properties: {
      title: { type: 'text' },
      description: { type: 'text' },
    },
  },
  modelVersions: {
    1: {
      changes: [],
      schemas: {
        forwardCompatibility: todoElementSchema.extends({}, { unknowns: 'ignore' }),
        create: todoElementSchema,
      },
    },
  },
};
