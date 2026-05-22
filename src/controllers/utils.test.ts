/// <reference types="jest" />
import type { CardState, PlayerState, GameState } from '../types/GameState';
import {
  getNextActiveIndex,
  createDeck,
  shuffleDeck,
  howManyActivePlayers,
  drawCard,
  getLeftOfDealer,
  getHandRanking,
  getValue,
  contestHands,
  copyPlayers,
} from './utils';

const makePlayer = (id: string, status: PlayerState['status'] = 'active', hand: CardState[] = []): PlayerState => ({
  id,
  name: `Player ${id}`,
  hand,
  chips: 100,
  currentBet: 0,
  status,
});

const makeGame = (players: PlayerState[], dealerIndex = 0): GameState => ({
  players,
  deck: [],
  tableCards: [],
  pot: 0,
  currentBet: 0,
  smallBlind: 2,
  bigBlind: 4,
  dealerIndex,
  currentPlayerIndex: 0,
  lastRaisePlayerIndex: 0,
  phase: 'preflop',
  winners: [],
  error: '',
});

describe('getValue', () => {
  it('returns the numeric value for number cards', () => {
    expect(getValue('2')).toBe(2);
    expect(getValue('5')).toBe(5);
    expect(getValue('10')).toBe(10);
  });

  it('returns 11 for jack', () => {
    expect(getValue('jack')).toBe(11);
  });

  it('returns 12 for queen', () => {
    expect(getValue('queen')).toBe(12);
  });

  it('returns 13 for king', () => {
    expect(getValue('king')).toBe(13);
  });

  it('returns 14 for ace', () => {
    expect(getValue('ace')).toBe(14);
  });

  it('returns 0 for an unrecognized string', () => {
    expect(getValue('joker')).toBe(0);
  });
});

describe('createDeck', () => {
  it('returns 52 cards', () => {
    expect(createDeck()).toHaveLength(52);
  });

  it('has 13 cards per suit', () => {
    const deck = createDeck();
    ['hearts', 'spades', 'diamonds', 'clubs'].forEach(suit => {
      expect(deck.filter(c => c.suit === suit)).toHaveLength(13);
    });
  });

  it('has no duplicate cards', () => {
    const deck = createDeck();
    const ids = deck.map(c => `${c.suit}-${c.number}`);
    expect(new Set(ids).size).toBe(52);
  });

  it('includes ace through 10, jack, queen, king for each suit', () => {
    const deck = createDeck();
    const spades = deck.filter(c => c.suit === 'spades').map(c => c.number);
    expect(spades).toContain('ace');
    expect(spades).toContain('king');
    expect(spades).toContain('jack');
    expect(spades).toContain('2');
    expect(spades).toContain('10');
  });
});

describe('shuffleDeck', () => {
  it('returns the same array reference (mutates in place)', () => {
    const deck = createDeck();
    expect(shuffleDeck(deck)).toBe(deck);
  });

  it('keeps the same number of cards', () => {
    const deck = createDeck();
    shuffleDeck(deck);
    expect(deck).toHaveLength(52);
  });

  it('contains the same cards after shuffling', () => {
    const deck = createDeck();
    const sortKey = (c: CardState) => `${c.suit}-${c.number}`;
    const before = [...deck].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    shuffleDeck(deck);
    const after = [...deck].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    expect(after).toEqual(before);
  });
});

describe('howManyActivePlayers', () => {
  it('counts all players when all are active', () => {
    const players = [makePlayer('1'), makePlayer('2'), makePlayer('3')];
    expect(howManyActivePlayers(players)).toBe(3);
  });

  it('includes folded players in the count', () => {
    const players = [makePlayer('1'), makePlayer('2', 'folded'), makePlayer('3')];
    expect(howManyActivePlayers(players)).toBe(3);
  });

  it('excludes busted players from the count', () => {
    const players = [makePlayer('1'), makePlayer('2', 'busted'), makePlayer('3')];
    expect(howManyActivePlayers(players)).toBe(2);
  });

  it('returns 0 when all players are busted', () => {
    const players = [makePlayer('1', 'busted'), makePlayer('2', 'busted')];
    expect(howManyActivePlayers(players)).toBe(0);
  });
});

describe('getNextActiveIndex', () => {
  it('returns the immediately next index when that player is active', () => {
    const players = [makePlayer('1'), makePlayer('2'), makePlayer('3')];
    expect(getNextActiveIndex(players, 0)).toBe(1);
  });

  it('skips a folded player', () => {
    const players = [makePlayer('1'), makePlayer('2', 'folded'), makePlayer('3')];
    expect(getNextActiveIndex(players, 0)).toBe(2);
  });

  it('skips a busted player', () => {
    const players = [makePlayer('1'), makePlayer('2', 'busted'), makePlayer('3')];
    expect(getNextActiveIndex(players, 0)).toBe(2);
  });

  it('wraps around to the beginning', () => {
    const players = [makePlayer('1'), makePlayer('2'), makePlayer('3')];
    expect(getNextActiveIndex(players, 2)).toBe(0);
  });

  it('skips multiple inactive players', () => {
    const players = [
      makePlayer('1'),
      makePlayer('2', 'busted'),
      makePlayer('3', 'folded'),
      makePlayer('4'),
    ];
    expect(getNextActiveIndex(players, 0)).toBe(3);
  });
});

describe('drawCard', () => {
  it('returns the last card in the deck', () => {
    const deck: CardState[] = [
      { number: '2', suit: 'hearts' },
      { number: 'ace', suit: 'spades' },
    ];
    expect(drawCard(deck)).toEqual({ number: 'ace', suit: 'spades' });
  });

  it('removes the drawn card from the deck', () => {
    const deck: CardState[] = [
      { number: '2', suit: 'hearts' },
      { number: 'ace', suit: 'spades' },
    ];
    drawCard(deck);
    expect(deck).toHaveLength(1);
    expect(deck[0]).toEqual({ number: '2', suit: 'hearts' });
  });
});

describe('getLeftOfDealer', () => {
  it('points to the first active player after the dealer', () => {
    const game = makeGame([makePlayer('1'), makePlayer('2'), makePlayer('3')], 0);
    expect(getLeftOfDealer(game).currentPlayerIndex).toBe(1);
  });

  it('currentPlayerIndex and lastRaisePlayerIndex are always equal', () => {
    const game = makeGame([makePlayer('1'), makePlayer('2'), makePlayer('3')], 0);
    const result = getLeftOfDealer(game);
    expect(result.currentPlayerIndex).toBe(result.lastRaisePlayerIndex);
  });

  it('skips a busted player directly after the dealer', () => {
    const game = makeGame([makePlayer('1'), makePlayer('2', 'busted'), makePlayer('3')], 0);
    expect(getLeftOfDealer(game).currentPlayerIndex).toBe(2);
  });

  it('respects dealerIndex when it is not 0', () => {
    const game = makeGame([makePlayer('1'), makePlayer('2'), makePlayer('3')], 1);
    expect(getLeftOfDealer(game).currentPlayerIndex).toBe(2);
  });
});

describe('copyPlayers', () => {
  it('returns a new array (different reference)', () => {
    const players = [makePlayer('1')];
    expect(copyPlayers(players)).not.toBe(players);
  });

  it('each player object is a new reference', () => {
    const players = [makePlayer('1'), makePlayer('2')];
    const copy = copyPlayers(players);
    copy.forEach((p, i) => expect(p).not.toBe(players[i]));
  });

  it('each player hand array is a new reference', () => {
    const hand: CardState[] = [{ number: 'ace', suit: 'hearts' }];
    const players = [makePlayer('1', 'active', hand)];
    const copy = copyPlayers(players);
    expect(copy[0].hand).not.toBe(players[0].hand);
  });

  it('preserves all player field values', () => {
    const players = [makePlayer('1', 'active', [{ number: 'king', suit: 'spades' }])];
    const copy = copyPlayers(players);
    expect(copy[0].id).toBe('1');
    expect(copy[0].chips).toBe(100);
    expect(copy[0].status).toBe('active');
    expect(copy[0].hand[0]).toEqual({ number: 'king', suit: 'spades' });
  });

  it('mutating a copied player does not affect the original', () => {
    const players = [makePlayer('1')];
    const copy = copyPlayers(players);
    copy[0].chips = 999;
    expect(players[0].chips).toBe(100);
  });

  it('mutating a copied player hand does not affect the original', () => {
    const players = [makePlayer('1', 'active', [{ number: 'ace', suit: 'hearts' }])];
    const copy = copyPlayers(players);
    copy[0].hand.push({ number: 'king', suit: 'spades' });
    expect(players[0].hand).toHaveLength(1);
  });
});

// NOTE: getHandRanking uses `straight` from handUtils which returns the *last*
// consecutive run, not the longest. Tests here use exactly 5-card hands (2 hole +
// 3 table) to avoid cases where lower non-straight cards follow a valid straight
// and reset the sequence. 7-card straight detection will need a fix to `straight` first.
describe('getHandRanking', () => {
  const makeHandPlayer = (hand: CardState[]) => makePlayer('1', 'active', hand);

  it('detects high card', () => {
    const player = makeHandPlayer([{ number: 'ace', suit: 'hearts' }, { number: 'king', suit: 'spades' }]);
    const tableCards: CardState[] = [
      { number: 'queen', suit: 'diamonds' },
      { number: 'jack', suit: 'clubs' },
      { number: '9', suit: 'hearts' },
    ];
    expect(getHandRanking(player, tableCards).highestHand).toBe('highCard');
  });

  it('detects a pair', () => {
    const player = makeHandPlayer([{ number: 'ace', suit: 'hearts' }, { number: 'ace', suit: 'spades' }]);
    const tableCards: CardState[] = [
      { number: 'king', suit: 'diamonds' },
      { number: 'queen', suit: 'clubs' },
      { number: 'jack', suit: 'hearts' },
    ];
    expect(getHandRanking(player, tableCards).highestHand).toBe('pair');
  });

  it('detects two pair', () => {
    const player = makeHandPlayer([{ number: 'ace', suit: 'hearts' }, { number: 'king', suit: 'spades' }]);
    const tableCards: CardState[] = [
      { number: 'ace', suit: 'diamonds' },
      { number: 'king', suit: 'clubs' },
      { number: 'jack', suit: 'hearts' },
    ];
    expect(getHandRanking(player, tableCards).highestHand).toBe('twoPair');
  });

  it('detects three of a kind', () => {
    const player = makeHandPlayer([{ number: 'ace', suit: 'hearts' }, { number: 'ace', suit: 'spades' }]);
    const tableCards: CardState[] = [
      { number: 'ace', suit: 'diamonds' },
      { number: 'king', suit: 'clubs' },
      { number: 'queen', suit: 'hearts' },
    ];
    expect(getHandRanking(player, tableCards).highestHand).toBe('threeOfAKind');
  });

  it('detects a straight', () => {
    const player = makeHandPlayer([{ number: '10', suit: 'hearts' }, { number: '9', suit: 'spades' }]);
    const tableCards: CardState[] = [
      { number: '8', suit: 'diamonds' },
      { number: '7', suit: 'clubs' },
      { number: '6', suit: 'hearts' },
    ];
    expect(getHandRanking(player, tableCards).highestHand).toBe('straight');
  });

  it('detects a flush (non-sequential same suit)', () => {
    const player = makeHandPlayer([{ number: 'ace', suit: 'hearts' }, { number: 'king', suit: 'hearts' }]);
    const tableCards: CardState[] = [
      { number: 'queen', suit: 'hearts' },
      { number: 'jack', suit: 'hearts' },
      { number: '9', suit: 'hearts' },
    ];
    expect(getHandRanking(player, tableCards).highestHand).toBe('flush');
  });

  it('detects a full house', () => {
    const player = makeHandPlayer([{ number: 'ace', suit: 'hearts' }, { number: 'ace', suit: 'spades' }]);
    const tableCards: CardState[] = [
      { number: 'ace', suit: 'diamonds' },
      { number: 'king', suit: 'clubs' },
      { number: 'king', suit: 'hearts' },
    ];
    expect(getHandRanking(player, tableCards).highestHand).toBe('fullHouse');
  });

  it('detects four of a kind', () => {
    const player = makeHandPlayer([{ number: 'ace', suit: 'hearts' }, { number: 'ace', suit: 'spades' }]);
    const tableCards: CardState[] = [
      { number: 'ace', suit: 'diamonds' },
      { number: 'ace', suit: 'clubs' },
      { number: 'king', suit: 'hearts' },
    ];
    expect(getHandRanking(player, tableCards).highestHand).toBe('fourOfAKind');
  });

  it('detects a straight flush', () => {
    const player = makeHandPlayer([{ number: '10', suit: 'hearts' }, { number: '9', suit: 'hearts' }]);
    const tableCards: CardState[] = [
      { number: '8', suit: 'hearts' },
      { number: '7', suit: 'hearts' },
      { number: '6', suit: 'hearts' },
    ];
    expect(getHandRanking(player, tableCards).highestHand).toBe('straightFlush');
  });

  it('detects a royal flush', () => {
    const player = makeHandPlayer([{ number: 'ace', suit: 'hearts' }, { number: 'king', suit: 'hearts' }]);
    const tableCards: CardState[] = [
      { number: 'queen', suit: 'hearts' },
      { number: 'jack', suit: 'hearts' },
      { number: '10', suit: 'hearts' },
    ];
    expect(getHandRanking(player, tableCards).highestHand).toBe('royalFlush');
  });

  it('returns the original player object on the result', () => {
    const player = makeHandPlayer([{ number: 'ace', suit: 'hearts' }, { number: 'king', suit: 'spades' }]);
    expect(getHandRanking(player, []).player).toBe(player);
  });

  it('allCards contains the combined hole cards and table cards', () => {
    const player = makeHandPlayer([{ number: 'ace', suit: 'hearts' }, { number: 'king', suit: 'spades' }]);
    const tableCards: CardState[] = [
      { number: 'queen', suit: 'diamonds' },
      { number: 'jack', suit: 'clubs' },
      { number: '9', suit: 'hearts' },
    ];
    expect(getHandRanking(player, tableCards).allCards).toHaveLength(5);
  });
});

describe('contestHands', () => {
  const makeHandRanking = (player: PlayerState, highestHand: string, relevantCardValues: number[]) => ({
    highestHand,
    player,
    allCards: [] as CardState[],
    relevantCardValues,
  });

  it('returns the single player when only one hand is passed', () => {
    const playerA = makePlayer('A');
    const result = contestHands([makeHandRanking(playerA, 'flush', [14, 12, 10, 8, 6])]);
    expect(result).toEqual([playerA]);
  });

  it('returns tied players as a nested array', () => {
    const playerA = makePlayer('A');
    const playerB = makePlayer('B');
    const hands = [
      makeHandRanking(playerA, 'pair', [14, 14, 12, 11, 10]),
      makeHandRanking(playerB, 'pair', [14, 14, 12, 11, 10]),
    ];
    const result = contestHands(hands);
    expect(Array.isArray(result[0])).toBe(true);
    expect(result[0]).toContain(playerA);
    expect(result[0]).toContain(playerB);
  });

  it('puts the winner first and loser second in a two-player non-tie', () => {
    const playerA = makePlayer('A');
    const playerB = makePlayer('B');
    // input sorted best-hand-first, as updateRoundState does before calling contestHands
    const hands = [
      makeHandRanking(playerA, 'flush', [14, 12, 10, 8, 6]),
      makeHandRanking(playerB, 'pair', [13, 13, 12, 11, 10]),
    ];
    const result = contestHands(hands);
    console.log('🚀 ~ result:', result);
    expect(result[0]).toBe(playerA);
    expect(result[1]).toBe(playerB);
  });

  it('correctly orders three players with different hands', () => {
    const playerA = makePlayer('A');
    const playerB = makePlayer('B');
    const playerC = makePlayer('C');
    const hands = [
      makeHandRanking(playerA, 'flush', [14, 12, 10, 8, 6]),
      makeHandRanking(playerB, 'pair', [13, 13, 12, 11, 10]),
      makeHandRanking(playerC, 'highCard', [14, 12, 10, 8, 6]),
    ];
    const result = contestHands(hands);
    expect(result[0]).toBe(playerA);
    expect(result[1]).toBe(playerB);
    expect(result[2]).toBe(playerC);
  });

  it('sorts within the same hand type by card values, best first', () => {
    const playerA = makePlayer('A');
    const playerB = makePlayer('B');
    // passed in "wrong" order — contestHands should sort within the group
    const hands = [
      makeHandRanking(playerB, 'pair', [13, 13, 12, 11, 10]),
      makeHandRanking(playerA, 'pair', [14, 14, 12, 11, 10]),
    ];
    const result = contestHands(hands);
    expect(result[0]).toBe(playerA);
    expect(result[1]).toBe(playerB);
  });
});
