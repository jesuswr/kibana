/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as rt from 'io-ts';
import { HttpStart } from '@kbn/core/public';
import type { ISearchGeneric } from '@kbn/search-types';
import type { DataViewsContract } from '@kbn/data-views-plugin/public';
import type { DataView, DataViewLazy } from '@kbn/data-views-plugin/common';
import { lastValueFrom } from 'rxjs';
import { LogSourcesService } from '@kbn/logs-data-access-plugin/common/types';
import { getLogViewResponsePayloadRT, putLogViewRequestPayloadRT } from '../../../common/http_api';
import { getLogViewUrl } from '../../../common/http_api/log_views';
import {
  FetchLogViewError,
  FetchLogViewStatusError,
  LogView,
  LogViewAttributes,
  logViewAttributesRT,
  LogViewReference,
  LogViewsStaticConfig,
  LogViewStatus,
  PutLogViewError,
  ResolvedLogView,
  resolveLogView,
} from '../../../common/log_views';
import { decodeOrThrow } from '../../../common/runtime_types';
import { ILogViewsClient } from './types';

export class LogViewsClient implements ILogViewsClient {
  constructor(
    private readonly dataViews: DataViewsContract,
    private readonly logSourcesService: LogSourcesService,
    private readonly http: HttpStart,
    private readonly search: ISearchGeneric,
    private readonly config: LogViewsStaticConfig
  ) {}

  public async getLogView(logViewReference: LogViewReference): Promise<LogView> {
    if (logViewReference.type === 'log-view-inline') {
      return {
        ...logViewReference,
        origin: 'inline',
      };
    }

    const { logViewId } = logViewReference;
    const response = await this.http
      .get(getLogViewUrl(logViewId), { version: '1' })
      .catch((error) => {
        throw new FetchLogViewError(`Failed to fetch log view "${logViewId}": ${error}`);
      });

    const { data } = decodeOrThrow(
      getLogViewResponsePayloadRT,
      (message: string) =>
        new FetchLogViewError(`Failed to decode log view "${logViewId}": ${message}"`)
    )(response);

    return data;
  }

  public async getResolvedLogView(
    logViewReference: LogViewReference
  ): Promise<ResolvedLogView<DataView>> {
    const logView = await this.getLogView(logViewReference);
    const resolvedLogView = await this.resolveLogView(logView.id, logView.attributes);
    return resolvedLogView;
  }

  public async unwrapDataViewLazy(
    resolvedLogViewLazy: ResolvedLogView<DataViewLazy>
  ): Promise<ResolvedLogView<DataView>> {
    const dataViewReference = await this.dataViews.toDataView(
      resolvedLogViewLazy.dataViewReference
    );
    return {
      ...resolvedLogViewLazy,
      dataViewReference,
    };
  }

  public async getResolvedLogViewStatus(
    resolvedLogView: ResolvedLogView<DataView>
  ): Promise<LogViewStatus> {
    const indexStatus = await lastValueFrom(
      this.search({
        params: {
          ignore_unavailable: true,
          allow_no_indices: true,
          index: resolvedLogView.indices,
          size: 0,
          terminate_after: 1,
          track_total_hits: 1,
        },
      })
    ).then(
      ({ rawResponse }) => {
        if (rawResponse._shards.total <= 0) {
          return 'missing' as const;
        }

        const totalHits = decodeTotalHits(rawResponse.hits.total);
        if (typeof totalHits === 'number' ? totalHits > 0 : totalHits.value > 0) {
          return 'available' as const;
        }

        return 'empty' as const;
      },
      (err) => {
        if (err.status === 404) {
          return 'missing' as const;
        }
        throw new FetchLogViewStatusError(
          `Failed to check status of log indices of "${resolvedLogView.indices}": ${err}`
        );
      }
    );

    return {
      index: indexStatus,
    };
  }

  public async putLogView(
    logViewReference: LogViewReference,
    logViewAttributes: Partial<LogViewAttributes>
  ): Promise<LogView> {
    if (logViewReference.type === 'log-view-inline') {
      const { id } = logViewReference;
      const attributes = decodeOrThrow(
        rt.partial(logViewAttributesRT.type.props),
        (message: string) =>
          new PutLogViewError(`Failed to decode inline log view "${id}": ${message}"`)
      )(logViewAttributes);
      return {
        id,
        attributes: {
          ...logViewReference.attributes,
          ...attributes,
        },
        origin: 'inline',
      };
    } else {
      const { logViewId } = logViewReference;
      const response = await this.http
        .put(getLogViewUrl(logViewId), {
          body: JSON.stringify(
            putLogViewRequestPayloadRT.encode({ attributes: logViewAttributes })
          ),
          version: '1',
        })
        .catch((error) => {
          throw new PutLogViewError(`Failed to write log view "${logViewId}": ${error}`);
        });

      const { data } = decodeOrThrow(
        getLogViewResponsePayloadRT,
        (message: string) =>
          new PutLogViewError(`Failed to decode written log view "${logViewId}": ${message}"`)
      )(response);

      return data;
    }
  }

  public async resolveLogView(
    logViewId: string,
    logViewAttributes: LogViewAttributes
  ): Promise<ResolvedLogView<DataView>> {
    const resolvedDataViewLazy = await resolveLogView(
      logViewId,
      logViewAttributes,
      this.dataViews,
      this.logSourcesService,
      this.config
    );

    return this.unwrapDataViewLazy(resolvedDataViewLazy);
  }
}

const decodeTotalHits = decodeOrThrow(
  rt.union([
    rt.number,
    rt.type({
      value: rt.number,
    }),
  ])
);
