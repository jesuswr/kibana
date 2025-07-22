/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { schema } from '@kbn/config-schema';
import { IRouter } from '@kbn/core/server';
import { v4 as uuidv4 } from 'uuid';
import { TodoElement, todoElementSchema } from './types';

export function registerRoutes(router: IRouter) {
  registerGetTodosRoute(router);
  registerGetTodoByIdRoute(router);
  registerPostTodoRoute(router);
  registerPutTodoRoute(router);
}

const todoList: TodoElement[] = [];

function registerGetTodosRoute(router: IRouter) {
  router.get(
    {
      path: '/api/todos',
      validate: false,
      security: { authz: { enabled: false, reason: 'testing' } },
    },
    (context, req, res) => res.ok({ body: { response: todoList } })
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
    },
    (context, req, res) => {
      const { id } = req.params;
      const index = todoList.findIndex((todo) => todo.id === id);
      if (index === -1) {
        return res.notFound();
      } else {
        return res.ok({ body: { result: todoList[index] } });
      }
    }
  );
}

function registerPostTodoRoute(router: IRouter) {
  router.post(
    {
      path: '/api/todos',
      validate: {
        body: todoElementSchema,
      },
      security: { authz: { enabled: false, reason: 'testing' } },
    },
    (context, req, res) => {
      const todoElement = {
        id: uuidv4(),
        ...req.body,
      };
      todoList.push(todoElement);
      return res.ok({ body: { result: todoElement } });
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
        body: todoElementSchema,
      },
      security: { authz: { enabled: false, reason: 'testing' } },
    },
    (context, req, res) => {
      const { id } = req.params;
      const index = todoList.findIndex((todo) => todo.id === id);
      if (index === -1) {
        return res.notFound();
      }
      todoList[index] = { id, ...req.body };
      return res.ok({ body: { result: todoList[index] } });
    }
  );
}
