/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElasticsearchClient } from '@kbn/core-elasticsearch-server';
import { Agent, PACKAGE_POLICY_SAVED_OBJECT_TYPE, PackagePolicy } from '@kbn/fleet-plugin/common';
import {
  AgentPolicyServiceInterface,
  AgentService,
  PackagePolicyClient,
} from '@kbn/fleet-plugin/server';
import type { Logger, SavedObjectsClientContract } from '@kbn/core/server';
import { NATIVE_CONNECTOR_DEFINITIONS, fetchConnectors } from '@kbn/search-connectors';
import { getPackageInfo } from '@kbn/fleet-plugin/server/services/epm/packages';
import { createAgentPolicyWithPackages } from '@kbn/fleet-plugin/server/services/agent_policy_create';
import { DEFAULT_SPACE_ID } from '@kbn/spaces-plugin/common';

export interface ConnectorMetadata {
  id: string;
  name: string;
  service_type: string;
  is_deleted: boolean;
}

export interface PackageConnectorSettings {
  id: string;
  name: string;
  service_type: string;
}

export type AgentMetadata = Pick<Agent, 'last_checkin_status' | 'id' | 'status'>;

export interface PackagePolicyMetadata {
  package_policy_id: string;
  package_policy_name: string;
  package_name: string;
  agent_policy_ids: string[];
  connector_settings: PackageConnectorSettings;
}

// Agent metadata is only returned when there is an agent associated with the policy
export interface PackagePolicyAndAgentMetadata extends PackagePolicyMetadata {
  agent_metadata?: AgentMetadata;
}

const connectorsInputName = 'connectors-py';
const pkgName = 'elastic_connectors';
const pkgTitle = 'Elastic Connectors';

export class AgentlessConnectorsInfraService {
  private logger: Logger;
  private soClient: SavedObjectsClientContract;
  private esClient: ElasticsearchClient;
  private packagePolicyService: PackagePolicyClient;
  private agentPolicyService: AgentPolicyServiceInterface;
  private agentService: AgentService;

  constructor(
    soClient: SavedObjectsClientContract,
    esClient: ElasticsearchClient,
    packagePolicyService: PackagePolicyClient,
    agentPolicyService: AgentPolicyServiceInterface,
    agentService: AgentService,
    logger: Logger
  ) {
    this.logger = logger;
    this.soClient = soClient;
    this.esClient = esClient;
    this.packagePolicyService = packagePolicyService;
    this.agentService = agentService;
    this.agentPolicyService = agentPolicyService;
  }

  public getNativeConnectors = async (): Promise<ConnectorMetadata[]> => {
    this.logger.debug(`Fetching all connectors and filtering only to native`);
    const nativeConnectors: ConnectorMetadata[] = [];
    const allConnectors = await fetchConnectors(
      this.esClient,
      undefined,
      undefined,
      undefined,
      true // includeDeleted
    );

    for (const connector of allConnectors) {
      if (connector.is_native && connector.service_type != null) {
        if (NATIVE_CONNECTOR_DEFINITIONS[connector.service_type] == null) {
          this.logger.debug(
            `Skipping connector ${connector.id}: unsupported service type ${connector.service_type}`
          );
          continue;
        }

        nativeConnectors.push({
          id: connector.id,
          name: connector.name,
          service_type: connector.service_type,
          is_deleted: !!connector.deleted,
        });
      }
    }
    return nativeConnectors;
  };

  public getConnectorPackagePolicies = async (): Promise<PackagePolicyMetadata[]> => {
    const kuery = `${PACKAGE_POLICY_SAVED_OBJECT_TYPE}.package.name:${pkgName}`;
    this.logger.debug(`Fetching policies with kuery: "${kuery}"`);
    const policiesIterator = await this.packagePolicyService.fetchAllItems(this.soClient, {
      perPage: 50,
      kuery,
    });
    const policiesMetadata: PackagePolicyMetadata[] = [];
    for await (const policyPage of policiesIterator) {
      for (const policy of policyPage) {
        for (const input of policy.inputs) {
          if (input.type === connectorsInputName) {
            if (input.compiled_input != null) {
              if (input.compiled_input.service_type == null) {
                this.logger.debug(`Policy ${policy.id} is missing service_type, skipping`);
                continue;
              }

              if (input.compiled_input.connector_id == null) {
                this.logger.debug(`Policy ${policy.id} is missing connector_id`);
                // No need to skip, that's fine
              }

              if (input.compiled_input.connector_name == null) {
                this.logger.debug(`Policy ${policy.id} is missing connector_name`);
                // No need to skip, that's fine
              }

              // TODO: We manage all policies here, not only agentless.
              // Return this code back once this logic is ironed out
              // if (policy.supports_agentless !== true) {
              //   this.logger.debug(`Policy ${policy.id} does not support agentless, skipping`);
              //   continue;
              // }

              policiesMetadata.push({
                package_policy_id: policy.id,
                package_policy_name: policy.name,
                package_name: policy.package?.name || '',
                agent_policy_ids: policy.policy_ids,
                connector_settings: {
                  id: input.compiled_input.connector_id,
                  name: input.compiled_input.connector_name || '',
                  service_type: input.compiled_input.service_type,
                },
              });
            }
          }
        }
      }
    }

    return policiesMetadata;
  };

  public deployConnector = async (connector: ConnectorMetadata): Promise<PackagePolicy> => {
    this.logger.info(
      `Connector ${connector.id} has no integration policy associated with it, creating`
    );

    if (connector.id == null || connector.id.trim().length === 0) {
      throw new Error(`Connector id is null or empty`);
    }

    if (connector.is_deleted) {
      throw new Error(`Connector ${connector.id} has been deleted`);
    }

    if (connector.service_type == null || connector.service_type.trim().length === 0) {
      throw new Error(`Connector ${connector.id} service_type is null or empty`);
    }

    if (NATIVE_CONNECTOR_DEFINITIONS[connector.service_type] == null) {
      throw new Error(
        `Connector ${connector.id} service_type is incompatible with agentless or unsupported`
      );
    }
    this.logger.debug(`Getting package version for connectors package ${pkgName}`);
    const pkgVersion = await this.getPackageVersion();
    this.logger.debug(`Latest package version for ${pkgName} is ${pkgVersion}`);

    const createdPolicy = await createAgentPolicyWithPackages({
      soClient: this.soClient,
      esClient: this.esClient,
      newPolicy: {
        name: `Agentless policy for ${connector.service_type} connector: ${connector.id}`,
        description: `Automatically generated on ${new Date(Date.now()).toISOString()}`,
        global_data_tags: [
          {
            name: 'organization',
            value: 'elastic',
          },
          {
            name: 'division',
            value: 'engineering',
          },
          {
            name: 'team',
            value: 'search-extract-and-transform',
          },
        ],
        namespace: 'default',
        monitoring_enabled: ['logs', 'metrics'],
        inactivity_timeout: 3600,
        is_protected: false,
        supports_agentless: true,
      },
      withSysMonitoring: true,
      spaceId: this.soClient.getCurrentNamespace() ?? DEFAULT_SPACE_ID,
    });

    this.logger.info(
      `Successfully created agent policy ${createdPolicy.id} for agentless connector ${connector.id}`
    );
    this.logger.debug(`Creating a package policy for agentless connector ${connector.id}`);
    const packagePolicy = await this.packagePolicyService.create(
      this.soClient,
      this.esClient,
      {
        policy_ids: [createdPolicy.id],
        package: {
          title: pkgTitle,
          name: pkgName,
          version: pkgVersion,
        },
        name: `${connector.service_type} connector ${connector.id}`,
        description: '',
        namespace: '',
        enabled: true,
        inputs: [
          {
            type: connectorsInputName,
            policy_template: connector.service_type,
            enabled: true,
            vars: {
              connector_id: { type: 'string', value: connector.id },
              connector_name: { type: 'string', value: connector.name },
              service_type: { type: 'string', value: connector.service_type },
            },
            streams: [],
          },
        ],
        supports_agentless: true,
      },
      { force: true }
    );

    this.logger.info(
      `Successfully created package policy ${packagePolicy.id} for agentless connector ${connector.id}`
    );

    return packagePolicy;
  };

  public removeDeployment = async (packagePolicyId: string): Promise<void> => {
    this.logger.info(`Deleting package policy ${packagePolicyId}`);

    const policy = await this.packagePolicyService.get(this.soClient, packagePolicyId);

    if (policy == null) {
      throw new Error(`Failed to delete policy ${packagePolicyId}: not found`);
    }

    await this.packagePolicyService.delete(this.soClient, this.esClient, [policy.id]);

    this.logger.debug(`Deleting package policies with ids ${policy.policy_ids}`);

    // TODO: can we do it in one go?
    // Why not use deleteFleetServerPoliciesForPolicyId?
    for (const agentPolicyId of policy.policy_ids) {
      this.logger.info(`Deleting agent policy ${agentPolicyId}`);
      await this.agentPolicyService.delete(this.soClient, this.esClient, agentPolicyId);
    }
  };

  public getAgentPolicyForConnectorId = async ({
    connectorId,
  }: {
    connectorId: string;
  }): Promise<PackagePolicyAndAgentMetadata | null> => {
    const allPolicies = await this.getConnectorPackagePolicies();

    const policies = getPoliciesByConnectorId(allPolicies, connectorId);

    if (!policies || policies.length === 0) {
      return null;
    }

    const [policy] = policies;

    if (policy && policy.agent_policy_ids.length > 0) {
      const policyId = policy!.agent_policy_ids[0];

      const listAgentsResponse = await this.agentService.asInternalUser.listAgents({
        kuery: `fleet-agents.policy_id:${policyId}`,
        showInactive: false,
      });

      if (!listAgentsResponse || listAgentsResponse.agents.length === 0) {
        // If no agents assigned to policy, just return the policy
        return policy;
      } else {
        if (listAgentsResponse.agents.length > 1) {
          this.logger.warn(
            `More than one agent assigned to policy ${policyId} that manages connector with id ${connectorId}`
          );
        }

        // Return the first (and only) agentless host associated with this policy
        return {
          ...policy,
          agent_metadata: {
            id: listAgentsResponse.agents[0].id,
            last_checkin_status: listAgentsResponse.agents[0].last_checkin_status,
            status: listAgentsResponse.agents[0].status,
          },
        };
      }
    }

    return policy;
  };

  private getPackageVersion = async (): Promise<string> => {
    this.logger.debug(`Fetching ${pkgName} version`);

    // This will raise an error if package is not there.
    // Situation is exceptional, so we can just show
    // the error message from getPackageInfo in this case
    const packageInfo = await getPackageInfo({
      savedObjectsClient: this.soClient,
      pkgName,
      pkgVersion: '',
      skipArchive: true,
      ignoreUnverified: true,
      prerelease: true,
    });
    this.logger.debug(`Found ${pkgName} version: ${packageInfo.version}`);

    return packageInfo.version;
  };
}

export const getConnectorsToDeploy = (
  packagePolicies: PackagePolicyMetadata[],
  connectors: ConnectorMetadata[]
): ConnectorMetadata[] => {
  const results: ConnectorMetadata[] = [];

  for (const connector of connectors) {
    // Skip deleted connectors
    if (connector.is_deleted) continue;

    // If no package policies reference this connector by id then it should be deployed
    if (
      packagePolicies.every(
        (packagePolicy) =>
          connector.id !== packagePolicy.connector_settings.id &&
          connector.id !== packagePolicy.package_policy_id
      )
    ) {
      results.push(connector);
    }
  }

  return results;
};

export const getPoliciesToDelete = (
  packagePolicies: PackagePolicyMetadata[],
  connectors: ConnectorMetadata[]
): PackagePolicyMetadata[] => {
  const results: PackagePolicyMetadata[] = [];

  for (const packagePolicy of packagePolicies) {
    // If there is a connector that has been soft-deleted for this package policy then this policy should be deleted
    if (
      connectors.some(
        (connector) =>
          connector.id === packagePolicy.connector_settings.id && connector.is_deleted === true
      )
    ) {
      results.push(packagePolicy);
    }
  }

  return results;
};

export const getPoliciesByConnectorId = (
  packagePolicies: PackagePolicyMetadata[],
  connectorId: string
): PackagePolicyMetadata[] => {
  return packagePolicies.filter(
    (packagePolicy) =>
      packagePolicy.connector_settings.id === connectorId ||
      packagePolicy.package_policy_id === connectorId
  );
};

export const getConnectorPolicyId = (
  packagePolicies: PackagePolicyMetadata[],
  connectorId: string
): string[] => {
  return getPoliciesByConnectorId(packagePolicies, connectorId).map(
    (policy) => policy.package_policy_id
  );
};
