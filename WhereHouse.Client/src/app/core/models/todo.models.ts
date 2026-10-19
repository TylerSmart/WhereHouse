export interface TodoItemDto {
  id: string;
  title: string;
  description: string | null;
  isCompleted: boolean;
  createdAt: string;
  modifiedAt: string;
}

export interface CreateTodoItemRequest {
  title: string;
  description?: string | null;
}

export interface UpdateTodoItemRequest {
  title: string;
  description?: string | null;
  isCompleted: boolean;
}
