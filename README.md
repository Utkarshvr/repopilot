# RepoPilot

**Understand the impact before the change ships.**

RepoPilot is a Change Impact Intelligence platform that helps developers
understand the potential consequences of code changes before they ship
them.

Instead of stopping at a list of modified files, RepoPilot analyzes
repository dependencies, traces files connected to a change, explains
dependency paths, and provides a transparent structural risk assessment.

## Why RepoPilot?

A small change in a large codebase can affect files far beyond the one
being edited. Those relationships are not always obvious, especially in
unfamiliar or growing projects.

Developers often rely on manual code reviews, tribal knowledge, and
trial and error to work out what might be affected. RepoPilot makes
those relationships visible.

## Features

-   **GitHub repository analysis** --- analyze a repository and inspect
    its source structure.
-   **Dependency graph** --- visualize relationships between files and
    explore dependencies and dependents.
-   **Change detection** --- select files manually or compare GitHub
    commits to identify additions, modifications, removals, and renames.
-   **Change impact analysis** --- identify directly and transitively
    affected files from a set of changes.
-   **Dependency-path explanations** --- inspect paths connecting
    changed files to potentially affected files.
-   **Structural risk assessment** --- get an explainable risk estimate
    based on repository structure and change scope.
-   **Revision-aware analysis** --- compare repository dependency
    structures at different Git revisions.
-   **Analysis transparency** --- surface incomplete analysis,
    unsupported files, unresolved imports, and other limitations.

> **Important:** RepoPilot's risk score is a structural estimate. It is
> not a probability that a change will cause a runtime failure, and an
> identified affected file is not proof that the file is broken.

## How it works

1.  **Connect a repository.** Add a GitHub repository for analysis.
2.  **Analyze the codebase.** RepoPilot discovers files and extracts
    supported dependency relationships.
3.  **Explore the dependency graph.** Inspect how source files depend on
    one another.
4.  **Identify changes.** Select files manually or compare two Git
    commits.
5.  **Calculate the impact.** RepoPilot traverses reverse dependency
    relationships to find direct and transitive dependents.
6.  **Review the explanation.** Inspect affected files, dependency
    paths, structural risk factors, and analysis limitations.

## Technical overview

RepoPilot is built around a repository-analysis pipeline and a
graph-based impact engine.

-   **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui
-   **Graph visualization:** React Flow (`@xyflow/react`)
-   **State management:** Zustand
-   **Data fetching:** TanStack Query
-   **Code analysis:** TypeScript Compiler API for AST-based JavaScript
    and TypeScript import extraction
-   **Repository integration:** GitHub REST API

### Dependency analysis

RepoPilot uses AST-based parsing to extract supported relationships such
as static imports, named and star re-exports, dynamic imports, CommonJS
`require`, and type-only imports.

It resolves supported relative paths and configured
TypeScript/JavaScript path aliases. External package dependencies and
unresolved imports are tracked separately from resolved internal file
relationships.

### Impact analysis

The dependency graph represents importer-to-dependency relationships. To
calculate change impact, RepoPilot traverses the graph in reverse to
identify files that depend directly or transitively on changed files.

Where revision-aware analysis is available, the engine uses repository
snapshots for the relevant base and head commits instead of assuming
that the dependency graph remained unchanged.

### Analysis limitations

Results depend on the files and dependency patterns RepoPilot can
analyze. Dynamic runtime behavior, reflection, generated code,
unsupported languages, and relationships not represented by supported
import patterns may not be captured. Incomplete repository scans and
unresolved imports are surfaced as limitations.

## Getting started

### Prerequisites

-   Node.js (use a current LTS release)
-   npm

### Install dependencies

``` bash
git clone <YOUR_REPOSITORY_URL>
cd repopilot
npm install
```

### Configure environment

Check the project's environment example file, if present, and provide
the required values in a local `.env` file.

GitHub App credentials, if GitHub App integration is enabled, must be
configured only in the server-side environment. Never expose an App
private key or client secret through frontend variables such as
`VITE_*`, commit secrets to Git, or store them in browser storage.

### Run locally

``` bash
npm run dev
```

### Build for production

``` bash
npm run build
```

### Run tests

``` bash
npm test
```

If a script differs in your checkout, use the scripts declared in
`package.json`.

## Security

-   Repository analysis should not execute repository code.
-   GitHub access should use the minimum permissions required.
-   For GitHub App access, use read-only repository metadata and
    contents permissions unless the product explicitly requires
    otherwise.
-   Keep private keys, client secrets, and installation tokens out of
    the browser bundle and source control.
-   Configure secrets through the backend or deployment platform's
    server-side environment settings.

## Project status

RepoPilot was developed as a hackathon project. Core work focuses on
repository analysis, dependency visualization, change detection,
revision-aware impact calculation, and explainable structural risk.

Some integrations may require deployment-specific configuration before
they are available in a live environment. Check the current
implementation and deployment configuration before relying on them.

## Roadmap

Potential future directions include broader language and framework
support, more advanced dependency resolution, CI/CD and pull-request
integrations, team workflows, and additional impact signals beyond
static dependency relationships.

## Contributing

Contributions, bug reports, and suggestions are welcome.

1.  Fork the repository.
2.  Create a feature branch.
3.  Make focused changes and add or update tests.
4.  Run the test suite and production build.
5.  Open a pull request describing the change and its impact.

## License

No license has been specified yet. Until a license is added to this
repository, do not assume that the code is available for unrestricted
reuse.
