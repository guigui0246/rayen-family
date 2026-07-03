export type JsonPerson = {
  id: string;
  name: string;
  aliases?: string[];
  role?: string;
  avatarImage?: string;
  warnings?: string[];
  ordering: number[][];
  born?: string;
  died?: string;
  location?: string;
  bio?: string;
  socialLinks?: Record<string, string>;
  acknowledged: boolean;
  hasRole: boolean;
  modifiers?: {
    strike?: boolean;
    megaPfP?: boolean;
  };
};

export type Person = JsonPerson & {
  generation: number;
  order: number;
};

export type Relation = {
  from: string;
  to: string;
  label: string;
  tone?: 'family' | 'romance' | 'legal' | 'custom';
  reverseLabel?: string;
};

export type TreeSettings = {
  title: string;
  subtitle: string;
  editContact: {
    label: string;
    href: string;
    mail: string;
    github: string;
  };
  people: JsonPerson[];
  relations: Relation[];
};

export type GenOrder = 'default' | 'relations';
