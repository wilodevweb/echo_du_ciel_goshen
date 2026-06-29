import FichiersPage from '../src/app/fichiers/page';

async function main() {
  console.log('Rendering FichiersPage component...');
  try {
    const props = {
      searchParams: Promise.resolve({ q: '', type: 'all' }),
    };
    const result = await FichiersPage(props);
    console.log('SUCCESS: Component rendered without throwing.');
    // Let's inspect if it is a valid element
    console.log('Component type:', typeof result);
  } catch (error: unknown) {
    console.error('ERROR rendering FichiersPage component:', error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
}

main();
