/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { schema } from '@kbn/config-schema';
import type { UiSettingsParams } from '@kbn/core/server';

export const IGNORE_COMPLETED_TODOS_UI_SETTING_ID = 'examples:coreTodos:ignoreCompleted';

export const uiSettings: Record<string, UiSettingsParams> = {
  [IGNORE_COMPLETED_TODOS_UI_SETTING_ID]: {
    name: 'Ignore completed todos',
    description:
      'This setting will make it so the server filters out completed todos in the get all endpoint',
    requiresPageReload: true,
    schema: schema.boolean(),
    value: false,
  },
};
