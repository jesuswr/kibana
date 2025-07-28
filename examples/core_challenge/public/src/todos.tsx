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
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editTodoId, setEditTodoId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function onGetListClick() {
    handleGetListClick(http, setTodos, setLoading, setError);
  }

  function onCreateClick() {
    setIsModalOpen(true);
    setModalMode('create');
    setEditTodoId(null);
    setFormTitle('');
    setFormDescription('');
    setFormError(null);
  }

  function onEditClick(todo: TodoElementHttpResponse) {
    setIsModalOpen(true);
    setModalMode('edit');
    setEditTodoId(todo.id);
    setFormTitle(todo.title);
    setFormDescription(todo.description || '');
    setFormError(null);
  }

  function closeModal() {
    setIsModalOpen(false);
    setFormError(null);
  }

  async function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      if (modalMode === 'create') {
        const result = await http.post<TodoElementHttpResponse>('/api/todos', {
          body: JSON.stringify({ title: formTitle, description: formDescription }),
        });
        setTodos((prev) => [...prev, result]);
      } else if (modalMode === 'edit' && editTodoId) {
        await http.put(`/api/todos/${editTodoId}`, {
          body: JSON.stringify({ title: formTitle, description: formDescription }),
        });
        setTodos((prev) =>
          prev.map((todo) =>
            todo.id === editTodoId
              ? { ...todo, title: formTitle, description: formDescription }
              : todo
          )
        );
      }
      closeModal();
    } catch (err) {
      setFormError('Failed to save todo');
    } finally {
      setFormLoading(false);
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
                desc ? (
                  desc
                ) : (
                  <EuiTextColor color="subdued">
                    <em>No description</em>
                  </EuiTextColor>
                ),
            },
            {
              name: 'Actions',
              actions: [
                {
                  name: 'Edit',
                  description: 'Edit this todo',
                  icon: 'pencil',
                  type: 'icon',
                  onClick: (todo: TodoElementHttpResponse) => onEditClick(todo),
                  'data-test-subj': 'editTodoButton',
                },
              ],
            },
          ]}
        />
      ) : (
        <EuiTextColor color="subdued">No todos to display.</EuiTextColor>
      )}

      {isModalOpen && (
        <EuiModal onClose={closeModal} initialFocus="#todoTitleInput">
          <EuiModalHeader>
            <EuiModalHeaderTitle>
              {modalMode === 'edit' ? 'Edit Todo' : 'Create new Todo'}
            </EuiModalHeaderTitle>
          </EuiModalHeader>
          <EuiModalBody>
            <EuiForm component="form" onSubmit={onFormSubmit}>
              <EuiFormRow
                label="Title"
                error={formError && !formTitle ? 'Title is required' : undefined}
              >
                <EuiFieldText
                  id="todoTitleInput"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  disabled={formLoading}
                  data-test-subj="todoTitleInput"
                />
              </EuiFormRow>
              <EuiFormRow label="Description">
                <EuiTextArea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  disabled={formLoading}
                  data-test-subj="todoDescriptionInput"
                />
              </EuiFormRow>
              {formError && <EuiTextColor color="danger">{formError}</EuiTextColor>}
            </EuiForm>
          </EuiModalBody>
          <EuiModalFooter>
            <EuiButton onClick={closeModal} color="text" disabled={formLoading}>
              Cancel
            </EuiButton>
            <EuiButton
              type="submit"
              fill
              onClick={onFormSubmit}
              isLoading={formLoading}
              disabled={!formTitle.trim() || formLoading}
              data-test-subj="submitNewTodoButton"
            >
              {modalMode === 'edit' ? 'Save' : 'Create'}
            </EuiButton>
          </EuiModalFooter>
        </EuiModal>
      )}
    </EuiPanel>
  );
}
