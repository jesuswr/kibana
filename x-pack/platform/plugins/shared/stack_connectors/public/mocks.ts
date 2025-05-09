/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ValidatedEmail } from '@kbn/actions-plugin/common';
import type { RegistrationServices } from './connector_types';
import type { ExperimentalFeatures } from '../common/experimental_features';
import { allowedExperimentalValues } from '../common/experimental_features';

function validateEmailAddresses(addresses: string[]): ValidatedEmail[] {
  return addresses.map((address) => ({ address, valid: true }));
}

export const registrationServicesMock: RegistrationServices = { validateEmailAddresses };

export const experimentalFeaturesMock: ExperimentalFeatures = allowedExperimentalValues;
