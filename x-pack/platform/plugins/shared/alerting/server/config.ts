/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TypeOf } from '@kbn/config-schema';
import { schema } from '@kbn/config-schema';
import { validateDurationSchema, parseDuration } from './lib';
import { DEFAULT_CACHE_INTERVAL_MS } from './rules_settings';

export const DEFAULT_MAX_ALERTS = 1000;
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const ruleTypeSchema = schema.object({
  id: schema.string(),
  timeout: schema.maybe(schema.string({ validate: validateDurationSchema })),
});

const connectorTypeSchema = schema.object({
  id: schema.string(),
  max: schema.maybe(schema.number({ max: 100000 })),
});

const rulesSchema = schema.object({
  minimumScheduleInterval: schema.object({
    value: schema.string({
      validate: (duration: string) => {
        const validationResult = validateDurationSchema(duration);
        if (validationResult) {
          return validationResult;
        }

        const parsedDurationMs = parseDuration(duration);
        if (parsedDurationMs > ONE_DAY_IN_MS) {
          return 'duration cannot exceed one day';
        }
      },
      defaultValue: '1m',
    }),
    enforce: schema.boolean({ defaultValue: false }), // if enforce is false, only warnings will be shown
  }),
  maxScheduledPerMinute: schema.number({ defaultValue: 32000, min: 0 }),
  overwriteProducer: schema.maybe(
    schema.oneOf([
      schema.literal('observability'),
      schema.literal('siem'),
      schema.literal('stackAlerts'),
    ])
  ),
  run: schema.object({
    timeout: schema.maybe(schema.string({ validate: validateDurationSchema })),
    actions: schema.object({
      max: schema.number({ defaultValue: 100000, max: 100000 }),
      connectorTypeOverrides: schema.maybe(schema.arrayOf(connectorTypeSchema)),
    }),
    alerts: schema.object({
      max: schema.number({ defaultValue: DEFAULT_MAX_ALERTS }),
    }),
    ruleTypeOverrides: schema.maybe(schema.arrayOf(ruleTypeSchema)),
  }),
});

export const configSchema = schema.object({
  healthCheck: schema.object({
    interval: schema.string({ validate: validateDurationSchema, defaultValue: '60m' }),
  }),
  invalidateApiKeysTask: schema.object({
    interval: schema.string({ validate: validateDurationSchema, defaultValue: '5m' }),
    removalDelay: schema.string({ validate: validateDurationSchema, defaultValue: '1h' }),
  }),
  maxEphemeralActionsPerAlert: schema.maybe(schema.number()),
  enableFrameworkAlerts: schema.boolean({ defaultValue: true }),
  cancelAlertsOnRuleTimeout: schema.boolean({ defaultValue: true }),
  rules: rulesSchema,
  rulesSettings: schema.object({
    enabled: schema.boolean({ defaultValue: true }),
    cacheInterval: schema.number({ defaultValue: DEFAULT_CACHE_INTERVAL_MS }),
  }),
  maintenanceWindow: schema.object({
    enabled: schema.boolean({ defaultValue: true }),
  }),
  disabledRuleTypes: schema.maybe(
    schema.arrayOf(schema.string({ minLength: 1 }), { defaultValue: [] })
  ),
  enabledRuleTypes: schema.maybe(
    schema.arrayOf(schema.string({ minLength: 1 }), { defaultValue: [] })
  ),
});

export type AlertingConfig = TypeOf<typeof configSchema>;
export type RulesConfig = TypeOf<typeof rulesSchema>;
export type AlertingRulesConfig = Pick<
  AlertingConfig['rules'],
  'minimumScheduleInterval' | 'maxScheduledPerMinute' | 'run'
> & {
  isUsingSecurity: boolean;
};
export type ActionsConfig = RulesConfig['run']['actions'];
export type ActionTypeConfig = Omit<ActionsConfig, 'connectorTypeOverrides'>;
