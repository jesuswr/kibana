/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { act } from 'react-dom/test-utils';
import { setup, SetupResult, getProcessorValue, setupEnvironment } from './processor.helpers';

const APPEND_TYPE = 'append';

describe('Processor: Append', () => {
  let onUpdate: jest.Mock;
  let testBed: SetupResult;

  const { httpSetup } = setupEnvironment();

  beforeAll(() => {
    jest.useFakeTimers({ legacyFakeTimers: true });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    onUpdate = jest.fn();

    await act(async () => {
      testBed = await setup(httpSetup, {
        value: {
          processors: [],
        },
        onFlyoutOpen: jest.fn(),
        onUpdate,
      });
    });
    testBed.component.update();
    const {
      actions: { addProcessor, addProcessorType },
    } = testBed;
    // Open the processor flyout
    addProcessor();

    // Add type (the other fields are not visible until a type is selected)
    await addProcessorType(APPEND_TYPE);
  });

  test('prevents form submission if required fields are not provided', async () => {
    const {
      actions: { saveNewProcessor },
      form,
    } = testBed;

    // Click submit button with only the type defined
    await saveNewProcessor();

    // Expect form error as "field" and "value" are required parameters
    expect(form.getErrorsMessages()).toEqual([
      'A field value is required.',
      'A value is required.',
    ]);
  });

  test('saves with required parameter values', async () => {
    const {
      actions: { saveNewProcessor },
      form,
      find,
      component,
    } = testBed;

    // Add "field" value (required)
    form.setInputValue('fieldNameField.input', 'field_1');

    await act(async () => {
      find('comboxValueField.input').simulate('change', [{ label: 'Some_Value' }]);
    });
    component.update();

    // Save the field
    await saveNewProcessor();

    const processors = getProcessorValue(onUpdate, APPEND_TYPE);
    expect(processors[0].append).toEqual({
      field: 'field_1',
      value: ['Some_Value'],
    });
  });

  test('allows optional parameters to be set', async () => {
    const {
      actions: { saveNewProcessor },
      form,
      find,
      component,
    } = testBed;

    // Add "field" value (required)
    form.setInputValue('fieldNameField.input', 'field_1');

    // Set optional parameteres
    await act(async () => {
      find('comboxValueField.input').simulate('change', [{ label: 'Some_Value' }]);
      component.update();
    });
    form.toggleEuiSwitch('allowDuplicatesSwitch.input');

    form.toggleEuiSwitch('ignoreFailureSwitch.input');
    // Save the field with new changes
    await saveNewProcessor();

    const processors = getProcessorValue(onUpdate, APPEND_TYPE);
    expect(processors[0].append).toEqual({
      field: 'field_1',
      ignore_failure: true,
      value: ['Some_Value'],
      allow_duplicates: false,
    });
  });

  test('should allow to set media_type when value is a template snippet', async () => {
    const {
      actions: { saveNewProcessor },
      form,
      find,
      component,
      exists,
    } = testBed;

    // Add "field" value (required)
    form.setInputValue('fieldNameField.input', 'sample_field');

    // Shouldn't be able to set media_type if value is not a template string
    await act(async () => {
      find('comboxValueField.input').simulate('change', [{ label: 'value_1' }]);
    });
    component.update();
    expect(exists('mediaTypeSelectorField')).toBe(false);

    // Set value to a template snippet and media_type to a non-default value
    await act(async () => {
      find('comboxValueField.input').simulate('change', [{ label: '{{{value_2}}}' }]);
    });
    component.update();
    form.setSelectValue('mediaTypeSelectorField', 'text/plain');

    // Save the field with new changes
    await saveNewProcessor();

    const processors = getProcessorValue(onUpdate, APPEND_TYPE);
    expect(processors[0][APPEND_TYPE]).toEqual({
      field: 'sample_field',
      value: ['{{{value_2}}}'],
      media_type: 'text/plain',
    });
  });

  test('saves with json parameter values', async () => {
    const {
      actions: { saveNewProcessor },
      form,
      find,
      component,
    } = testBed;

    // Add "field" value (required)
    form.setInputValue('fieldNameField.input', 'field_1');

    await act(async () => {
      find('comboxValueField.input').simulate('change', [{ label: 'Some_Value' }]);
    });
    component.update();

    find('toggleTextField').simulate('click');

    await act(async () => {
      find('jsonValueField').simulate('change', {
        jsonContent: '{"value_1":"""aaa"bbb""", "value_2":"aaa(bbb"}',
      });

      // advance timers to allow the form to validate
      jest.advanceTimersByTime(0);
    });

    // Save the field
    await saveNewProcessor();

    const processors = getProcessorValue(onUpdate, APPEND_TYPE);
    expect(processors[0].append).toEqual({
      field: 'field_1',
      // eslint-disable-next-line prettier/prettier
      value: { value_1: 'aaa\"bbb', value_2: 'aaa(bbb' },
    });
  });
});
