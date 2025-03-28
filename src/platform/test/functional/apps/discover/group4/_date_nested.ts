/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { FtrProviderContext } from '../ftr_provider_context';

export default function ({ getService, getPageObjects }: FtrProviderContext) {
  const esArchiver = getService('esArchiver');
  const { common, discover } = getPageObjects(['common', 'discover']);
  const security = getService('security');
  const kibanaServer = getService('kibanaServer');

  describe('timefield is a date in a nested field', function () {
    before(async function () {
      await esArchiver.loadIfNeeded(
        'src/platform/test/functional/fixtures/es_archiver/date_nested'
      );
      await kibanaServer.importExport.load(
        'src/platform/test/functional/fixtures/kbn_archiver/date_nested.json'
      );
      await security.testUser.setRoles(['kibana_admin', 'kibana_date_nested']);
      await common.navigateToApp('discover');
    });

    after(async function unloadMakelogs() {
      await security.testUser.restoreDefaults();
      await esArchiver.unload('src/platform/test/functional/fixtures/es_archiver/date_nested');
      await kibanaServer.importExport.unload(
        'src/platform/test/functional/fixtures/kbn_archiver/date_nested'
      );
    });

    it('should show an error message', async function () {
      await discover.selectIndexPattern('date-nested');
      await discover.waitUntilSearchingHasFinished();
      await discover.showsErrorCallout();
    });
  });
}
