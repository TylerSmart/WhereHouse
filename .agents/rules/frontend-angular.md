# Frontend (Angular 22) Conventions

## 1. Angular v22 Core Rules
- **Component File Structure (Strict External Files Rule):**
  - **NEVER** use inline `template: \`...\`` or inline `styles: \`...\`` inside `@Component({...})`.
  - Always separate HTML templates and SCSS styles into dedicated sibling files: `<name>.component.html` and `<name>.component.scss`.
  - Always specify `templateUrl: './<name>.component.html'` and `styleUrl: './<name>.component.scss'` in the `@Component({...})` decorator metadata.
  - This ensures proper IDE syntax highlighting, clean Git diffs, linting, and maintains lean, readable TypeScript component files.
- **Standalone & OnPush are Default:**
  - Do **NOT** set `standalone: true` in `@Component` or `@Directive` decorators (default in Angular v20+).
  - Do **NOT** set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly (default in Angular v22+).
- **Services (`@Service()`):**
  - Use the Angular v22 `@Service()` decorator from `@angular/core` for root singleton services instead of `@Injectable({ providedIn: 'root' })` (see `src/app/core/services/todo/todo.service.ts`).
- **Dependency Injection:**
  - Always use `inject()` field initialization (`private readonly http = inject(HttpClient);`) instead of constructor injection.
- **Reactivity & Signals:**
  - Use `signal()`, `computed()`, and `linkedSignal()` for component and service state.
  - Use `input()`, `output()`, and `model()` instead of `@Input()` / `@Output()` decorators.
  - Never use `.mutate()` on signals; use `.set()` or `.update()`.
- **Templates:**
  - Always use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`.
  - Do **NOT** import `CommonModule`; import only specific pipes/directives needed (e.g., `DatePipe`, `AsyncPipe`).
  - Use `[class]` and `[style]` bindings instead of `ngClass` and `ngStyle`.
  - Put host bindings/listeners inside the `host: { ... }` metadata property of `@Component` / `@Directive`, never `@HostBinding` / `@HostListener`.

## 2. API Communication & Models
- **API URL Helper:** Always wrap backend endpoint paths with `apiUrl('/path')` from `src/app/core/api/api-url.ts` (e.g., `this.http.get<ItemDto[]>(apiUrl('/items'))`). Never hardcode `http://localhost:5041` or `/api` prefixes directly in services.
- **Auth Interceptor:** `authInterceptor` (`src/app/core/interceptors/auth.interceptor.ts`) automatically attaches the Bearer JWT token to `/api` requests.
- **Error Handling:** Backend errors return RFC 7807 `ProblemDetails`. Extract user-facing messages via `err?.error?.detail || err?.error?.title || 'Fallback message'`.

## 3. UI, Icons & Theming
- **Icons:** The app configures `MatIconRegistry` to use **Material Symbols Outlined** (`material-symbols-outlined` ligature font). Use standard Material Symbol names inside `<mat-icon>inventory_2</mat-icon>`.
- **Theming:** `ThemeService` (`src/app/core/services/theme/theme.service.ts`) manages `light`, `dark`, and `system` modes plus dynamic Material 3 palettes. Use CSS variables / Material 3 theme tokens in `.scss` files so both light and dark modes stay legible.
- **Mobile + Desktop Responsiveness:** WhereHouse is used heavily on phones in garages/closets (camera QR scanning, rapid intake) and on desktop browsers (tree management, bulk editing, label printing). Ensure all layouts work cleanly at `360px` mobile widths as well as desktop viewports.
