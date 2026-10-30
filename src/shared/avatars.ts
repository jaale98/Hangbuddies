export type Accessory =
  | 'partyhat' | 'bow' | 'cap' | 'glasses' | 'halo' | 'mustache'
  | 'headphones' | 'flower' | 'beanie' | 'bandana' | 'tophat' | 'antenna';

export interface Avatar {
  id: string;
  label: string;
  color: string;
  accessory: Accessory;
}

export const AVATARS: Avatar[] = [
  { id: 'party', label: 'Party Pal', color: '#ef476f', accessory: 'partyhat' },
  { id: 'bow', label: 'Bowtie Bea', color: '#f78c6b', accessory: 'bow' },
  { id: 'cap', label: 'Cap Kid', color: '#f4b400', accessory: 'cap' },
  { id: 'specs', label: 'Specs', color: '#06d6a0', accessory: 'glasses' },
  { id: 'halo', label: 'Angel', color: '#4cc9f0', accessory: 'halo' },
  { id: 'stache', label: 'Mr. Stache', color: '#118ab2', accessory: 'mustache' },
  { id: 'dj', label: 'DJ', color: '#7b2cbf', accessory: 'headphones' },
  { id: 'flower', label: 'Daisy', color: '#ff70a6', accessory: 'flower' },
  { id: 'beanie', label: 'Beanie', color: '#3a86ff', accessory: 'beanie' },
  { id: 'bandana', label: 'Bandit', color: '#e63946', accessory: 'bandana' },
  { id: 'tophat', label: 'Fancy', color: '#495057', accessory: 'tophat' },
  { id: 'alien', label: 'Zorp', color: '#2a9d8f', accessory: 'antenna' },
];

export const AVATAR_IDS = AVATARS.map((a) => a.id);
const byId = new Map(AVATARS.map((a) => [a.id, a]));
export const getAvatar = (id: string): Avatar => byId.get(id) ?? AVATARS[0];
