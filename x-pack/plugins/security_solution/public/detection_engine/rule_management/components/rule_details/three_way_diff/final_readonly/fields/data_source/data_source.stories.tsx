/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { Story } from '@storybook/react';
import { FieldFinalReadOnly } from '../../field_final_readonly';
import type { DiffableRule } from '../../../../../../../../../common/api/detection_engine';
import { ThreeWayDiffStorybookProviders } from '../../storybook/three_way_diff_storybook_providers';
import {
  dataSourceWithDataView,
  dataSourceWithIndexPatterns,
  mockDataView,
  mockCustomQueryRule,
} from '../../storybook/mocks';

export default {
  component: FieldFinalReadOnly,
  title: 'Rule Management/Prebuilt Rules/Upgrade Flyout/ThreeWayDiff/FieldReadOnly/data_source',
};

interface TemplateProps {
  finalDiffableRule: DiffableRule;
  kibanaServicesOverrides?: Record<string, unknown>;
}

const Template: Story<TemplateProps> = (args) => {
  return (
    <ThreeWayDiffStorybookProviders
      kibanaServicesOverrides={args.kibanaServicesOverrides}
      finalDiffableRule={args.finalDiffableRule}
      fieldName="data_source"
    >
      <FieldFinalReadOnly />
    </ThreeWayDiffStorybookProviders>
  );
};

export const DataSourceWithIndexPatterns = Template.bind({});

DataSourceWithIndexPatterns.args = {
  finalDiffableRule: mockCustomQueryRule({
    data_source: dataSourceWithIndexPatterns,
  }),
};

export const DataSourceWithDataView = Template.bind({});

DataSourceWithDataView.args = {
  finalDiffableRule: mockCustomQueryRule({
    data_source: dataSourceWithDataView,
  }),
  kibanaServicesOverrides: {
    data: {
      dataViews: {
        get: async () => mockDataView(),
      },
    },
  },
};
