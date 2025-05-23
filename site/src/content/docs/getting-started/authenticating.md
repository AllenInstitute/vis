---
title: GitHub Packages Authentication
description: A page describing how to authenticate with GitHub Packages.
sidebar:
    order: 1
---

All our packages are hosted on the Allen Institute's GitHub Packages registry. To use them, you will need to authenticate with GitHub Packages, which requires a GitHub account.

## Setting Up Your Personal Access Token (PAT)

Before you can install a package you'll need to get your Personal Access Token (PAT) configured to have access.

1. Create a new personal access token (PAT) with the `read:packages` proper scope (`read:packages` if you're consuming `vis` libraries and `write:packages` if you're working on the repository code itself). You can create a new PAT by going to your GitHub settings, selecting "Developer settings" and then "Personal access tokens".

2. Make sure to copy the token to a safe place, as you won't be able to see it again.

3. You'll also need to Configure SSO for the Allen Institute organization for the token to work.

4. Add the PAT to the `~/.npmrc` file in your **home directory**. If you don't have an `~/.npmrc` file, create one. (This file is different from the `.npmrc` files in each repository, _which get committed_, so be sure you're putting your token in the right place.) Add the following line to the file, replacing `YOUR_PAT` with the PAT you created in the previous step:

```
//npm.pkg.github.com/:_authToken=YOUR_PAT
```

## Authenticating in GitHub Actions or Another CI/CD Pipeline

If you have a CI/CD pipeline outside of GitHub Actions, do the following to authenticate:

1. Follow the instructions for generating a PAT in the previous section.

2. Add that new token to your pipeline's secrets (e.g. `NODE_AUTH_TOKEN`).

3. Use that secret in your pipeline to set up the token before you do the package install:

```
npm set "//npm.pkg.github.com/:_authToken=$NODE_AUTH_TOKEN"
```

## Troubleshooting

If any of the previous steps don't work due to updates in GitHub's platform, please reference [GitHub's documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) for details and submit a PR updating this documentation.
