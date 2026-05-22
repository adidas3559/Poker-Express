/// <reference types="jest" />
import type { CardCompare, CardState } from '../types/GameState';
import { twoOfAKind, threeOfAKind, fourOfAKind, straight, flush } from './handUtils';

// Builds a cardsByValue map — the structure getHandRanking passes into these functions
const buildCardsByValue = (entries: Array<[string, number]>): Map<string, CardCompare> => {
  const suits = ['hearts', 'spades', 'clubs', 'diamonds'] as const;
  const map = new Map<string, CardCompare>();
  entries.forEach(([number, count]) => {
    const cards: CardState[] = Array.from({ length: count }, (_, i) => ({
      number,
      suit: suits[i % 4],
    }));
    map.set(number, { count, cards });
  });
  return map;
};

describe('twoOfAKind', () => {
  it('returns empty array when no pairs exist', () => {
    const map = buildCardsByValue([['ace', 1], ['king', 1]]);
    expect(twoOfAKind(map)).toEqual([]);
  });

  it('returns one group for a single pair', () => {
    const map = buildCardsByValue([['king', 2], ['ace', 1]]);
    expect(twoOfAKind(map)).toEqual([[13, 13]]);
  });

  it('returns two groups for two pairs', () => {
    const map = buildCardsByValue([['king', 2], ['queen', 2]]);
    expect(twoOfAKind(map)).toEqual([[13, 13], [12, 12]]);
  });

  it('does not count three-of-a-kind as a pair', () => {
    const map = buildCardsByValue([['king', 3]]);
    expect(twoOfAKind(map)).toEqual([]);
  });

  it('returns empty array for an empty map', () => {
    expect(twoOfAKind(new Map())).toEqual([]);
  });
});

describe('threeOfAKind', () => {
  it('returns empty array when no three-of-a-kind exists', () => {
    const map = buildCardsByValue([['king', 2]]);
    expect(threeOfAKind(map)).toEqual([]);
  });

  it('returns the three card values', () => {
    const map = buildCardsByValue([['king', 3]]);
    expect(threeOfAKind(map)).toEqual([13, 13, 13]);
  });

  it('does not return pairs', () => {
    const map = buildCardsByValue([['king', 2], ['queen', 2]]);
    expect(threeOfAKind(map)).toEqual([]);
  });

  it('returns empty array for an empty map', () => {
    expect(threeOfAKind(new Map())).toEqual([]);
  });
});

describe('fourOfAKind', () => {
  it('returns empty array when no four-of-a-kind exists', () => {
    const map = buildCardsByValue([['king', 3]]);
    expect(fourOfAKind(map)).toEqual([]);
  });

  it('returns the four card values', () => {
    const map = buildCardsByValue([['king', 4]]);
    expect(fourOfAKind(map)).toEqual([13, 13, 13, 13]);
  });

  it('does not return three-of-a-kind', () => {
    const map = buildCardsByValue([['ace', 3]]);
    expect(fourOfAKind(map)).toEqual([]);
  });

  it('returns empty array for an empty map', () => {
    expect(fourOfAKind(new Map())).toEqual([]);
  });
});

// straight expects cards pre-sorted descending by value, as getHandRanking does
describe('straight', () => {
  it('detects a 5-card straight', () => {
    const cards: CardState[] = [
      { number: '10', suit: 'hearts' },
      { number: '9', suit: 'hearts' },
      { number: '8', suit: 'hearts' },
      { number: '7', suit: 'hearts' },
      { number: '6', suit: 'hearts' },
    ];
    expect(straight(cards)).toEqual([10, 9, 8, 7, 6]);
  });

  it('detects an ace-high straight', () => {
    const cards: CardState[] = [
      { number: 'ace', suit: 'hearts' },
      { number: 'king', suit: 'hearts' },
      { number: 'queen', suit: 'hearts' },
      { number: 'jack', suit: 'hearts' },
      { number: '10', suit: 'hearts' },
    ];
    expect(straight(cards)).toEqual([14, 13, 12, 11, 10]);
  });

  it('returns less than 5 cards when there is a gap', () => {
    const cards: CardState[] = [
      { number: '10', suit: 'hearts' },
      { number: '9', suit: 'hearts' },
      { number: '7', suit: 'hearts' },
      { number: '6', suit: 'hearts' },
      { number: '5', suit: 'hearts' },
    ];
    expect(straight(cards).length).toBeLessThan(5);
  });

  it('returns all consecutive cards when more than 5 are in sequence', () => {
    const cards: CardState[] = [
      { number: '10', suit: 'hearts' },
      { number: '9', suit: 'hearts' },
      { number: '8', suit: 'hearts' },
      { number: '7', suit: 'hearts' },
      { number: '6', suit: 'hearts' },
      { number: '5', suit: 'hearts' },
      { number: '4', suit: 'hearts' },
    ];
    expect(straight(cards)).toEqual([10, 9, 8, 7, 6, 5, 4]);
  });

  it('returns a single-element array for a single card', () => {
    const cards: CardState[] = [{ number: 'ace', suit: 'hearts' }];
    expect(straight(cards)).toEqual([14]);
  });

  it('returns empty array for no cards', () => {
    expect(straight([])).toEqual([]);
  });

  it('detects a straight when lower non-consecutive cards follow it (7-card hand)', () => {
    // Bug: straight resets cardList when the sequence breaks, so [A,K,Q,J,10,3,2]
    // returns [3,2] instead of [14,13,12,11,10]
    const cards: CardState[] = [
      { number: 'ace', suit: 'hearts' },
      { number: 'king', suit: 'spades' },
      { number: 'queen', suit: 'diamonds' },
      { number: 'jack', suit: 'clubs' },
      { number: '10', suit: 'hearts' },
      { number: '3', suit: 'spades' },
      { number: '2', suit: 'diamonds' },
    ];
    expect(straight(cards).length).toBeGreaterThanOrEqual(5);
  });
});

describe('flush', () => {
  it('returns empty array when no suit has 5 or more cards', () => {
    const map = new Map<string, CardCompare>();
    map.set('hearts', {
      count: 4,
      cards: [
        { number: 'ace', suit: 'hearts' },
        { number: 'king', suit: 'hearts' },
        { number: 'queen', suit: 'hearts' },
        { number: 'jack', suit: 'hearts' },
      ],
    });
    expect(flush(map)).toEqual([]);
  });

  it('returns card values when a suit has exactly 5 cards', () => {
    const map = new Map<string, CardCompare>();
    map.set('hearts', {
      count: 5,
      cards: [
        { number: 'ace', suit: 'hearts' },
        { number: 'king', suit: 'hearts' },
        { number: 'queen', suit: 'hearts' },
        { number: 'jack', suit: 'hearts' },
        { number: '10', suit: 'hearts' },
      ],
    });
    expect(flush(map)).toEqual([14, 13, 12, 11, 10]);
  });

  it('returns all cards when a suit has 6 cards', () => {
    const map = new Map<string, CardCompare>();
    map.set('spades', {
      count: 6,
      cards: [
        { number: 'ace', suit: 'spades' },
        { number: 'king', suit: 'spades' },
        { number: 'queen', suit: 'spades' },
        { number: 'jack', suit: 'spades' },
        { number: '10', suit: 'spades' },
        { number: '9', suit: 'spades' },
      ],
    });
    expect(flush(map)).toHaveLength(6);
  });

  it('returns empty array for an empty map', () => {
    expect(flush(new Map())).toEqual([]);
  });
});
