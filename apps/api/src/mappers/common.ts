import type { NamedItem } from '@brawlwiki/shared';
import type { RawNamed } from '../supercell/types';

export const stripHash = (tag: string): string => tag.replace(/^#/, '');

export const named = (items?: RawNamed[]): NamedItem[] => (items ?? []).map(({ id, name }) => ({ id, name }));
