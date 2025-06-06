/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  AggregationsBuckets,
  AggregationsStringTermsBucketKeys,
} from '@elastic/elasticsearch/lib/api/types';
import { replaceDotSymbols } from './replace_dots_with_underscores';

type Bucket = AggregationsStringTermsBucketKeys & {
  ignored_field: { buckets: Bucket[] };
};

export function parseCountIgnoreRuleTypeBucket(
  ruleTypeBuckets: AggregationsBuckets<AggregationsStringTermsBucketKeys>
) {
  const buckets = ruleTypeBuckets as Bucket[];
  return (buckets ?? []).reduce((acc, bucket: Bucket) => {
    const ruleType: string = replaceDotSymbols(`${bucket.key}`);
    acc[ruleType] = bucket.ignored_field.buckets?.length ?? 0;
    return acc;
  }, {} as Record<string, number>);
}
