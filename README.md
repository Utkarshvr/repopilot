# RepoPilot

RepoPilot analyzes public GitHub repositories and builds a JavaScript/TypeScript dependency graph from source imports. Use it to inspect module relationships, compare revisions, and review the likely dependency impact of selected changes.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- Network access to GitHub’s public API and `raw.githubusercontent.com`

RepoPilot does not require environment variables or a GitHub token. It only supports public repositories; API requests use GitHub’s anonymous rate limit. Analyses and revision snapshots are saved in the current browser’s local storage.

## Run locally

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To run checks and create a production build:

```sh
npm test
npm run build
npm run preview
```

`npm run build` runs the TypeScript project checks before producing the static site in `dist/`.

## Deploy to Netlify

The repository includes `netlify.toml` with the build command, Node version, publish directory, and single-page-app route fallback.

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project** and select the repository.
3. Keep the build settings from `netlify.toml` (`npm run build`, publish `dist`).
4. Leave environment variables empty; RepoPilot has no required secrets.
5. Deploy. Netlify serves the static client and routes page refreshes back through `index.html`.

The browser calls GitHub directly, so the deployed site needs outbound access to GitHub’s public API and raw content host. Do not add a personal access token to client-side environment variables.

## Recommended demo workflow

Use the public [`pmndrs/zustand`](https://github.com/pmndrs/zustand) repository. The following immutable revisions were validated in RepoPilot and keep the comparison reproducible:

- Base: `5408e012ccd5785b7a0e564b0fbdc8b555ecdb47`
- Head: `382d29c485e67018c06e75ec7235130d0968522c`

1. Open **Repositories**, connect `pmndrs/zustand`, and analyze its default branch.
2. Open **Dependency Graph**, search for `src/vanilla.ts`, and select it to show its direct dependencies and dependents.
3. Open **Change Analysis → GitHub comparison**. Paste the base and head SHAs above and compare them.
4. Select a changed source file that is eligible for impact analysis, then continue after both revision graphs finish building.
5. In **Impact Analysis**, review the affected-file counts, structural risk factors, completeness limitations, and base/head revisions.
6. Select an affected file to highlight its dependency path and read the explanation beside the list.

RepoPilot reports real GitHub and graph results. The structural risk score is a deterministic heuristic, not a probability of runtime failure. Partial graphs and unresolved imports are shown as analysis limitations.

## Analysis boundaries

- Only public repositories are supported; private repositories require an authenticated service that this release does not provide.
- Source graph extraction covers JavaScript and TypeScript extensions. Safety limits and exclusions are reported per file.
- GitHub compare responses can omit patches and are capped at 300 changed files.
- The TypeScript parser is loaded on demand when repository analysis starts; its production chunk is large, but it is excluded from the initial application bundle.
- Repository data is local to the browser profile. Clearing site storage removes saved analyses and snapshots.
