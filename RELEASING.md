# Releasing dsh-medals

Package: `@cassius0924/dsh-medals`
Repository: `Cassius0924/dsh-medals`

## First publication

The package owner must authenticate with npm (`npm login --auth-type=web`)
and publish the initial public version with `npm publish --access public`.
Configure a Trusted Publisher using npm 11.15 or newer:

```sh
npm trust github @cassius0924/dsh-medals --repo Cassius0924/dsh-medals --file publish.yml --allow-publish --yes
npm trust list @cassius0924/dsh-medals
```

npm may open a browser for two-factor verification. The same configuration
can also be entered on the package's npm settings page:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `Cassius0924` |
| Repository | `dsh-medals` |
| Workflow filename | `publish.yml` |
| Environment | Leave blank |

No `NPM_TOKEN` is used by the workflow. A repository workflow alone does not
grant registry publication rights; the npm trust relationship must exist too.
See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

## Subsequent releases

1. Bump `package.json` and update `package-lock.json`.
2. Run `npm ci --ignore-scripts`, `npm test`, `npm run build`,
   `npx playwright install chromium`, `npm run test:browser`, and `npm pack --dry-run`.
3. Commit and push as Cassius0924.
4. Publish a GitHub Release with the matching tag, e.g. `v0.4.1`.

`.github/workflows/publish.yml` checks out the release tag, installs locked
dependencies, tests, builds, runs browser checks, verifies the version/tag,
and publishes with provenance using GitHub OIDC. A prerelease also triggers
publication; keep incomplete releases as drafts instead.

CI runs the same portable unit, localization/layout browser and packaging
checks on every push to `master` and on pull requests. Other browser scripts
are deployment-host diagnostics and are not required on GitHub runners.
