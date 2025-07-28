/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { schema } from '@kbn/config-schema';
import { IRouter, SavedObject } from '@kbn/core/server';
import {
  todoElementSchemaV2,
  todoElementSavedObjectTypeName,
  TodoElement,
  TodoElementHttpResponse,
} from './types';

export function registerRoutes(router: IRouter) {
  registerGetTodosRoute(router);
  registerGetTodoByIdRoute(router);
  registerPostTodoRoute(router);
  registerPutTodoRoute(router);
  registerDeleteTodoRoute(router);
}

function registerGetTodosRoute(router: IRouter) {
  router.get(
    {
      path: '/api/todos',
      validate: false,
      security: { authz: { enabled: false, reason: 'testing' } },
      options: { access: 'public' },
    },
    async (context, req, res) => {
      const core = await context.core;
      const result = await core.savedObjects.client.find<TodoElement>({
        type: todoElementSavedObjectTypeName,
      });
      return res.ok({ body: result.saved_objects.map(savedObjectToHttpResponse) });
    }
  );
}

function registerGetTodoByIdRoute(router: IRouter) {
  router.get(
    {
      path: '/api/todos/{id}',
      validate: {
        params: schema.object({
          id: schema.string(),
        }),
      },
      security: { authz: { enabled: false, reason: 'testing' } },
      options: { access: 'public' },
    },
    async (context, req, res) => {
      const { id } = req.params;
      const core = await context.core;
      const result = await core.savedObjects.client.get<TodoElement>(
        todoElementSavedObjectTypeName,
        id
      );
      if (result) {
        return res.ok({ body: savedObjectToHttpResponse(result) });
      } else {
        return res.notFound();
      }
    }
  );
}

function registerPostTodoRoute(router: IRouter) {
  router.post(
    {
      path: '/api/todos',
      validate: {
        body: todoElementSchemaV2,
      },
      security: { authz: { enabled: false, reason: 'testing' } },
      options: { access: 'public' },
    },
    async (context, req, res) => {
      const core = await context.core;
      const todoElement = {
        ...req.body,
      };
      const result = await core.savedObjects.client.create<TodoElement>(
        todoElementSavedObjectTypeName,
        todoElement
      );
      return res.ok({ body: savedObjectToHttpResponse(result) });
    }
  );
}

function registerPutTodoRoute(router: IRouter) {
  router.put(
    {
      path: '/api/todos/{id}',
      validate: {
        params: schema.object({
          id: schema.string(),
        }),
        body: todoElementSchemaV2,
      },
      security: { authz: { enabled: false, reason: 'testing' } },
      options: { access: 'public' },
    },
    async (context, req, res) => {
      const { id } = req.params;
      const core = await context.core;
      const todoElement = {
        ...req.body,
      };
      // to think: should we handle specially updates to description? since it's optional.
      // if no description is in the body, do we keep the previous one or delete it?
      await core.savedObjects.client.update<TodoElement>(
        todoElementSavedObjectTypeName,
        id,
        todoElement
      );
      return res.ok();
    }
  );
}

function registerDeleteTodoRoute(router: IRouter) {
  router.delete(
    {
      path: '/api/todos/{id}',
      validate: {
        params: schema.object({
          id: schema.string(),
        }),
      },
      security: { authz: { enabled: false, reason: 'testing' } },
      options: { access: 'public' },
    },
    async (context, req, res) => {
      const { id } = req.params;
      const core = await context.core;
      await core.savedObjects.client.delete(todoElementSavedObjectTypeName, id);
      return res.ok();
    }
  );
}

function savedObjectToHttpResponse(so: SavedObject<TodoElement>): TodoElementHttpResponse {
  return {
    ...so.attributes,
    id: so.id,
  };
}
