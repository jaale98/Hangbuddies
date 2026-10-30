import { WORDS, validateWords } from '../src/server/words';
import { DIFFICULTIES } from '../src/shared/constants';

for (const d of DIFFICULTIES) console.log(`${d.padEnd(7)} ${WORDS[d].length} entries`);
const problems = validateWords();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(' - ' + p);
  process.exit(1);
}
console.log('\nWord list looks good!');
