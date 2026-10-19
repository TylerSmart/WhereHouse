import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../api/api-url';
import {
  CreateTodoItemRequest,
  TodoItemDto,
  UpdateTodoItemRequest,
} from '../../models/todo.models';

@Service()
export class TodoService {
  private readonly http = inject(HttpClient);

  getTodos(): Observable<TodoItemDto[]> {
    return this.http.get<TodoItemDto[]>(apiUrl('/todos'));
  }

  getTodoById(id: string): Observable<TodoItemDto> {
    return this.http.get<TodoItemDto>(apiUrl(`/todos/${id}`));
  }

  createTodo(request: CreateTodoItemRequest): Observable<TodoItemDto> {
    return this.http.post<TodoItemDto>(apiUrl('/todos'), request);
  }

  updateTodo(id: string, request: UpdateTodoItemRequest): Observable<TodoItemDto> {
    return this.http.put<TodoItemDto>(apiUrl(`/todos/${id}`), request);
  }

  deleteTodo(id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/todos/${id}`));
  }
}
