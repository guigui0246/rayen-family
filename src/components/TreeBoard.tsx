import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Person, Relation } from '../family/types';
import { PersonCard } from './PersonCard';

type TreeBoardProps = {
  people: Person[];
  relations: Relation[];
  peopleById: Map<string, Person>;
};

type ConnectorLine = {
  id: string;
  path: string;
  labelX: number;
  labelY: number;
  label: string;
  arrow: boolean;
  tone: 'family' | 'romance' | 'legal' | 'custom';
};

function getSpecialLabel(generation: number) {
  switch (generation) {
    case 0:
      return ' (Before Tsundere Bot aka Riko)';
    case 1:
      return ' (<1000 subs)';
    case 2:
      return ' (<20000 subs)';
    case 3:
      return ' (>=20000 subs)';
    default:
      return '';
  }
}

function formatRelationTone(tone?: Relation['tone']): ConnectorLine['tone'] {
  switch (tone) {
    case 'romance':
      return 'romance';
    case 'legal':
      return 'legal';
    case 'custom':
      return 'custom';
    default:
      return 'family';
  }
}

function relationShouldUseArrow(reverseLabel?: string) {
  return !!reverseLabel;
}

function offsetPointTowards(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  offset: number,
) {
  const deltaX = toX - fromX;
  const deltaY = toY - fromY;
  const distance = Math.max(Math.hypot(deltaX, deltaY), 1);

  return {
    x: fromX + (deltaX / distance) * offset,
    y: fromY + (deltaY / distance) * offset,
  };
}

function getAvatarBox(node: HTMLElement) {
  const avatar = node.querySelector<HTMLElement>('.person-avatar');
  return avatar?.getBoundingClientRect() ?? node.getBoundingClientRect();
}

function getPopoverShift(node: HTMLElement, container: HTMLElement) {
  const popover = node.querySelector<HTMLElement>('.person-popover');
  if (!popover) {
    return 0;
  }

  const margin = 16;

  const popoverBox = popover.getBoundingClientRect();
  const cardBox = node.getBoundingClientRect();
  const containerBox = container.getBoundingClientRect();
  // console.log('popoverBox:', popoverBox, 'cardBox:', cardBox, 'containerBox:', containerBox);

  const viewportWidth =
    window.visualViewport?.width ?? document.documentElement.clientWidth;
  // console.log('viewportWidth:', viewportWidth);

  const viewportOffset =
    window.visualViewport?.offsetLeft ?? 0;
  // console.log('viewportOffset:', viewportOffset);

  const cardCenterX = cardBox.left + cardBox.width / 2;
  const currentLeft = cardCenterX - popoverBox.width / 2;

  const minLeft = Math.max(
    containerBox.left + margin,
    margin + viewportOffset
  );

  const maxLeft = Math.min(
    containerBox.right - popoverBox.width - margin,
    viewportOffset + viewportWidth - popoverBox.width - margin
  );
  // console.log('currentLeft:', currentLeft, 'minLeft:', minLeft, 'maxLeft:', maxLeft);

  const clampedLeft = Math.max(minLeft, Math.min(currentLeft, maxLeft));

  return clampedLeft - currentLeft;
}

export function TreeBoard({ people, relations, peopleById }: TreeBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [connectorLines, setConnectorLines] = useState<ConnectorLine[]>([]);
  const generationById = useMemo(
    () => new Map(people.map((person) => [person.id, person.generation])),
    [people],
  );

  const generations = useMemo(() => {
    const grouped = new Map<number, Person[]>();
    for (const person of people) {
      const bucket = grouped.get(person.generation) ?? [];
      bucket.push(person);
      grouped.set(person.generation, bucket);
    }

    return [...grouped.entries()]
      .sort(([left], [right]) => left - right)
      .map(([generation, generationPeople]) => ({
        generation,
        people: [...generationPeople].sort((left, right) => left.order - right.order),
      }));
  }, [people]);

  useLayoutEffect(() => {
    const updateLines = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const containerBox = container.getBoundingClientRect();
      const pairKey = (relation: Relation) => {
        const [leftId, rightId] = [relation.from, relation.to].sort();
        return `${leftId}__${rightId}`;
      };

      const pairCounts = new Map<string, number>();

      for (const node of cardRefs.current.values()) {
        if (node.classList.contains('is-open')) {
          node.style.setProperty('--popover-shift', `${getPopoverShift(node, container)}px`);
        }
      }

      const nextLines = relations.flatMap((relation, index) => {
        const fromCard = cardRefs.current.get(relation.from);
        const toCard = cardRefs.current.get(relation.to);

        if (!fromCard || !toCard) {
          return [];
        }

        const fromBox = getAvatarBox(fromCard);
        const toBox = getAvatarBox(toCard);
        const fromCenterX = fromBox.left - containerBox.left + fromBox.width / 2;
        const fromCenterY = fromBox.top - containerBox.top + fromBox.height / 2;
        const toCenterX = toBox.left - containerBox.left + toBox.width / 2;
        const toCenterY = toBox.top - containerBox.top + toBox.height / 2;
        const key = pairKey(relation);
        const pairIndex = pairCounts.get(key) ?? 0;
        pairCounts.set(key, pairIndex + 1);

        const fromRadius = Math.max(fromBox.width, fromBox.height) / 2;
        const toRadius = Math.max(toBox.width, toBox.height) / 2;
        const connectorPadding = 12;
        const start = offsetPointTowards(
          fromCenterX,
          fromCenterY,
          toCenterX,
          toCenterY,
          fromRadius + connectorPadding,
        );
        const end = offsetPointTowards(
          toCenterX,
          toCenterY,
          fromCenterX,
          fromCenterY,
          toRadius + connectorPadding,
        );

        const sameGeneration = generationById.get(relation.from) === generationById.get(relation.to);

        if (!sameGeneration) {
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;

          return [
            {
              id: `${relation.from}-${relation.to}-${index}`,
              path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
              labelX: midX,
              labelY: midY,
              label: relation.label,
              arrow: relationShouldUseArrow(relation.reverseLabel),
              tone: formatRelationTone(relation.tone),
            },
          ];
        }

          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;

          return [
            {
              id: `${relation.from}-${relation.to}-${index}`,
              path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
              labelX: midX,
              labelY: midY,
              label: relation.label,
              arrow: relationShouldUseArrow(relation.reverseLabel),
              tone: formatRelationTone(relation.tone),
            },
          ];
      });

      setConnectorLines(nextLines);
    };

    const MIN_LAG = 100;
    let lag_timeout: number = 0;
    let rafId: number;
    let last: number = 0;

    const loop = (t: number) => {
      lag_timeout += t - last;
      if (lag_timeout > MIN_LAG) {
        console.log('Loop tick:', t, ', lag timeout:', lag_timeout);
        lag_timeout = 0;
        updateLines();
      }
      last = t;

      rafId = requestAnimationFrame(loop);
    };

    loop(0);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [relations]);

  const relatedRelations = (personId: string) =>
    relations.filter((relation) => relation.from === personId || relation.to === personId);

  const setCardRef = (personId: string, node: HTMLElement | null) => {
    if (node) {
      cardRefs.current.set(personId, node);
    } else {
      cardRefs.current.delete(personId);
    }
  };

  return (
    <section className="tree-board" ref={containerRef}>
      <svg className="connector-layer" aria-hidden="true">
        <defs>
          <marker
            id="relation-arrow"
            markerWidth="12"
            markerHeight="12"
            refX="10"
            refY="6"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 12 6 L 0 12 z" fill="rgba(244, 240, 234, 0.88)" />
          </marker>
        </defs>
        {connectorLines.map((line) => (
          <g key={line.id} className={`connector connector-${line.tone}`}>
            <path d={line.path} markerEnd={line.arrow ? 'url(#relation-arrow)' : undefined} />
            <text x={line.labelX} y={line.labelY - 10}>
              {line.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="generation-stack">
        {generations.map((group) => (
          <section key={group.generation} className="generation-row">
            <div className="generation-label">Generation {group.generation}{getSpecialLabel(group.generation)}</div>
            <div className="generation-grid">
              {group.people.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  relatedRelations={relatedRelations(person.id)}
                  otherPersonName={(personId) => peopleById.get(personId)?.name ?? personId}
                  setCardRef={setCardRef}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
