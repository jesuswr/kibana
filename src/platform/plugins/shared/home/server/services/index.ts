/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

// provided to other plugins as APIs
// should model the plugin lifecycle

export { TutorialsRegistry, TutorialsCategory } from './tutorials';

export type { TutorialsRegistrySetup, TutorialsRegistryStart } from './tutorials';

export type {
  InstructionSetSchema,
  InstructionsSchema,
  DashboardSchema,
  ArtifactsSchema,
  StatusCheckSchema,
  InstructionVariant,
  Instruction,
  TutorialSchema,
  TutorialProvider,
  TutorialContext,
  TutorialContextFactory,
  ScopedTutorialContextFactory,
} from './tutorials';

export { EmbeddableTypes, SampleDataRegistry } from './sample_data';

export type {
  AppLinkData,
  SampleDataRegistrySetup,
  SampleDataRegistryStart,
  SampleDatasetDashboardPanel,
  SampleDatasetProvider,
  SampleDatasetSchema,
  SampleObject,
} from './sample_data';
