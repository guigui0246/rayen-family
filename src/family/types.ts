export type Person = {
  id: string;
  name: string;
  aliases?: string[];
  role?: string;
  avatarImage?: string;
  warnings?: string[];
  generation: number;
  order: number;
  born?: string;
  died?: string;
  location?: string;
  bio?: string;
  socialLinks?: Record<string, string>;
  acknowledged: boolean;
  hasRole: boolean;
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
  people: Person[];
  relations: Relation[];
};
