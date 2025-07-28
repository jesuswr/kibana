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

  const onGetListClick = () => handleGetListClick(http, setTodos, setLoading, setError);
  const onDeleteClick = (todo: TodoElementHttpResponse) =>
    handleDeleteTodo(http, todo, setTodos, setError, todos);
  const onCreateClick = () =>
    handleCreateClick(
      setIsModalOpen,
      setModalMode,
      setEditTodoId,
      setFormTitle,
      setFormDescription,
      setFormError
    );
  const onEditClick = (todo: TodoElementHttpResponse) =>
    handleEditClick(
      todo,
      setIsModalOpen,
      setModalMode,
      setEditTodoId,
      setFormTitle,
      setFormDescription,
      setFormError
    );
  const closeModal = () => handleCloseModal(setIsModalOpen, setFormError);
  const onFormSubmit = (e: React.FormEvent) =>
    handleFormSubmit(
      e,
      modalMode,
      editTodoId,
      http,
      formTitle,
      formDescription,
      setFormLoading,
      setFormError,
      setTodos,
      closeModal
    );

  return (
    <EuiPanel paddingSize="l">
      <EuiFlexGroup gutterSize="s" responsive={false}>
        <EuiFlexItem grow={false}>
          <EuiButton onClick={onGetListClick} isLoading={loading}>
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
                },
                {
                  name: 'Delete',
                  description: 'Delete this todo',
                  icon: 'trash',
                  type: 'icon',
                  onClick: (todo: TodoElementHttpResponse) => onDeleteClick(todo),
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
                />
              </EuiFormRow>
              <EuiFormRow label="Description">
                <EuiTextArea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  disabled={formLoading}
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
            >
              {modalMode === 'edit' ? 'Save' : 'Create'}
            </EuiButton>
          </EuiModalFooter>
        </EuiModal>
      )}
    </EuiPanel>
  );
}

function handleGetListClick(
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

function handleDeleteTodo(
  http: HttpSetup,
  todo: TodoElementHttpResponse,
  setTodos: React.Dispatch<React.SetStateAction<TodoElementHttpResponse[]>>,
  setError: (error: string | null) => void,
  todos: TodoElementHttpResponse[]
) {
  setError(null);
  http
    .delete(`/api/todos/${todo.id}`)
    .then(() => {
      setTodos(todos.filter((t) => t.id !== todo.id));
    })
    .catch(() => {
      setError('Failed to delete todo');
    });
}

function handleCreateClick(
  setIsModalOpen: (open: boolean) => void,
  setModalMode: (mode: 'create' | 'edit') => void,
  setEditTodoId: (id: string | null) => void,
  setFormTitle: (title: string) => void,
  setFormDescription: (desc: string) => void,
  setFormError: (err: string | null) => void
) {
  setIsModalOpen(true);
  setModalMode('create');
  setEditTodoId(null);
  setFormTitle('');
  setFormDescription('');
  setFormError(null);
}

function handleEditClick(
  todo: TodoElementHttpResponse,
  setIsModalOpen: (open: boolean) => void,
  setModalMode: (mode: 'create' | 'edit') => void,
  setEditTodoId: (id: string | null) => void,
  setFormTitle: (title: string) => void,
  setFormDescription: (desc: string) => void,
  setFormError: (err: string | null) => void
) {
  setIsModalOpen(true);
  setModalMode('edit');
  setEditTodoId(todo.id);
  setFormTitle(todo.title);
  setFormDescription(todo.description || '');
  setFormError(null);
}

function handleCloseModal(
  setIsModalOpen: (open: boolean) => void,
  setFormError: (err: string | null) => void
) {
  setIsModalOpen(false);
  setFormError(null);
}

async function handleFormSubmit(
  e: React.FormEvent,
  modalMode: 'create' | 'edit',
  editTodoId: string | null,
  http: HttpSetup,
  formTitle: string,
  formDescription: string,
  setFormLoading: (loading: boolean) => void,
  setFormError: (err: string | null) => void,
  setTodos: React.Dispatch<React.SetStateAction<TodoElementHttpResponse[]>>,
  closeModal: () => void
) {
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
