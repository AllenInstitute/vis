// Skip Husky install in production and CI
if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
    process.exit(0);
}
const husky = (await import('husky')).default;
// oxlint-disable-next-line no-console -- husky() returns install output meant for the terminal
console.log(husky());
