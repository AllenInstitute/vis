# Vis Library Roadmap

## Path to 0.1.0
- Rename the `vis-scatterbrain` package to `vis-core`
- Apply error handling across the codebase with consistent formatting, usage of error types and logging
- Test coverage tools are in place and we're alerted on PRs as to how the coverage has changed
- Libraries used are updated to latest versions
- Docs are fleshed out a bit more (can still be markdown and not be fully comprehensive)
- Examples website is upgraded to be somewhat more user-friendly and easier on the eyes (doesn't have to be fancy)

## Path to 1.0.0
- Comprehensive, easy to use docs that are deployed to a publically-accessible website, e.g. an mdBook site, an Astro Docs site, etc.
- Comprehensive docs include tutorials for how to setup and use each package, descriptions of lifecycles of key elements, etc.
- Live running examples of library components alongside the documentation, with users able to experiment with different settings (ala Storybook) to explore what the visualizations can do
- Live CodePens or similar available on documentation site to enable code-level experimentation for users
- Nice/very nice to have: Performance tests triggered by PR changes
- All packages have been tested extensively for over 6 months without any major issues
- Package publishing is entirely or significantly automated
- Changelog has been published
- Documentation for how to create the changelog has been published
- The `bkp-client` Scatterbrain capabilities have been translated into a new `vis-scatterbrain` or similar package
