/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { serverMock, requestContextMock } from '../../../../detection_engine/routes/__mocks__';
import { getTimelineOrNull, getTimelineTemplateOrNull } from '../../../saved_object/timelines';

import { getTimelineRequest } from '../../../__mocks__/request_responses';

import { getTimelineRoute } from '.';

jest.mock('../../../saved_object/timelines', () => ({
  getAllTimeline: jest.fn(),
  getTimelineOrNull: jest.fn(),
  getTimelineTemplateOrNull: jest.fn(),
}));

describe('get timeline', () => {
  let server: ReturnType<typeof serverMock.create>;
  let { context } = requestContextMock.createTools();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    server = serverMock.create();
    context = requestContextMock.createTools().context;

    getTimelineRoute(server.router);
  });

  test('should call getTimelineTemplateOrNull if templateTimelineId is given', async () => {
    const templateTimelineId = '123';
    await server.inject(
      getTimelineRequest({ template_timeline_id: templateTimelineId }),
      requestContextMock.convertContext(context)
    );

    expect((getTimelineTemplateOrNull as jest.Mock).mock.calls[0][1]).toEqual(templateTimelineId);
  });

  test('should call getTimelineOrNull if id is given', async () => {
    const id = '456';

    await server.inject(getTimelineRequest({ id }), requestContextMock.convertContext(context));

    expect((getTimelineOrNull as jest.Mock).mock.calls[0][1]).toEqual(id);
  });

  test('should throw error message if nither templateTimelineId nor id is given', async () => {
    const res = await server.inject(
      getTimelineRequest(),
      requestContextMock.convertContext(context)
    );
    expect(res.body.message).toEqual('please provide id or template_timeline_id');
  });
});
