export type Accessory =
  | 'partyhat' | 'bow' | 'cap' | 'glasses' | 'halo' | 'mustache'
  | 'headphones' | 'flower' | 'beanie' | 'bandana' | 'tophat' | 'antenna';

export interface Avatar {
  id: string;
  label: string;
  color: string; // fills (hats, details)
  ink: string; // deeper shade for the figure's lines
  accessory: Accessory;
}

export const AVATARS: Avatar[] = [
  { id: 'party', label: 'Party Pal', color: '#ef476f', ink: '#d23a62', accessory: 'partyhat' },
  { id: 'bow', label: 'Bowtie Bea', color: '#f78c6b', ink: '#df6a42', accessory: 'bow' },
  { id: 'cap', label: 'Cap Kid', color: '#f4b400', ink: '#d79a00', accessory: 'cap' },
  { id: 'specs', label: 'Specs', color: '#06d6a0', ink: '#05a882', accessory: 'glasses' },
  { id: 'halo', label: 'Angel', color: '#4cc9f0', ink: '#1d9fd0', accessory: 'halo' },
  { id: 'stache', label: 'Mr. Stache', color: '#118ab2', ink: '#0d6f8f', accessory: 'mustache' },
  { id: 'dj', label: 'DJ', color: '#7b2cbf', ink: '#6420a3', accessory: 'headphones' },
  { id: 'flower', label: 'Daisy', color: '#ff70a6', ink: '#e24f88', accessory: 'flower' },
  { id: 'beanie', label: 'Beanie', color: '#3a86ff', ink: '#2a6fe0', accessory: 'beanie' },
  { id: 'bandana', label: 'Bandit', color: '#e63946', ink: '#c92d3a', accessory: 'bandana' },
  { id: 'tophat', label: 'Fancy', color: '#495057', ink: '#343a40', accessory: 'tophat' },
  { id: 'alien', label: 'Zorp', color: '#2a9d8f', ink: '#1f8174', accessory: 'antenna' },
];

export const AVATAR_IDS = AVATARS.map((a) => a.id);
const byId = new Map(AVATARS.map((a) => [a.id, a]));
export const getAvatar = (id: string): Avatar => byId.get(id) ?? AVATARS[0];
