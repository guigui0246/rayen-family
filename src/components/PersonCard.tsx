import { useEffect, useRef, useState } from 'react';
import type { Person, Relation } from '../family/types';

type PersonCardProps = {
  person: Person;
  relatedRelations: Relation[];
  otherPersonName: (personId: string) => string;
  setCardRef: (personId: string, node: HTMLElement | null) => void;
  openPersonCard: (personId: string) => void;
  openRequestId: number;
  openPersonId: string | null;
};

function getWarningMessage(acknowledged: boolean, hasRole: boolean): string {
  if (!acknowledged && !hasRole) {
    return 'Not an official member of the family.';
  }

  if (!acknowledged) {
    return 'Not acknowledged by rayen.';
  }

  if (!hasRole) {
    return "Acknowledged by rayen but doesn't have the discord role.";
  }

  throw new Error('Invalid state: both acknowledged and hasRole are true.');
}

export function PersonCard({
  person,
  relatedRelations,
  otherPersonName,
  setCardRef,
  openPersonCard,
  openRequestId,
  openPersonId,
}: PersonCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const avatarLabel = person.avatarImage ? person.name : '?';
  const aliases = person.aliases ?? [];
  const warnings = person.warnings ?? [];
  const acknowledged = person.acknowledged;
  const hasRole = person.hasRole;
  if (!(acknowledged && hasRole)) {
    warnings.push(getWarningMessage(acknowledged, hasRole));
  }

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const node = cardRef.current;
      if (!node || !isPinnedOpen || node.contains(event.target as Node)) {
        return;
      }

      setIsPinnedOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isPinnedOpen]);

  useEffect(() => {
    if (openPersonId === person.id) {
      setIsPinnedOpen(true);
    }
  }, [openPersonId, openRequestId, person.id]);

  const isOpen = isHovered || isPinnedOpen;

  const togglePinnedOpen = () => {
    setIsPinnedOpen((current) => !current);
  };

  return (
    <article
      className={`person-card${isOpen ? ' is-open' : ''}${warnings.length > 0 ? ' has-warnings' : ''}`}
      ref={(node) => {
        cardRef.current = node;
        setCardRef(person.id, node);
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isPinnedOpen}
      aria-expanded={isOpen}
      onClick={togglePinnedOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          togglePinnedOpen();
        }
      }}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      <div className="person-core">
        <div
          className="person-avatar"
          aria-hidden="true"
        >
          {person.avatarImage ? (
            <img src={person.avatarImage} alt="" />
          ) : (
            <span>{avatarLabel}</span>
          )}
        </div>

        <div className="person-label">
          <p className="person-role">{person.role ?? ''}</p>
          <h2>{person.name}</h2>
        </div>
      </div>

      <div className="person-popover" onClick={(event) => event.stopPropagation()}>
        <header className="person-popover-head">
          <div className="person-popover-image" aria-hidden="true">
            {person.avatarImage ? <img src={person.avatarImage} alt="" /> : <span>?</span>}
          </div>
          <div className="person-popover-meta">
            <p className="person-id">{person.id}</p>
            <p className="person-role">{person.role ?? ''}</p>
            <h3>{person.name}</h3>
          </div>
        </header>

        {warnings.length > 0 ? (
          <div className="person-warning-panel" aria-label="Warnings">
            {warnings.map((warning) => (
              <div key={warning} className="person-warning-pill">
                {warning}
              </div>
            ))}
          </div>
        ) : null}

        <dl className="person-facts">
          {person.born ? (
            <div>
              <dt>Born</dt>
              <dd>{person.born}</dd>
            </div>
          ) : null}
          {person.died ? (
            <div>
              <dt>Died</dt>
              <dd>{person.died}</dd>
            </div>
          ) : null}
          {person.location ? (
            <div>
              <dt>Location</dt>
              <dd>{person.location}</dd>
            </div>
          ) : null}
        </dl>

        {person.bio ? <p className="person-bio">{person.bio}</p> : null}

        {aliases.length > 0 ? (
          <div className="person-aliases">
            <span className="person-aliases-label">Aliases</span>
            <div className="person-aliases-list">
              {aliases.map((alias) => (
                <span key={alias} className="person-alias-pill">
                  {alias}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {person.socialLinks && Object.keys(person.socialLinks).length > 0 ? (
          <div className="person-aliases">
            <span className="person-aliases-label">Social Links</span>
            <div className="social-links">
              {Object.entries(person.socialLinks).map(([network, href]) => (
                <a key={network} href={href} target="_blank" rel="noreferrer">
                  {network}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <footer className="person-footer">
          {relatedRelations.map((relation, index) => {
            const isReverse = relation.to === person.id;
            const otherId = isReverse ? relation.from : relation.to;

            return (
              <button
                key={`${relation.label}-${index}`}
                type="button"
                className="relation-chip"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsPinnedOpen(false);
                  setIsHovered(false);
                  openPersonCard(otherId);
                }}
              >
                <span>{isReverse && relation.reverseLabel ? relation.reverseLabel : relation.label}</span>
                <strong>{otherPersonName(otherId)}</strong>
              </button>
            );
          })}
        </footer>
      </div>
    </article>
  );
}
