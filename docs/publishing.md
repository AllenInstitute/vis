# Publishing Packages

The `vis` project contains multiple packages, each of which is published to the Allen Institute internal GitHub NPM package registry.

## Publishing a New Package

When you have a new package to publish, follow these steps to publish it:

1. Authenticate with GitHub Packages by following the instructions in the [Authenticating with GitHub Packages](authenticating.md) documentation.

2. Add the necessary information about the repository and the registry to the `package.json` file:

```json
  "repository": {
    "type": "git",
    "url": "https://github.com/AllenInstitute/vis.git"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com/AllenInstitute"
  },
```

3. Run `pnpm publish` in the package directory.

4. Verify your package is available. You can see it listed on the [Allen Institute's GitHub NPM package registry](https://github.com/orgs/AllenInstitute/packages) or on the homepage of this repository.

## Updating an Existing Package

When you have changes to an existing package that you want to publish, follow these steps to publish the changes:

1. Authenticate with GitHub Packages by following the instructions in the [Authenticating with GitHub Packages](authenticating.md) documentation.

2. Update the version number in the `package.json` file, following the [Semantic Versioning standard](https://semver.org/). Remember to run `pnpm install` to get the lock file updated as well!

3. Get that version number update onto the `main` branch and make sure everything is ship-shape for publishing.

4. Run `pnpm publish` in the package directory.

5. Verify that the updated package is available. You can see it listed on the [Allen Institute's GitHub NPM package registry](https://github.com/orgs/AllenInstitute/packages) or on the homepage of this repository.

## Troubleshooting

If any of the previous steps don't work due to updates in GitHub's platform, please reference [GitHub's documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) for details and submit a PR updating this documentation.
