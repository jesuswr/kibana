/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import type { EventFiltersFlyoutProps } from './event_filters_flyout';
import { EventFiltersFlyout } from './event_filters_flyout';
import { act, cleanup, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';

import type { AppContextTestRender } from '../../../../../common/mock/endpoint';
import { createAppRootMockRenderer } from '../../../../../common/mock/endpoint';

import { stubIndexPattern } from '@kbn/data-plugin/common/stubs';
import { useFetchIndex } from '../../../../../common/containers/source';
import { getInitialExceptionFromEvent } from '../utils';
import { useCreateArtifact } from '../../../../hooks/artifacts/use_create_artifact';
import { useGetEndpointSpecificPolicies } from '../../../../services/policies/hooks';
import { ecsEventMock, esResponseData } from '../../test_utils';

import { useKibana, useToasts } from '../../../../../common/lib/kibana';
import { of } from 'rxjs';
import { ExceptionsListItemGenerator } from '../../../../../../common/endpoint/data_generators/exceptions_list_item_generator';
import type { ExceptionListItemSchema } from '@kbn/securitysolution-io-ts-list-types';

// mocked modules
jest.mock('../../../../../common/lib/kibana');
jest.mock('../../../../../common/containers/source');
jest.mock('../../../../services/policies/hooks');
jest.mock('../../../../services/policies/policies');
jest.mock('../../../../hooks/artifacts/use_create_artifact');
jest.mock('../utils');

describe('Event filter flyout', () => {
  let user: UserEvent;
  let mockedContext: AppContextTestRender;
  let render: (
    props?: Partial<EventFiltersFlyoutProps>
  ) => ReturnType<AppContextTestRender['render']>;
  let renderResult: ReturnType<AppContextTestRender['render']>;
  let onCancelMock: jest.Mock;
  const exceptionsGenerator = new ExceptionsListItemGenerator();

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockedContext = createAppRootMockRenderer();
    onCancelMock = jest.fn();

    (useKibana as jest.Mock).mockReturnValue({
      services: {
        docLinks: {
          links: {
            securitySolution: {
              eventFilters: '',
            },
          },
        },
        http: {},
        data: {
          dataViews: {
            getIdsWithTitle: async () =>
              Promise.resolve([{ id: 'myfakeid', title: 'hello*,world*,refreshed*' }]),
            create: async ({ title }: { title: string }) =>
              Promise.resolve({
                id: 'myfakeid',
                matchedIndices: ['hello', 'world', 'refreshed'],
                fields: [
                  {
                    name: 'bytes',
                    type: 'number',
                    esTypes: ['long'],
                    aggregatable: true,
                    searchable: true,
                    count: 10,
                    readFromDocValues: true,
                    scripted: false,
                    isMapped: true,
                  },
                  {
                    name: 'ssl',
                    type: 'boolean',
                    esTypes: ['boolean'],
                    aggregatable: true,
                    searchable: true,
                    count: 20,
                    readFromDocValues: true,
                    scripted: false,
                    isMapped: true,
                  },
                  {
                    name: '@timestamp',
                    type: 'date',
                    esTypes: ['date'],
                    aggregatable: true,
                    searchable: true,
                    count: 30,
                    readFromDocValues: true,
                    scripted: false,
                    isMapped: true,
                  },
                ],
                getIndexPattern: () => title,
                getRuntimeMappings: () => ({
                  myfield: {
                    type: 'keyword',
                  },
                }),
              }),
            get: jest
              .fn()
              .mockImplementation(
                async (dataViewId: string, displayErrors?: boolean, refreshFields = false) =>
                  Promise.resolve({
                    id: dataViewId,
                    matchedIndices: refreshFields
                      ? ['hello', 'world', 'refreshed']
                      : ['hello', 'world'],
                    fields: [
                      {
                        name: 'bytes',
                        type: 'number',
                        esTypes: ['long'],
                        aggregatable: true,
                        searchable: true,
                        count: 10,
                        readFromDocValues: true,
                        scripted: false,
                        isMapped: true,
                      },
                      {
                        name: 'ssl',
                        type: 'boolean',
                        esTypes: ['boolean'],
                        aggregatable: true,
                        searchable: true,
                        count: 20,
                        readFromDocValues: true,
                        scripted: false,
                        isMapped: true,
                      },
                      {
                        name: '@timestamp',
                        type: 'date',
                        esTypes: ['date'],
                        aggregatable: true,
                        searchable: true,
                        count: 30,
                        readFromDocValues: true,
                        scripted: false,
                        isMapped: true,
                      },
                    ],
                    getIndexPattern: () => 'hello*,world*,refreshed*',
                    getRuntimeMappings: () => ({
                      myfield: {
                        type: 'keyword',
                      },
                    }),
                  })
              ),
          },
          search: {
            search: jest.fn().mockImplementation(() => of(esResponseData())),
          },
        },
        notifications: {},
        unifiedSearch: {},
      },
    });

    (useToasts as jest.Mock).mockReturnValue({
      addSuccess: jest.fn(),
      addError: jest.fn(),
      addWarning: jest.fn(),
      remove: jest.fn(),
    });

    (useCreateArtifact as jest.Mock).mockImplementation(() => {
      return {
        isLoading: false,
        mutateAsync: jest.fn(),
      };
    });

    (useGetEndpointSpecificPolicies as jest.Mock).mockImplementation(() => {
      return { isLoading: false, isRefetching: false };
    });

    (useFetchIndex as jest.Mock).mockImplementation(() => [
      false,
      { indexPatterns: stubIndexPattern },
    ]);

    render = (props) => {
      renderResult = mockedContext.render(
        <EventFiltersFlyout {...props} onCancel={onCancelMock} />
      );
      return renderResult;
    };
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('On initial render', () => {
    const exception = exceptionsGenerator.generateEventFilterForCreate({
      meta: {},
      entries: [
        {
          field: 'event.category',
          operator: 'included',
          type: 'match',
          value: 'a',
        },
        {
          field: 'process.executable',
          operator: 'included',
          type: 'match',
          value: 'b',
        },
      ],
      name: '',
    });
    beforeEach(() => {
      (getInitialExceptionFromEvent as jest.Mock).mockImplementation(() => {
        return exception;
      });
    });
    it('should render correctly without data ', () => {
      render();
      expect(renderResult.getAllByText('Add event filter')).not.toBeNull();
      expect(renderResult.getByText('Cancel')).not.toBeNull();
    });

    it('should render correctly with data ', () => {
      act(() => {
        render({ data: ecsEventMock() });
      });
      expect(renderResult.getAllByText('Add endpoint event filter')).not.toBeNull();
      expect(renderResult.getByText('Cancel')).not.toBeNull();
    });

    it('should start with "add event filter" button disabled', () => {
      render();
      const confirmButton = renderResult.getByTestId('add-exception-confirm-button');
      expect(confirmButton.hasAttribute('disabled')).toBeTruthy();
    });

    it('should close when click on cancel button', async () => {
      render();
      const cancelButton = renderResult.getByTestId('cancelExceptionAddButton');
      expect(onCancelMock).toHaveBeenCalledTimes(0);

      await user.click(cancelButton);
      expect(onCancelMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('When valid form state', () => {
    const exceptionOptions: Partial<ExceptionListItemSchema> = {
      meta: {},
      entries: [
        {
          field: 'event.category',
          operator: 'included',
          type: 'match',
          value: 'a',
        },
        {
          field: 'process.executable',
          operator: 'included',
          type: 'match',
          value: 'b',
        },
      ],
      name: 'some name',
    };

    beforeEach(() => {
      const exception = exceptionsGenerator.generateEventFilterForCreate(exceptionOptions);
      (getInitialExceptionFromEvent as jest.Mock).mockImplementation(() => {
        return exception;
      });
    });

    it('should display "Add event filter"/"Save" button disabled when form hasn\'t changed', () => {
      render();
      const confirmButton = renderResult.getByTestId('add-exception-confirm-button');
      expect(confirmButton.hasAttribute('disabled')).toBeTruthy();
    });

    it('should enable "Add event filter"/"Save" button when user enters/modifies filter name', async () => {
      render();

      await user.type(renderResult.getByTestId('eventFilters-form-name-input'), 'a');

      const confirmButton = renderResult.getByTestId('add-exception-confirm-button');
      expect(confirmButton.hasAttribute('disabled')).toBeFalsy();
    });

    it('should prevent close when submitting data', async () => {
      (useCreateArtifact as jest.Mock).mockImplementation(() => {
        return { isLoading: true, mutateAsync: jest.fn() };
      });
      render();
      const cancelButton = renderResult.getByTestId('cancelExceptionAddButton');
      expect(onCancelMock).toHaveBeenCalledTimes(0);

      await user.click(cancelButton);
      expect(onCancelMock).toHaveBeenCalledTimes(0);
    });

    // TODO: Find out why this test passes when run via `it.only()` but fails when run with all tests.
    it.skip('should close when exception has been submitted successfully and close flyout', async () => {
      // mock submit query
      (useCreateArtifact as jest.Mock).mockImplementation(() => {
        return {
          isLoading: false,
          mutateAsync: (
            _: Parameters<ReturnType<typeof useCreateArtifact>['mutateAsync']>[0],
            options: Parameters<ReturnType<typeof useCreateArtifact>['mutateAsync']>[1]
          ) => {
            if (!options) return;
            if (!options.onSuccess) return;
            const exception = exceptionsGenerator.generateEventFilter(exceptionOptions);

            options.onSuccess(exception, exception, () => null);
          },
        };
      });

      render();

      const confirmButton = renderResult.getByTestId('add-exception-confirm-button');
      expect(confirmButton.hasAttribute('disabled')).toBeFalsy();
      expect(onCancelMock).toHaveBeenCalledTimes(0);
      await user.click(confirmButton);

      await waitFor(() => {
        expect(useToasts().addSuccess).toHaveBeenCalled();
        expect(onCancelMock).toHaveBeenCalledTimes(1);
      });
    });
  });
});
