import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TodoItemDto } from '../../models/todo.models';
import { TodoService } from './todo.service';

describe('TodoService', () => {
  let service: TodoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TodoService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(TodoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch todos via GET /api/todos', () => {
    const mockTodos: TodoItemDto[] = [
      {
        id: 't-1',
        title: 'Sample Task',
        description: 'Details',
        isCompleted: false,
        createdAt: '2026-10-18T00:00:00Z',
        modifiedAt: '2026-10-18T00:00:00Z',
      },
    ];

    service.getTodos().subscribe((todos) => {
      expect(todos).toEqual(mockTodos);
    });

    const req = httpMock.expectOne('/api/todos');
    expect(req.request.method).toBe('GET');
    req.flush(mockTodos);
  });

  it('should create a todo via POST /api/todos', () => {
    const payload = { title: 'New Task', description: 'Optional desc' };
    const mockCreated: TodoItemDto = {
      id: 't-2',
      title: 'New Task',
      description: 'Optional desc',
      isCompleted: false,
      createdAt: '2026-10-18T00:00:00Z',
      modifiedAt: '2026-10-18T00:00:00Z',
    };

    service.createTodo(payload).subscribe((created) => {
      expect(created).toEqual(mockCreated);
    });

    const req = httpMock.expectOne('/api/todos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockCreated);
  });

  it('should update a todo via PUT /api/todos/:id', () => {
    const payload = { title: 'Updated Task', description: null, isCompleted: true };
    const mockUpdated: TodoItemDto = {
      id: 't-1',
      title: 'Updated Task',
      description: null,
      isCompleted: true,
      createdAt: '2026-10-18T00:00:00Z',
      modifiedAt: '2026-10-18T00:00:00Z',
    };

    service.updateTodo('t-1', payload).subscribe((updated) => {
      expect(updated).toEqual(mockUpdated);
    });

    const req = httpMock.expectOne('/api/todos/t-1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(mockUpdated);
  });

  it('should delete a todo via DELETE /api/todos/:id', () => {
    service.deleteTodo('t-1').subscribe();

    const req = httpMock.expectOne('/api/todos/t-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
