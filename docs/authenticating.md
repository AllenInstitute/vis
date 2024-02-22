# Authenticating with GitHub Packages

## Setting Up Your Personal Access Token (PAT)

Before you can publish a package, you'll need to get your Personal Access Token (PAT) configured to have access.

1. Create a new personal access token (PAT) with the proper scope (`read:pacakges` if you're consuming `vis` libraries and `write:packages` if you're working on the repository code itself). You can create a new PAT by going to your GitHub settings, selecting "Developer settings" and then "Personal access tokens".

2. Make sure to copy the token to a safe place, as you won't be able to see it again.

3. You'll also need to Configure SSO for the Allen Institute organization for the token to work.

4. Add the PAT to your `~/.npmrc` file. If you don't have an `~/.npmrc` file, create one. Add the following line to the file, replacing `YOUR_PAT` with the PAT you created in the previous step:

```
//npm.pkg.github.com/:_authToken=YOUR_PAT
```

## Troubleshooting

If any of the previous steps don't work due to updates in GitHub's platform, please reference [GitHub's documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) for details and submit a PR updating this documentation.