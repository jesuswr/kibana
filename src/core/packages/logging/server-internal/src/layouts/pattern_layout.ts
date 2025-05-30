/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { schema } from '@kbn/config-schema';
import {
  PatternLayout as BasePatternLayout,
  type Conversion,
} from '@kbn/core-logging-common-internal';
import {
  LoggerConversion,
  LevelConversion,
  MetaConversion,
  MessageConversion,
  PidConversion,
  DateConversion,
  ErrorConversion,
} from './conversions';

export const patternSchema = schema.string({
  maxLength: 1000,
  validate: (string) => {
    DateConversion.validate!(string);
  },
});

const patternLayoutSchema = schema.object({
  highlight: schema.maybe(schema.boolean()),
  type: schema.literal('pattern'),
  pattern: schema.maybe(patternSchema),
});

const conversions: Conversion[] = [
  LoggerConversion,
  MessageConversion,
  LevelConversion,
  MetaConversion,
  PidConversion,
  DateConversion,
  ErrorConversion,
];

/**
 * Layout that formats `LogRecord` using the `pattern` string with optional
 * color highlighting (eg. to make log messages easier to read in the terminal).
 * @internal
 */
export class PatternLayout extends BasePatternLayout {
  public static configSchema = patternLayoutSchema;

  constructor(pattern?: string, highlight: boolean = false) {
    super({
      pattern,
      highlight,
      conversions,
    });
  }
}
