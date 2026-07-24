import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GenOrder, JsonPerson, Person, Relation } from '../family/types';
import { PersonCard } from './PersonCard';
import { updateLegend } from './updates';

type TreeBoardProps = {
  people: JsonPerson[];
  relations: Relation[];
  peopleById: Map<string, JsonPerson>;
  onMegaPfpChange: (
    personId: string,
    payload: { imageUrl: string; priority: 'hovered' | 'pinned' } | null,
  ) => void;
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

// A large number so it doesn't conflict with valid generations.
export const INVALID_GENERATION = 1000;

function getSpecialLabel(generation: number, generationOrder: GenOrder) {
  if (generation == INVALID_GENERATION) {
    return 'Unknown Generation';
  }
  if (generationOrder === 'default') {
    switch (generation) {
      case 0:
        return 'Generation 0 (Before Tsundere Bot aka Riko)';
      case 1:
        return 'Generation 1 (0-1000 subs)';
      case 2:
        return 'Generation 2 (1000-20000 subs)';
      case 3:
        return 'Generation 3 (20000-50000 subs)';
      default:
        return '';
    }
  }
  if (generationOrder === 'relations') {
    switch (generation) {
      case -1:
        return 'Generation -1';
      case 0:
        return 'Generation 0 (Rayen generation)';
      case 1:
        return 'Generation 1 (Riko generation)';
      case 2:
        return 'Generation 2';
      case 3:
        return 'Generation 3 (Slave generation)';
      default:
        return '';
    }
  }
  if (generationOrder === '1Mtournament') {
    switch (generation) {
      case -1:
        return 'Still in the tournament';
      case 0:
        return 'In Losers\' bracket';
      case 1:
        return 'Winner';
      case 2:
        return '2nd place';
      case 3:
        return '3rd place';
      case 4:
        return 'Eliminated in finale (round 5 and losers round 6 & 7)';
      case 5:
        return 'Eliminated in semi-finals (round 4 and losers round 4 & 5)';
      case 6:
        return 'Eliminated in quarter-finals (round 3 and losers round 2 & 3)';
      case 7:
        return 'Eliminated at the start of knockout';
      case 8:
        return 'Eliminated in group stage';
      default:
        return 'Not in the tournament';
    }
  }
  return '';
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


function genPeople(people: JsonPerson[], generationOrder: GenOrder): Person[] {
  let index = 0;
  if (generationOrder === 'relations') {
    index = 1;
  }
  if (generationOrder === '1Mtournament') {
    index = 2;
  }
  const peopleWithGeneration = people.map((person) => ({
    ...person,
    generation: person.ordering[index]?.[0] ?? INVALID_GENERATION,
    order: person.ordering[index]?.[1] ?? INVALID_GENERATION,
  }));
  return peopleWithGeneration;
}


export function TreeBoard({ people, relations, peopleById, onMegaPfpChange }: TreeBoardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const [connectorLines, setConnectorLines] = useState<ConnectorLine[]>([]);
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);
  const [openRequestId, setOpenRequestId] = useState(0);
  const [generationOrder, setGenerationOrder] = useState<GenOrder>('default');
  const peoples = useMemo<Person[]>(() => genPeople(people, generationOrder), [people, generationOrder]);

  const generationById = useMemo(
    () => new Map(peoples.map((person) => [person.id, person.generation])),
    [peoples],
  );

  const generations = useMemo(() => {
    const grouped = new Map<number, Person[]>();
    for (const person of peoples) {
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
  }, [peoples]);

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
        // console.log('Loop tick:', t, ', lag timeout:', lag_timeout);
        lag_timeout = 0;
        updateLines();
        updateLegend();
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

  const openPersonCard = (personId: string) => {
    const node = cardRefs.current.get(personId);

    setOpenPersonId(personId);
    setOpenRequestId((current) => current + 1);

    if (!node) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        node.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'start',
        });
      });
    });
  };

  return (
    <section className="tree-board" ref={containerRef}>
      <div className="tree-board-order-choice" role="group" aria-label="Generation ordering">
        <p className="tree-board-order-label">Order generations by</p>
        <div className="tree-board-order-toggle">
          <button
            type="button"
            className={generationOrder === 'default' ? 'is-active' : undefined}
            aria-pressed={generationOrder === 'default'}
            onClick={() => setGenerationOrder('default')}
          >
            Default
          </button>
          <button
            type="button"
            className={generationOrder === 'relations' ? 'is-active' : undefined}
            aria-pressed={generationOrder === 'relations'}
            onClick={() => setGenerationOrder('relations')}
          >
            Relations
          </button>
          <button
            type="button"
            className={generationOrder === '1Mtournament' ? 'is-active' : undefined}
            aria-pressed={generationOrder === '1Mtournament'}
            onClick={() => setGenerationOrder('1Mtournament')}
          >
            1 Month Tournament
          </button>
        </div>
      </div>
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
            <div className="generation-label">{getSpecialLabel(group.generation, generationOrder)}</div>
            <div className="generation-grid">
              {group.people.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  relatedRelations={relatedRelations(person.id)}
                  otherPersonName={(personId) => peopleById.get(personId)?.name ?? personId}
                  setCardRef={setCardRef}
                  openPersonCard={openPersonCard}
                  openRequestId={openRequestId}
                  openPersonId={openPersonId}
                  onMegaPfpChange={onMegaPfpChange}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
