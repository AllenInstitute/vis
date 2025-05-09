---
title: Using Packages
description: A reference page in my new Starlight docs site.
---

The `vis` project contains multiple packages, each of which is published to the Allen Institute internal GitHub NPM package registry.

1. Authenticate with GitHub Packages by following the instructions in the [Authenticating with GitHub Packages](authenticating.md) documentation.

2. Create an `.npmrc` file in the root of your project and add the following so that `npm` or `pnpm` knows to use the Allen Institute's GitHub NPM package registry:

```
@NAMESPACE:registry=https://npm.pkg.github.com
```

3. Run `npm install @alleninstitute/<package-name>` to install the package.

## Troubleshooting

If any of the previous steps don't work due to updates in GitHub's platform, please reference [GitHub's documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) for details and submit a PR updating this documentation.
