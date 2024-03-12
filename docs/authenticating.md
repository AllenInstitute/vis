# Authenticating with GitHub Packages

## Setting Up Your Personal Access Token (PAT)

Before you can publish a package, you'll need to get your Personal Access Token (PAT) configured to have access.

1. Create a new personal access token (PAT) with the proper scope (`read:packages` if you're consuming `vis` libraries and `write:packages` if you're working on the repository code itself). You can create a new PAT by going to your GitHub settings, selecting "Developer settings" and then "Personal access tokens".

2. Make sure to copy the token to a safe place, as you won't be able to see it again.

3. You'll also need to Configure SSO for the Allen Institute organization for the token to work.

4. Add the PAT to your `~/.npmrc` file. If you don't have an `~/.npmrc` file, create one. Add the following line to the file, replacing `YOUR_PAT` with the PAT you created in the previous step:

```
//npm.pkg.github.com/:_authToken=YOUR_PAT
```

## Authenticating in a GitHub Action
If you have any GitHub Actions that install packages for the repository, you'll have to configure those as well using the following steps:

1. Reach out to the `vis` repository owners with the name of the repository and which `vis` packages you want to use. They will add the repository to the "Manage Actions access" section of each package's settings.

2. Add the following to your GitHub Actions as a step before you install your packages
```
- name: Login to NPM Registry
  run: npm set "//npm.pkg.github.com/:_authToken=${{ secrets.GITHUB_TOKEN }}"
```

3. Run the GitHub Action and verify everything is working as expected.

## Authenticating in a CI/CD Pipeline
If you have a CI/CD pipeline outside of GitHub Actions, do teh following to authenticate:

1. Follow the instructions for generating a PAT in the previous section.

2. Add that new token to your pipeline's secrets.

3. Use that secret in your pipeline to set up the token before you do the package install:
```
npm set "//npm.pkg.github.com/:_authToken=$NODE_AUTH_TOKEN"
```

## Troubleshooting

If any of the previous steps don't work due to updates in GitHub's platform, please reference [GitHub's documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) for details and submit a PR updating this documentation.
