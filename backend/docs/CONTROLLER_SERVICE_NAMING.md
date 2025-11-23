# Controller & Service Naming Conventions

This project enforces a clear separation of concerns:

## Rules

1. Controllers live under `controllers/v1/<area>/` and are named using the pattern: `<resource>.controller.js`.
2. Controllers must only:
   - Parse & validate raw request input (existence / basic type checks only)
   - Call a service function
   - Map service errors to HTTP status codes
   - Shape the HTTP response
3. All business logic (DB queries, file system IO, AI orchestration, retries, external API calls) belongs in `services/`.
4. Service filenames use a descriptive purpose-based name, e.g.:
   - `articles/coreServices.js`
   - `articles/articlePublishingService.js`
   - `domain/staticGen.js`
   - `domain/domainCrud.js`
   - `domain/domainBuildService.js`
   - `llm/aiGenerationService.js`
5. Avoid duplicating logic across controllers—if two controllers need the same rule, move it to a service or shared util.
6. Validation that is reusable or complex lives in `ValidationService`. Lightweight presence checks may remain in controllers.

## Controller Checklist

Before committing a controller change, verify:

- [ ] No direct Prisma calls
- [ ] No `fs` / `child_process` usage
- [ ] No AI provider calls
- [ ] Only minimal request parsing & error mapping
- [ ] Delegates exactly once per logical operation to a service
