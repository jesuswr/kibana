/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import {
  EuiTextColor,
  EuiButton,
  EuiPanel,
  EuiSpacer,
  EuiBasicTable,
  EuiFlexGroup,
  EuiFlexItem,
  EuiModal,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiModalBody,
  EuiModalFooter,
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiTextArea,
} from '@elastic/eui';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function onGetListClick() {
    handleGetListClick(http, setTodos, setLoading, setError);
  }

  function onCreateClick() {
    setIsModalOpen(true);
    setNewTitle('');
    setNewDescription('');
    setCreateError(null);
  }

  function closeModal() {
    setIsModalOpen(false);
    setCreateError(null);
  }

  async function onCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    try {
      const result = await http.post<TodoElementHttpResponse>('/api/todos', {
        body: JSON.stringify({ title: newTitle, description: newDescription }),
      });
      setTodos((prev) => [...prev, result]);
      closeModal();
    } catch (err) {
      setCreateError('Failed to create todo');
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <EuiPanel paddingSize="l">
      <EuiFlexGroup gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiButton onClick={onGetListClick} isLoading={loading} data-test-subj="fetchTodosButton">
            Fetch Todos
          </EuiButton>
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiButton onClick={onCreateClick}>Create new Todo</EuiButton>
        </EuiFlexItem>
      </EuiFlexGroup>

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

      {isModalOpen && (
        <EuiModal onClose={closeModal} initialFocus="#todoTitleInput">
          <EuiModalHeader>
            <EuiModalHeaderTitle>Create new Todo</EuiModalHeaderTitle>
          </EuiModalHeader>
          <EuiModalBody>
            <EuiForm component="form" onSubmit={onCreateSubmit}>
              <EuiFormRow
                label="Title"
                error={createError && !newTitle ? 'Title is required' : undefined}
              >
                <EuiFieldText
                  id="todoTitleInput"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  disabled={createLoading}
                  data-test-subj="todoTitleInput"
                />
              </EuiFormRow>
              <EuiFormRow label="Description">
                <EuiTextArea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  disabled={createLoading}
                  data-test-subj="todoDescriptionInput"
                />
              </EuiFormRow>
              {createError && <EuiTextColor color="danger">{createError}</EuiTextColor>}
            </EuiForm>
          </EuiModalBody>
          <EuiModalFooter>
            <EuiButton onClick={closeModal} color="text" disabled={createLoading}>
              Cancel
            </EuiButton>
            <EuiButton
              type="submit"
              fill
              onClick={onCreateSubmit}
              isLoading={createLoading}
              disabled={!newTitle.trim() || createLoading}
              data-test-subj="submitNewTodoButton"
            >
              Create
            </EuiButton>
          </EuiModalFooter>
        </EuiModal>
      )}
    </EuiPanel>
  );
}
