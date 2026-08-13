# Portability architecture

Hero has four portability boundaries:

1. Source boundary: one independent Git repository with no submodules or local dependencies.
2. Configuration boundary: runtime values come from HERO_ environment variables; examples contain no credentials.
3. Runtime boundary: Linux containers are the reference environment; host-specific paths are not part of application configuration.
4. Data boundary: persistent data uses a project-scoped volume and will later be accessed through storage adapters.

The local Node workflow exists for fast development. Compose exists as the reproducible transfer and integration boundary. Provider credentials, databases, queues, and artifact storage will be added behind explicit adapters in later approved steps.
