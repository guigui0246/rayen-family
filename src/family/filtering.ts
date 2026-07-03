import type { JsonPerson, Relation } from './types';

export type MatchMode = 'all' | 'any';
export type PresenceMode = 'present' | 'absent';

export type PersonFieldKey = 'id' | 'name' | 'aliases' | 'role' | 'born' | 'died' | 'location' | 'bio';

export type FilterState = {
  matchMode: MatchMode;
  keyword: string;
  personFields: Record<PersonFieldKey, string>;
  socialPresenceMode: PresenceMode;
  socialFilters: Record<string, boolean>;
  relationPresenceMode: PresenceMode;
  relationToneFilters: Record<string, boolean>;
  relationLabelFilters: Record<string, boolean>;
};

export type FilterOptions = {
  socialNetworks: string[];
  relationTones: Array<NonNullable<Relation['tone']>>;
  relationLabels: string[];
  personFields: Array<{ key: PersonFieldKey; label: string }>;
};

const personFieldLabels: Array<{ key: PersonFieldKey; label: string }> = [
  { key: 'id', label: 'Id' },
  { key: 'name', label: 'Name' },
  { key: 'aliases', label: 'Aliases' },
  { key: 'role', label: 'Role' },
  { key: 'born', label: 'Born' },
  { key: 'died', label: 'Died' },
  { key: 'location', label: 'Location' },
  { key: 'bio', label: 'Bio' },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function includesQuery(value: string | undefined, query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return true;
  }

  return normalize(value ?? '').includes(normalizedQuery);
}

function getPersonSearchText(person: JsonPerson) {
  return [
    person.id,
    person.name,
    ...(person.aliases ?? []),
    person.role,
    person.born,
    person.died,
    person.location,
    person.bio,
    ...(person.socialLinks ? Object.entries(person.socialLinks).flatMap(([network, href]) => [network, href]) : []),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

function getRelationSearchText(relation: Relation) {
  return [relation.from, relation.to, relation.label, relation.tone].filter(Boolean).join(' ');
}

function relationMatchesCriterion(
  relation: Relation,
  selectedValues: Record<string, boolean>,
  field: 'tone' | 'label',
  mode: PresenceMode,
) {
  const activeValues = Object.entries(selectedValues)
    .filter(([, enabled]) => enabled)
    .map(([value]) => value);

  if (activeValues.length === 0) {
    return true;
  }

  const relationValue = normalize(field === 'tone' ? relation.tone ?? '' : relation.label);
  const matches = activeValues.some((value) => normalize(value) === relationValue);

  return mode === 'present' ? matches : !matches;
}

function evaluateActiveChecks(checks: boolean[], mode: MatchMode) {
  if (checks.length === 0) {
    return true;
  }

  return mode === 'all' ? checks.every(Boolean) : checks.some(Boolean);
}

export function createInitialFilterState(): FilterState {
  return {
    matchMode: 'all',
    keyword: '',
    personFields: {
      id: '',
      name: '',
      aliases: '',
      role: '',
      born: '',
      died: '',
      location: '',
      bio: '',
    },
    socialPresenceMode: 'present',
    socialFilters: {},
    relationPresenceMode: 'present',
    relationToneFilters: {},
    relationLabelFilters: {},
  };
}

export function buildFilterOptions(people: JsonPerson[], relations: Relation[]): FilterOptions {
  const socialNetworks = [...new Set(people.flatMap((person) => Object.keys(person.socialLinks ?? {})))].sort();
  const relationTones = [...new Set(relations.map((relation) => relation.tone).filter(Boolean))].sort() as Array<
    NonNullable<Relation['tone']>
  >;
  const relationLabels = [...new Set(relations.map((relation) => relation.label))].sort((left, right) =>
    left.localeCompare(right),
  );

  return {
    socialNetworks,
    relationTones,
    relationLabels,
    personFields: personFieldLabels,
  };
}

export function filterPeople(people: JsonPerson[], relations: Relation[], filters: FilterState) {
  return people.filter((person) => {
    const checks: boolean[] = [];
    const normalizedKeyword = normalize(filters.keyword);

    if (normalizedKeyword) {
      checks.push(getPersonSearchText(person).toLowerCase().includes(normalizedKeyword));
    }

    for (const [field, query] of Object.entries(filters.personFields) as Array<[PersonFieldKey, string]>) {
      if (!normalize(query)) {
        continue;
      }

      if (field === 'aliases') {
        checks.push((person.aliases ?? []).join(' ').toLowerCase().includes(normalize(query)));
        continue;
      }

      checks.push(includesQuery(person[field], query));
    }

    const personNetworks = Object.keys(person.socialLinks ?? {});
    for (const [network, enabled] of Object.entries(filters.socialFilters)) {
      if (!enabled) {
        continue;
      }

      const hasNetwork = personNetworks.includes(network);
      checks.push(filters.socialPresenceMode === 'present' ? hasNetwork : !hasNetwork);
    }

    const personRelations = relations.filter((relation) => relation.from === person.id || relation.to === person.id);
    for (const [tone, enabled] of Object.entries(filters.relationToneFilters)) {
      if (!enabled) {
        continue;
      }

      const hasTone = personRelations.some((relation) => normalize(relation.tone ?? '') === normalize(tone));
      checks.push(filters.relationPresenceMode === 'present' ? hasTone : !hasTone);
    }

    for (const [label, enabled] of Object.entries(filters.relationLabelFilters)) {
      if (!enabled) {
        continue;
      }

      const hasLabel = personRelations.some((relation) => normalize(relation.label) === normalize(label));
      checks.push(filters.relationPresenceMode === 'present' ? hasLabel : !hasLabel);
    }

    return evaluateActiveChecks(checks, filters.matchMode);
  });
}

export function filterRelations(relations: Relation[], visiblePeople: JsonPerson[], filters: FilterState) {
  const visibleIds = new Set(visiblePeople.map((person) => person.id));
  const normalizedKeyword = normalize(filters.keyword);
  const activeToneFilters = Object.entries(filters.relationToneFilters).filter(([, enabled]) => enabled);
  const activeLabelFilters = Object.entries(filters.relationLabelFilters).filter(([, enabled]) => enabled);

  return relations.filter((relation) => {
    if (!visibleIds.has(relation.from) || !visibleIds.has(relation.to)) {
      return false;
    }

    const checks: boolean[] = [];

    if (normalizedKeyword) {
      checks.push(getRelationSearchText(relation).toLowerCase().includes(normalizedKeyword));
    }

    if (activeToneFilters.length > 0) {
      checks.push(relationMatchesCriterion(relation, filters.relationToneFilters, 'tone', filters.relationPresenceMode));
    }

    if (activeLabelFilters.length > 0) {
      checks.push(relationMatchesCriterion(relation, filters.relationLabelFilters, 'label', filters.relationPresenceMode));
    }

    return evaluateActiveChecks(checks, filters.matchMode);
  });
}
