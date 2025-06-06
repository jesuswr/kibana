/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { type FilterControlConfig } from '@kbn/alerts-ui-shared';
import { Filter } from '@kbn/es-query';
import {
  createStateContainer,
  createStateContainerReactHelpers,
} from '@kbn/kibana-utils-plugin/public';
import { AlertStatus } from '../../../../common/typings';
import { AlertSearchBarContainerState } from '../types';

interface AlertSearchBarStateTransitions {
  setRangeFrom: (
    state: AlertSearchBarContainerState
  ) => (rangeFrom: string) => AlertSearchBarContainerState;
  setRangeTo: (
    state: AlertSearchBarContainerState
  ) => (rangeTo: string) => AlertSearchBarContainerState;
  setKuery: (
    state: AlertSearchBarContainerState
  ) => (kuery: string) => AlertSearchBarContainerState;
  setStatus: (
    state: AlertSearchBarContainerState
  ) => (status: AlertStatus) => AlertSearchBarContainerState;
  setFilters: (
    state: AlertSearchBarContainerState
  ) => (filters: Filter[]) => AlertSearchBarContainerState;
  setSavedQueryId: (
    state: AlertSearchBarContainerState
  ) => (savedQueryId?: string) => AlertSearchBarContainerState;
  setControlConfigs: (
    state: AlertSearchBarContainerState
  ) => (controlConfigs: FilterControlConfig[]) => AlertSearchBarContainerState;
  setGroupings: (
    state: AlertSearchBarContainerState
  ) => (groupings: string[]) => AlertSearchBarContainerState;
}

const DEFAULT_STATE: AlertSearchBarContainerState = {
  rangeFrom: 'now-24h',
  rangeTo: 'now',
  kuery: '',
  filters: [],
  groupings: [],
};

const transitions: AlertSearchBarStateTransitions = {
  setRangeFrom: (state) => (rangeFrom) => ({ ...state, rangeFrom }),
  setRangeTo: (state) => (rangeTo) => ({ ...state, rangeTo }),
  setKuery: (state) => (kuery) => ({ ...state, kuery }),
  setStatus: (state) => (status) => ({ ...state, status }),
  setFilters: (state) => (filters) => ({ ...state, filters }),
  setSavedQueryId: (state) => (savedQueryId) => ({ ...state, savedQueryId }),
  setControlConfigs: (state) => (controlConfigs) => ({ ...state, controlConfigs }),
  setGroupings: (state) => (groupings) => ({ ...state, groupings }),
};

const alertSearchBarStateContainer = createStateContainer(DEFAULT_STATE, transitions);

type AlertSearchBarStateContainer = typeof alertSearchBarStateContainer;

const { Provider, useContainer } = createStateContainerReactHelpers<AlertSearchBarStateContainer>();

export { Provider, alertSearchBarStateContainer, useContainer, DEFAULT_STATE };
export type {
  AlertSearchBarStateContainer,
  AlertSearchBarContainerState,
  AlertSearchBarStateTransitions,
};
