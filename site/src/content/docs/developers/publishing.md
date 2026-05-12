---
title: Publishing Packages
description: A page describing how to publish packages in the vis project.
---

The `vis` project contains multiple packages, each of which is published to the Allen Institute NPM organization package registry.

## Publishing a New Package

Publishing is handled by two GitHub Actions workflows. The **Release** workflow is triggered manually and handles bumping the version, generating the changelog, and creating a git tag. Pushing that tag then automatically triggers the **Publish** workflow, which builds and publishes the package to NPM.

When you have a new package to publish, follow these steps:

1. Add the necessary information about the repository and the registry to the `package.json` file:

```json
  "repository": {
    "type": "git",
    "url": "https://github.com/AllenInstitute/vis.git"
  },
  "publishConfig": {
    "registry": "https://registry.npmjs.org",
    "access": "public"
  },
```

2. Get all changes onto the `main` branch and make sure everything is ship-shape for publishing.

3. Go to **Actions → Release** in the GitHub repository, click **Run workflow**, select the package to release, and run it. The workflow will bump the version, update the changelog, create a tag, and push — which automatically triggers the Publish workflow.

4. Verify your package is available. You can see it listed on the [Allen Institute's NPM organization package registry](https://www.npmjs.com/org/alleninstitute) or on the homepage of this repository.

## Updating an Existing Package

When you have changes to an existing package that you want to publish, follow these steps:

1. Get all changes onto the `main` branch and make sure everything is ship-shape for publishing.

2. Go to **Actions → Release** in the GitHub repository, click **Run workflow**, select the package to release, and run it. The workflow will automatically determine the next version (following [Semantic Versioning](https://semver.org/)) based on commit history, update the changelog, create a tag, and push — which automatically triggers the Publish workflow.

3. Verify that the updated package is available. You can see it listed on the [Allen Institute's NPM organization package registry](https://www.npmjs.com/org/alleninstitute) or on the homepage of this repository.

## Troubleshooting

If any of the previous steps don't work due to updates in GitHub's platform, please reference [GitHub's documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) for details and submit a PR updating this documentation.
