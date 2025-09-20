import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fetchOpenRouterPricing, publishPricesToGitHub } from '../src/openrouter';

async function main() {
  const prices = await fetchOpenRouterPricing();

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.GITHUB_BRANCH ?? 'main';
  const path = process.env.PRICES_PATH ?? 'data/openrouter-pricing.json';

  if (owner && repo && token) {
    await publishPricesToGitHub(prices, { owner, repo, branch, path, token });
    // eslint-disable-next-line no-console
    console.log('Published prices to GitHub');
  } else {
    const targetPath = resolve(process.cwd(), process.env.PRICES_PATH ?? 'src/data/openrouter-pricing.json');
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, JSON.stringify(prices, null, 2) + '\n', 'utf8');
    // eslint-disable-next-line no-console
    console.log(`Saved pricing JSON to ${targetPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
