/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { PolicyFromES } from '@kbn/index-lifecycle-management-common-shared';
import { DataStream } from '@kbn/index-management-plugin/common';
import { CatIndicesResponse } from '@elastic/elasticsearch/lib/api/types';
import { apiService } from '../../../../../utils/api_service';
import { SYNTHETICS_API_URLS } from '../../../../../../common/constants';

export const getIlmPolicies = async (): Promise<PolicyFromES[]> => {
  return await apiService.get('/api/index_lifecycle_management/policies');
};

export const getDslPolicies = async (): Promise<{ data: DataStream[] }> => {
  return apiService.get(
    '/api/index_management/data_streams',
    {
      includeStats: true,
    },
    undefined,
    {
      headers: {
        'X-Elastic-Internal-Origin': 'Kibana',
      },
    }
  );
};

export const getIndicesData = async (): Promise<{ data: CatIndicesResponse }> => {
  return await apiService.get(SYNTHETICS_API_URLS.INDEX_SIZE);
};
