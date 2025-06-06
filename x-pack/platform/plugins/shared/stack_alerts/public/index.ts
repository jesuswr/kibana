/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { PluginInitializerContext } from '@kbn/core/public';
import { StackAlertsPublicPlugin } from './plugin';

export { DataViewSelectPopover } from './rule_types/components/data_view_select_popover';

export const plugin = (initializerContext: PluginInitializerContext) =>
  new StackAlertsPublicPlugin(initializerContext);
