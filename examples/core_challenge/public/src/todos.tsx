/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import { EuiTextColor, EuiButton, EuiPanel, EuiSpacer, EuiBasicTable } from '@elastic/eui';
import type { HttpSetup } from '@kbn/core/public';
import type { TodoElementHttpResponse } from '../../server/src/types';

interface TodosListProps {
  http: HttpSetup;
}

export function handleGetListClick(
  http: HttpSetup,
  setTodos: (todos: TodoElementHttpResponse[]) => void,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) {
  setTodos([]);
  setLoading(true);
  setError(null);

  http
    .get<TodoElementHttpResponse[]>('/api/todos')
    .then((result) => {
      setTodos(result);
    })
    .catch(() => {
      setError('Failed to fetch todos');
    })
    .finally(() => {
      setLoading(false);
    });
}

export function TodosList({ http }: TodosListProps) {
  const [todos, setTodos] = useState<TodoElementHttpResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onGetListClick() {
    handleGetListClick(http, setTodos, setLoading, setError);
  }

  return (
    <EuiPanel paddingSize="l">
      <EuiButton onClick={onGetListClick} isLoading={loading} data-test-subj="fetchTodosButton">
        Fetch Todos
      </EuiButton>
      <EuiSpacer size="m" />
      {error && <EuiTextColor color="danger">{error}</EuiTextColor>}
      {todos && todos.length > 0 ? (
        <EuiBasicTable
          data-test-subj="todosTable"
          items={todos}
          columns={[
            {
              field: 'title',
              name: 'Title',
            },
            {
              field: 'description',
              name: 'Description',
              render: (desc: string) =>
                desc || <EuiTextColor color="subdued">No description</EuiTextColor>,
            },
          ]}
        />
      ) : (
        <EuiTextColor color="subdued">No todos to display.</EuiTextColor>
      )}
    </EuiPanel>
  );
}
