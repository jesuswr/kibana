/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { apm, timerange } from '@kbn/apm-synthtrace-client';
import type { ApmSynthtraceEsClient } from '@kbn/apm-synthtrace';

export const config = {
  appleTransaction: {
    name: 'GET /apple 🍎',
    successRate: 25,
    failureRate: 75,
  },
  bananaTransaction: {
    name: 'GET /banana 🍌',
    successRate: 80,
    failureRate: 20,
  },
};

export async function generateData({
  apmSynthtraceEsClient,
  serviceName,
  start,
  end,
}: {
  apmSynthtraceEsClient: ApmSynthtraceEsClient;
  serviceName: string;
  start: number;
  end: number;
}) {
  const serviceGoProdInstance = apm
    .service({ name: serviceName, environment: 'production', agentName: 'go' })
    .instance('instance-a');

  const { bananaTransaction, appleTransaction } = config;
  const interval = timerange(start, end).interval('1m');

  const documents = [appleTransaction, bananaTransaction].flatMap((transaction, index) => {
    return [
      interval
        .rate(transaction.successRate)
        .generator((timestamp) =>
          serviceGoProdInstance
            .transaction({ transactionName: transaction.name })
            .timestamp(timestamp)
            .duration(1000)
            .success()
        ),
      interval.rate(transaction.failureRate).generator((timestamp) =>
        serviceGoProdInstance
          .transaction({ transactionName: transaction.name })
          .errors(
            serviceGoProdInstance
              .error({ message: `Error 1`, type: transaction.name })
              .timestamp(timestamp),
            serviceGoProdInstance
              .error({ message: `Error 2`, type: transaction.name })
              .timestamp(timestamp)
          )
          .duration(1000)
          .timestamp(timestamp)
          .failure()
      ),
    ];
  });

  await apmSynthtraceEsClient.index(documents);
}
