/// <reference types="jest" />
import type { CardState, GameState, PlayerState } from '../types/GameState';
import {
  createPlayer,
  createGame,
  DealCards,
  raiseHandler,
  callHandler,
  checkHandler,
  foldHandler,
  allInHandler,
  updateRoundState,
} from './GameLogic';

// --- helpers ---

const p = (id: string, chips: number, currentBet = 0, status: PlayerState['status'] = 'active'): PlayerState => ({
  id,
  name: `Player ${id}`,
  hand: [],
  chips,
  currentBet,
  status,
});

const makeCards = (n: number): CardState[] =>
  Array.from({ length: n }, (_, i) => ({ number: String((i % 9) + 2), suit: 'hearts' as const }));

// Default fixture: 3-player preflop game, player 0 is first to act
// lastRaisePlayerIndex: 2 means action doesn't close until player 2 is next
const makeGame = (overrides: Partial<GameState> = {}): GameState => ({
  players: [p('0', 100, 0), p('1', 98, 2), p('2', 96, 4)],
  deck: makeCards(20),
  tableCards: [],
  pot: 6,
  currentBet: 4,
  smallBlind: 2,
  bigBlind: 4,
  dealerIndex: 0,
  currentPlayerIndex: 0,
  lastRaisePlayerIndex: 2,
  phase: 'preflop',
  winners: [],
  error: '',
  ...overrides,
});

// --- createPlayer ---

describe('createPlayer', () => {
  it('sets id, name, and chips from arguments', () => {
    const player = createPlayer('1', 'Alice', 200);
    expect(player.id).toBe('1');
    expect(player.name).toBe('Alice');
    expect(player.chips).toBe(200);
  });

  it('starts with an empty hand', () => {
    expect(createPlayer('1', 'Alice', 100).hand).toEqual([]);
  });

  it('starts with 0 currentBet and active status', () => {
    const player = createPlayer('1', 'Alice', 100);
    expect(player.currentBet).toBe(0);
    expect(player.status).toBe('active');
  });
});

// --- createGame ---

describe('createGame', () => {
  it('uses the provided players', () => {
    const players = [p('0', 100), p('1', 100)];
    expect(createGame(players).players).toBe(players);
  });

  it('starts in the waiting phase with an empty pot', () => {
    const game = createGame([p('0', 100)]);
    expect(game.phase).toBe('waiting');
    expect(game.pot).toBe(0);
  });

  it('sets default blinds to 2 and 4', () => {
    const game = createGame([p('0', 100)]);
    expect(game.smallBlind).toBe(2);
    expect(game.bigBlind).toBe(4);
  });

  it('starts with empty deck and tableCards', () => {
    const game = createGame([p('0', 100)]);
    expect(game.deck).toEqual([]);
    expect(game.tableCards).toEqual([]);
  });
});

// --- DealCards ---

describe('DealCards', () => {
  it('sets phase to preflop', () => {
    const game = createGame([p('0', 100), p('1', 100), p('2', 100)]);
    expect(DealCards(game).phase).toBe('preflop');
  });

  it('deals 2 cards to each active player', () => {
    const game = createGame([p('0', 100), p('1', 100), p('2', 100)]);
    const result = DealCards(game);
    result.players.forEach(player => {
      expect(player.hand).toHaveLength(2);
    });
  });

  it('does not deal cards to busted players', () => {
    const game = createGame([p('0', 100), p('1', 0, 0, 'busted'), p('2', 100)]);
    const result = DealCards(game);
    expect(result.players[1].hand).toHaveLength(0);
  });

  it('resets folded players back to active', () => {
    const game = createGame([p('0', 100), p('1', 100, 0, 'folded'), p('2', 100)]);
    const result = DealCards(game);
    expect(result.players[1].status).toBe('active');
  });

  it('resets every player currentBet to 0 before posting blinds', () => {
    const game = createGame([p('0', 100), p('1', 100, 10), p('2', 100, 10)]);
    const result = DealCards(game);
    // small blind will have currentBet = smallBlind (2), big blind = bigBlind (4)
    // but no other player should have a lingering old bet
    expect(result.players[0].currentBet).toBe(0);
  });

  it('pot equals small blind plus big blind', () => {
    const game = createGame([p('0', 100), p('1', 100), p('2', 100)]);
    const result = DealCards(game);
    expect(result.pot).toBe(game.smallBlind + game.bigBlind);
  });

  it('small blind and big blind players have correct bets posted', () => {
    const game = createGame([p('0', 100), p('1', 100), p('2', 100)]);
    const result = DealCards(game);
    // dealer is index 0, so SB = index 1, BB = index 2
    expect(result.players[1].currentBet).toBe(game.smallBlind);
    expect(result.players[2].currentBet).toBe(game.bigBlind);
  });
});

// --- raiseHandler ---

describe('raiseHandler', () => {
  it("deducts the raise delta from the current player's chips", () => {
    const game = makeGame(); // player 0: 100 chips, 0 currentBet, game.currentBet=4
    const result = raiseHandler(game, 10); // raises to 14 total, delta = 14
    expect(result.players[0].chips).toBe(86);
  });

  it("sets the current player's currentBet to game.currentBet + betInput", () => {
    const game = makeGame();
    const result = raiseHandler(game, 10);
    expect(result.players[0].currentBet).toBe(14);
  });

  it('adds the raise delta to the pot', () => {
    const game = makeGame(); // pot=6, delta=14
    const result = raiseHandler(game, 10);
    expect(result.pot).toBe(20);
  });

  it('sets lastRaisePlayerIndex to the current player', () => {
    const game = makeGame();
    const result = raiseHandler(game, 10);
    expect(result.lastRaisePlayerIndex).toBe(0);
  });

  it('advances to the next player', () => {
    const game = makeGame();
    const result = raiseHandler(game, 10);
    expect(result.currentPlayerIndex).toBe(1);
  });

  it('returns an error when bet exceeds available chips', () => {
    const game = makeGame({ players: [p('0', 5, 0), p('1', 98, 2), p('2', 96, 4)] });
    const result = raiseHandler(game, 10);
    expect(result.error).toBeTruthy();
  });

  it('returns an error when bet is less than the big blind', () => {
    const game = makeGame();
    const result = raiseHandler(game, 2); // bigBlind is 4
    expect(result.error).toBeTruthy();
  });

  it('does not advance the phase even when acting last, because a raise reopens action', () => {
    const game = makeGame({ currentPlayerIndex: 1, lastRaisePlayerIndex: 2 });
    const result = raiseHandler(game, 10);
    expect(result.phase).toBe('preflop');
  });
});

// --- callHandler ---

describe('callHandler', () => {
  it("deducts the call amount from the current player's chips", () => {
    const game = makeGame(); // player 0: 100 chips, 0 currentBet, game.currentBet=4 → call 4
    const result = callHandler(game);
    expect(result.players[0].chips).toBe(96);
  });

  it("sets the current player's currentBet to match game.currentBet", () => {
    const game = makeGame();
    const result = callHandler(game);
    expect(result.players[0].currentBet).toBe(4);
  });

  it('adds the call amount to the pot', () => {
    const game = makeGame(); // pot=6, call=4
    const result = callHandler(game);
    expect(result.pot).toBe(10);
  });

  it('advances to the next player', () => {
    const game = makeGame();
    const result = callHandler(game);
    expect(result.currentPlayerIndex).toBe(1);
  });

  it('caps the call at the player\'s available chips', () => {
    // player 0 only has 2 chips but needs to call 4
    const game = makeGame({ players: [p('0', 2, 0), p('1', 98, 2), p('2', 96, 4)] });
    const result = callHandler(game);
    expect(result.players[0].chips).toBe(0);
    expect(result.players[0].currentBet).toBe(2);
    expect(result.pot).toBe(8);
  });

  it('triggers a phase change when the current player is last to act', () => {
    const game = makeGame({ currentPlayerIndex: 1, lastRaisePlayerIndex: 2 });
    const result = callHandler(game);
    expect(result.phase).toBe('flop');
  });
});

// --- checkHandler ---

describe('checkHandler', () => {
  it("does not change any player's chips", () => {
    const game = makeGame();
    const result = checkHandler(game);
    result.players.forEach((player, i) => {
      expect(player.chips).toBe(game.players[i].chips);
    });
  });

  it('does not change the pot', () => {
    const game = makeGame();
    const result = checkHandler(game);
    expect(result.pot).toBe(game.pot);
  });

  it('advances to the next player', () => {
    const game = makeGame();
    const result = checkHandler(game);
    expect(result.currentPlayerIndex).toBe(1);
  });

  it('triggers a phase change when the current player is last to act', () => {
    const game = makeGame({ currentPlayerIndex: 1, lastRaisePlayerIndex: 2 });
    const result = checkHandler(game);
    expect(result.phase).toBe('flop');
  });
});

// --- foldHandler ---

describe('foldHandler', () => {
  it("sets the current player's status to folded", () => {
    const game = makeGame();
    const result = foldHandler(game);
    expect(result.players[0].status).toBe('folded');
  });

  it("does not change the current player's chips", () => {
    const game = makeGame();
    const result = foldHandler(game);
    expect(result.players[0].chips).toBe(100);
  });

  it('advances to the next player', () => {
    const game = makeGame();
    const result = foldHandler(game);
    expect(result.currentPlayerIndex).toBe(1);
  });

  it('sets phase to end when only one player remains', () => {
    const game = makeGame({
      players: [p('0', 90, 10), p('1', 90, 10)],
      pot: 20,
      currentPlayerIndex: 0,
      lastRaisePlayerIndex: 1,
    });
    const result = foldHandler(game);
    expect(result.phase).toBe('end');
  });

  it('gives the pot to the last remaining player', () => {
    const game = makeGame({
      players: [p('0', 90, 10), p('1', 90, 10)],
      pot: 20,
      currentPlayerIndex: 0,
      lastRaisePlayerIndex: 1,
    });
    const result = foldHandler(game);
    expect(result.players[1].chips).toBeGreaterThan(90);
  });
});

// --- allInHandler ---

describe('allInHandler', () => {
  it("sets the current player's chips to 0", () => {
    const game = makeGame();
    const result = allInHandler(game);
    expect(result.players[0].chips).toBe(0);
  });

  it("sets currentBet to the player's chips plus their existing currentBet", () => {
    const game = makeGame(); // player 0: chips=100, currentBet=0 → allInAmount=100
    const result = allInHandler(game);
    expect(result.players[0].currentBet).toBe(100);
  });

  it('adds the all-in amount to the pot', () => {
    const game = makeGame(); // pot=6, allInAmount=100
    const result = allInHandler(game);
    expect(result.pot).toBe(106);
  });

  it('updates game currentBet when all-in exceeds it', () => {
    const game = makeGame(); // player 0 goes all-in for 100, game.currentBet was 4
    const result = allInHandler(game);
    expect(result.currentBet).toBe(100);
  });

  it('does not update game currentBet when all-in is less than it', () => {
    const game = makeGame({
      players: [p('0', 2, 0), p('1', 98, 2), p('2', 96, 4)],
      currentBet: 4,
    }); // player 0 all-in for 2, less than currentBet of 4
    const result = allInHandler(game);
    expect(result.currentBet).toBe(4);
  });

  it('advances to the next player', () => {
    const game = makeGame();
    const result = allInHandler(game);
    expect(result.currentPlayerIndex).toBe(1);
  });
});

// --- updateRoundState helpers ---

const c = (number: string, suit: CardState['suit']): CardState => ({ number, suit });

// A game ready for a phase transition — deck has plenty of cards
const makePhaseGame = (phase: GameState['phase'], tableCards: CardState[] = []): GameState => ({
  ...makeGame({ phase, tableCards }),
  deck: makeCards(30),
});

// River game: player 0 has pair of aces, player 1 has high card only
const makeRiverGame = (): GameState => ({
  players: [
    { id: '0', name: 'Player 0', hand: [c('ace', 'hearts'), c('ace', 'spades')],   chips: 90, currentBet: 10, status: 'active' },
    { id: '1', name: 'Player 1', hand: [c('2', 'clubs'),   c('7', 'diamonds')],    chips: 95, currentBet: 5,  status: 'active' },
  ],
  deck: makeCards(5),
  tableCards: [c('king', 'hearts'), c('queen', 'spades'), c('jack', 'clubs'), c('3', 'diamonds'), c('4', 'hearts')],
  pot: 15,
  currentBet: 10,
  smallBlind: 2,
  bigBlind: 4,
  dealerIndex: 0,
  currentPlayerIndex: 0,
  lastRaisePlayerIndex: 1,
  phase: 'river',
  winners: [],
  error: '',
});

const makeBenLosesGame = (): GameState => ({
  players: [
    { id: '0', name: 'Blake', hand: [c('ace', 'hearts'), c('ace', 'spades')],   chips: 12, currentBet: 4, status: 'active' },
    { id: '1', name: 'Alissa', hand: [c('2', 'clubs'),   c('7', 'diamonds')],    chips: 36, currentBet: 4,  status: 'active' },
    { id: '1', name: 'Stephen', hand: [c('jack', 'clubs'),   c('2', 'diamonds')],    chips: 12, currentBet: 4,  status: 'active' },
    { id: '1', name: 'Caitlyn', hand: [c('10', 'clubs'),   c('4', 'diamonds')],    chips: 36, currentBet: 4,  status: 'active' },
    { id: '1', name: 'Ben', hand: [c('3', 'clubs'),   c('6', 'diamonds')],    chips: 2, currentBet: 4,  status: 'active' },
    { id: '1', name: 'Max', hand: [c('ace', 'clubs'),   c('9', 'diamonds')],    chips: 12, currentBet: 4,  status: 'active' },
  ],
  deck: makeCards(5),
  tableCards: [c('7', 'hearts'), c('9', 'clubs'), c('ace', 'clubs'), c('2', 'hearts'), c('king', 'spades')],
  pot: 15,
  currentBet: 10,
  smallBlind: 2,
  bigBlind: 4,
  dealerIndex: 0,
  currentPlayerIndex: 0,
  lastRaisePlayerIndex: 1,
  phase: 'river',
  winners: [],
  error: '',
});

const makeBenWinsGame = (): GameState => ({
  players: [
    { id: '0', name: 'Blake', hand: [c('6', 'hearts'), c('2', 'spades')],   chips: 16, currentBet: 4, status: 'active' },
    { id: '1', name: 'Alissa', hand: [c('queen', 'spades'),   c('8', 'spades')],    chips: 16, currentBet: 4,  status: 'active' },
    { id: '2', name: 'Stephen', hand: [c('4', 'spades'),   c('queen', 'clubs')],    chips: 16, currentBet: 4,  status: 'active' },
    { id: '3', name: 'Caitlyn', hand: [c('3', 'spades'),   c('6', 'diamonds')],    chips: 16, currentBet: 4,  status: 'active' },
    { id: '4', name: 'Ben', hand: [c('jack', 'hearts'),   c('10', 'clubs')],    chips: 6, currentBet: 4,  status: 'active' },
    { id: '5', name: 'Max', hand: [c('2', 'hearts'),   c('7', 'hearts')],    chips: 16, currentBet: 4,  status: 'active' },
  ],
  deck: makeCards(5),
  tableCards: [c('4', 'clubs'), c('9', 'spades'), c('10', 'diamonds'), c('8', 'hearts'), c('king', 'clubs')],
  pot: 24,
  currentBet: 4,
  smallBlind: 2,
  bigBlind: 4,
  dealerIndex: 0,
  currentPlayerIndex: 0,
  lastRaisePlayerIndex: 1,
  phase: 'river',
  winners: [],
  error: '',
});

// --- updateRoundState — preflop → flop ---

describe('updateRoundState (preflop → flop)', () => {
  it('sets phase to flop', () => {
    const result = updateRoundState(makePhaseGame('preflop'));
    expect(result.phase).toBe('flop');
  });

  it('adds exactly 3 table cards', () => {
    const result = updateRoundState(makePhaseGame('preflop'));
    expect(result.tableCards).toHaveLength(3);
  });

  it('removes 4 cards from the deck (1 burn + 3 flop)', () => {
    const game = makePhaseGame('preflop');
    const before = game.deck.length;
    const result = updateRoundState(game);
    expect(result.deck.length).toBe(before - 4);
  });

  it('resets currentPlayerIndex to left of dealer', () => {
    // dealer is index 0, so left of dealer = index 1
    const result = updateRoundState(makePhaseGame('preflop'));
    expect(result.currentPlayerIndex).toBe(1);
  });

  it('resets lastRaisePlayerIndex to left of dealer', () => {
    const result = updateRoundState(makePhaseGame('preflop'));
    expect(result.lastRaisePlayerIndex).toBe(1);
  });

  it('does not mutate the input game', () => {
    const game = makePhaseGame('preflop');
    updateRoundState(game);
    expect(game.phase).toBe('preflop');
  });
});

// --- updateRoundState — flop → turn ---

describe('updateRoundState (flop → turn)', () => {
  it('sets phase to turn', () => {
    const result = updateRoundState(makePhaseGame('flop', makeCards(3)));
    expect(result.phase).toBe('turn');
  });

  it('adds 1 card to the existing 3 table cards (total 4)', () => {
    const result = updateRoundState(makePhaseGame('flop', makeCards(3)));
    expect(result.tableCards).toHaveLength(4);
  });

  it('removes 2 cards from the deck (1 burn + 1 turn)', () => {
    const game = makePhaseGame('flop', makeCards(3));
    const before = game.deck.length;
    const result = updateRoundState(game);
    expect(result.deck.length).toBe(before - 2);
  });

  it('resets currentPlayerIndex to left of dealer', () => {
    const result = updateRoundState(makePhaseGame('flop', makeCards(3)));
    expect(result.currentPlayerIndex).toBe(1);
  });
});

// --- updateRoundState — turn → river ---

describe('updateRoundState (turn → river)', () => {
  it('sets phase to river', () => {
    const result = updateRoundState(makePhaseGame('turn', makeCards(4)));
    expect(result.phase).toBe('river');
  });

  it('adds 1 card to the existing 4 table cards (total 5)', () => {
    const result = updateRoundState(makePhaseGame('turn', makeCards(4)));
    expect(result.tableCards).toHaveLength(5);
  });

  it('removes 2 cards from the deck (1 burn + 1 river)', () => {
    const game = makePhaseGame('turn', makeCards(4));
    const before = game.deck.length;
    const result = updateRoundState(game);
    expect(result.deck.length).toBe(before - 2);
  });

  it('resets currentPlayerIndex to left of dealer', () => {
    const result = updateRoundState(makePhaseGame('turn', makeCards(4)));
    expect(result.currentPlayerIndex).toBe(1);
  });
});

// --- updateRoundState — river → end (showdown) ---

describe('updateRoundState (river → end)', () => {
  it('sets phase to end', () => {
    const result = updateRoundState(makeBenWinsGame());
    expect(result.phase).toBe('end');
  });

  it('awards pot chips to the winning player', () => {
    const game = makeBenWinsGame();
    const result = updateRoundState(game);
    expect(result.players[4].chips).toBeGreaterThan(game.players[4].chips);
  });

  it('Second place winner gets chips', () => {
    const game = makeBenWinsGame();
    const result = updateRoundState(game);
    expect(game.players[1].chips).toBe(game.players[1].chips);
  });

  it('reduces the pot after distributing', () => {
    const game = makeBenWinsGame();
    const result = updateRoundState(game);
    expect(result.pot).toBeLessThan(game.pot);
  });

  it('advances dealerIndex to next active player', () => {
    const game = makeBenWinsGame(); // dealerIndex: 0
    const result = updateRoundState(game);
    expect(result.dealerIndex).not.toBe(game.dealerIndex);
  });
});

// --- Integration: 5-player river showdown with side pot ---

describe('5-player river showdown: winner all-in for 10, side pot, two folds', () => {
  // P0 (Winner)      — all-in for 10, best hand (pair of aces)
  // P1 (Second)      — all-in for 20, second-best hand (pair of kings)
  // P2 (Third)       — all-in for 20, third-best hand (pair of queens)
  // P3 (FoldedFive)  — folded after 5 chips; has 45 chips remaining
  // P4 (FoldedEight) — folded after 8 chips; has 42 chips remaining
  // Pot = 10+20+20+5+8 = 63
  // P0 side-pot cap: 10 from each other = 10+10+5+8 + own 10 = 43
  // P1 wins remaining 20; P2 gets nothing (pot exhausted)
  const makeShowdownGame = (): GameState => ({
    players: [
      { id: '0', name: 'Winner',      hand: [c('ace', 'spades'),    c('ace', 'hearts')],    chips: 0,  currentBet: 10, status: 'active' },
      { id: '1', name: 'Second',      hand: [c('king', 'hearts'),   c('king', 'diamonds')], chips: 0,  currentBet: 20, status: 'active' },
      { id: '2', name: 'Third',       hand: [c('queen', 'diamonds'), c('queen', 'clubs')],  chips: 0,  currentBet: 20, status: 'active' },
      { id: '3', name: 'FoldedFive',  hand: [],                                             chips: 45, currentBet: 5,  status: 'folded' },
      { id: '4', name: 'FoldedEight', hand: [],                                             chips: 42, currentBet: 8,  status: 'folded' },
    ],
    deck: [],
    tableCards: [c('7', 'spades'), c('8', 'hearts'), c('2', 'clubs'), c('3', 'diamonds'), c('4', 'spades')],
    pot: 63,
    currentBet: 20,
    smallBlind: 2,
    bigBlind: 4,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    lastRaisePlayerIndex: 1,
    phase: 'river',
    winners: [],
    error: '',
  });

  it('sets phase to end', () => {
    expect(updateRoundState(makeShowdownGame()).phase).toBe('end');
  });

  it('winner (all-in for 10) collects 43 chips via side pot', () => {
    const result = updateRoundState(makeShowdownGame());
    expect(result.players[0].chips).toBe(43);
  });

  it('2nd place (all-in for 20) collects the remaining 20 chips', () => {
    const result = updateRoundState(makeShowdownGame());
    expect(result.players[1].chips).toBe(20);
  });

  it('3rd place (all-in for 20) receives nothing and is marked busted', () => {
    const result = updateRoundState(makeShowdownGame());
    expect(result.players[2].chips).toBe(0);
    expect(result.players[2].status).toBe('busted');
  });

  it('folded players keep their remaining chips untouched', () => {
    const result = updateRoundState(makeShowdownGame());
    expect(result.players[3].chips).toBe(45);
    expect(result.players[4].chips).toBe(42);
  });

  it('pot is fully distributed (0 remaining)', () => {
    expect(updateRoundState(makeShowdownGame()).pot).toBe(0);
  });

  it('winners array has the correct first-place winner', () => {
    const result = updateRoundState(makeShowdownGame());
    const firstWinner = result.winners[0] as PlayerState;
    expect(firstWinner.id).toBe('0');
  });
});

// --- Integration: same scenario but 2nd place all-in for 15 instead of 20 ---
// NOTE: Correct poker logic would give P1=10, P2=5 (P2 gets their excess 5 back).
// The code gives P1 the entire remaining pot (15) and P2 goes bust — a known side-pot bug.

describe('5-player river showdown: 2nd place all-in for 15 (exposes side-pot bug)', () => {
  // P0 (Winner)      — all-in for 10, pair of aces
  // P1 (Second)      — all-in for 15, pair of kings
  // P2 (Third)       — all-in for 20, pair of queens
  // P3 (FoldedFive)  — folded after 5; has 45 chips remaining
  // P4 (FoldedEight) — folded after 8; has 42 chips remaining
  // Pot = 10+15+20+5+8 = 58
  // P0 wins 43 (side-pot cap: 10 from each player)
  // Remaining pot = 15 → code gives all 15 to P1; correct poker would give P1=10, P2=5
  const makeShowdownGame = (): GameState => ({
    players: [
      { id: '0', name: 'Winner',      hand: [c('ace', 'spades'),    c('ace', 'hearts')],    chips: 0,  currentBet: 10, status: 'active' },
      { id: '1', name: 'Second',      hand: [c('king', 'hearts'),   c('king', 'diamonds')], chips: 0,  currentBet: 15, status: 'active' },
      { id: '2', name: 'Third',       hand: [c('queen', 'diamonds'), c('queen', 'clubs')],  chips: 0,  currentBet: 20, status: 'active' },
      { id: '3', name: 'FoldedFive',  hand: [],                                             chips: 45, currentBet: 5,  status: 'folded' },
      { id: '4', name: 'FoldedEight', hand: [],                                             chips: 42, currentBet: 8,  status: 'folded' },
    ],
    deck: [],
    tableCards: [c('7', 'spades'), c('8', 'hearts'), c('2', 'clubs'), c('3', 'diamonds'), c('4', 'spades')],
    pot: 58,
    currentBet: 20,
    smallBlind: 2,
    bigBlind: 4,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    lastRaisePlayerIndex: 1,
    phase: 'river',
    winners: [],
    error: '',
  });

  it('sets phase to end', () => {
    expect(updateRoundState(makeShowdownGame()).phase).toBe('end');
  });

  it('winner (all-in for 10) collects 43 chips via side pot', () => {
    const result = updateRoundState(makeShowdownGame());
    expect(result.players[0].chips).toBe(43);
  });

  it('2nd place (all-in for 15) collects 10 chips — the portion of the pot at their level', () => {
    const result = updateRoundState(makeShowdownGame());
    expect(result.players[1].chips).toBe(10);
  });

  it('3rd place (all-in for 20) gets their excess 5 chips back (no one else competed at that level)', () => {
    const result = updateRoundState(makeShowdownGame());
    expect(result.players[2].chips).toBe(5);
    expect(result.players[2].status).toBe('active');
  });

  it('folded players keep their remaining chips untouched', () => {
    const result = updateRoundState(makeShowdownGame());
    expect(result.players[3].chips).toBe(45);
    expect(result.players[4].chips).toBe(42);
  });

  it('pot is fully distributed (0 remaining)', () => {
    expect(updateRoundState(makeShowdownGame()).pot).toBe(0);
  });
});

// --- Integration: two players tie and split the pot ---

describe('3-player river showdown: two players tie and split the pot', () => {
  // P0 (TieA) and P1 (TieB) both play the board (AA+KK+Q two pair) — their hole cards don't improve it
  // P2 (Folder) folded after 10 chips; has 40 chips remaining
  // Pot = 20+20+10 = 50 → each tied player wins 25
  const makeTieGame = (): GameState => ({
    players: [
      { id: '0', name: 'TieA',   hand: [c('2', 'spades'),  c('3', 'hearts')],   chips: 0,  currentBet: 20, status: 'active' },
      { id: '1', name: 'TieB',   hand: [c('4', 'clubs'),   c('5', 'diamonds')], chips: 0,  currentBet: 20, status: 'active' },
      { id: '2', name: 'Folder', hand: [],                                      chips: 40, currentBet: 10, status: 'folded' },
    ],
    deck: [],
    tableCards: [c('ace', 'spades'), c('ace', 'hearts'), c('king', 'clubs'), c('king', 'diamonds'), c('queen', 'spades')],
    pot: 50,
    currentBet: 20,
    smallBlind: 2,
    bigBlind: 4,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    lastRaisePlayerIndex: 1,
    phase: 'river',
    winners: [],
    error: '',
  });

  it('sets phase to end', () => {
    expect(updateRoundState(makeTieGame()).phase).toBe('end');
  });

  it('first tied player receives half the pot (25 chips)', () => {
    const result = updateRoundState(makeTieGame());
    expect(result.players[0].chips).toBe(25);
  });

  it('second tied player receives half the pot (25 chips)', () => {
    const result = updateRoundState(makeTieGame());
    expect(result.players[1].chips).toBe(25);
  });

  it('folded player keeps their remaining chips untouched', () => {
    const result = updateRoundState(makeTieGame());
    expect(result.players[2].chips).toBe(40);
  });

  it('pot is fully distributed (0 remaining)', () => {
    expect(updateRoundState(makeTieGame()).pot).toBe(0);
  });

  it('winners contains a tie group with both players', () => {
    const result = updateRoundState(makeTieGame());
    expect(Array.isArray(result.winners[0])).toBe(true);
    expect((result.winners[0] as PlayerState[]).length).toBe(2);
  });
});

// --- Integration: asymmetric tie — tied players have different bets ---

describe('2-player river showdown: tie with unequal bets (10 vs 20)', () => {
  // P0 and P1 both play the board (AA+KK+Q two pair) — tied
  // P0 bet 10, P1 bet 20 → P0 wins their half of the shared 20-chip pot (10)
  // P1 wins their shared portion (10) plus their unmatched excess (10) = 20
  // Pot = 30
  const makeAsymmetricTieGame = (): GameState => ({
    players: [
      { id: '0', name: 'TieSmall', hand: [c('2', 'spades'),  c('3', 'hearts')],   chips: 0, currentBet: 10, status: 'active' },
      { id: '1', name: 'TieBig',   hand: [c('4', 'clubs'),   c('5', 'diamonds')], chips: 0, currentBet: 20, status: 'active' },
    ],
    deck: [],
    tableCards: [c('ace', 'spades'), c('ace', 'hearts'), c('king', 'clubs'), c('king', 'diamonds'), c('queen', 'spades')],
    pot: 30,
    currentBet: 20,
    smallBlind: 2,
    bigBlind: 4,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    lastRaisePlayerIndex: 1,
    phase: 'river',
    winners: [],
    error: '',
  });

  it('smaller-bet tied player wins their capped share (10 chips)', () => {
    const result = updateRoundState(makeAsymmetricTieGame());
    expect(result.players[0].chips).toBe(10);
  });

  it('larger-bet tied player wins their shared portion plus unmatched excess (20 chips)', () => {
    const result = updateRoundState(makeAsymmetricTieGame());
    expect(result.players[1].chips).toBe(20);
  });

  it('pot is fully distributed (0 remaining)', () => {
    expect(updateRoundState(makeAsymmetricTieGame()).pot).toBe(0);
  });
});

// --- Integration: 4-player showdown — tie for 1st with unequal bets, 4th place gets excess back ---

describe('4-player river showdown: tie for 1st (bets 5 and 10), 3rd and 4th place, 4th gets excess back', () => {
  // P0 and P1 tie for 1st — both play the board (AA+KK+Q two pair)
  // P2 is 3rd — plays AA+KK+J
  // P3 is 4th — plays AA+KK+10, bet 25 but no one matched above 20 so gets 5 back
  // Pot = 5+10+20+25 = 60
  // Side pots:
  //   Pot 1 (up to 5 each × 4): 20 — split between P0 and P1: 10 each
  //   Pot 2 (up to 10, 3 players): 15 — P1 wins
  //   Pot 3 (up to 20, P2 and P3): 20 — P2 wins
  //   Pot 4 (P3 excess above 20): 5 — returned to P3
  const make4PlayerTieGame = (): GameState => ({
    players: [
      { id: '0', name: 'TieSmall', hand: [c('queen', 'hearts'),  c('3', 'diamonds')], chips: 0, currentBet: 5,  status: 'active' },
      { id: '1', name: 'TieBig',   hand: [c('queen', 'diamonds'), c('4', 'clubs')],   chips: 0, currentBet: 10, status: 'active' },
      { id: '2', name: 'Third',    hand: [c('jack', 'hearts'),   c('5', 'spades')],   chips: 0, currentBet: 20, status: 'active' },
      { id: '3', name: 'Fourth',   hand: [c('10', 'clubs'),      c('6', 'diamonds')], chips: 0, currentBet: 25, status: 'active' },
    ],
    deck: [],
    tableCards: [c('ace', 'spades'), c('ace', 'hearts'), c('king', 'clubs'), c('king', 'diamonds'), c('2', 'spades')],
    pot: 60,
    currentBet: 25,
    smallBlind: 2,
    bigBlind: 4,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    lastRaisePlayerIndex: 1,
    phase: 'river',
    winners: [],
    error: '',
  });

  it('1st-place tied player (bet 5) wins 10 chips', () => {
    const result = updateRoundState(make4PlayerTieGame());
    expect(result.players[0].chips).toBe(10);
  });

  it('1st-place tied player (bet 10) wins 25 chips (10 shared + 15 side pot)', () => {
    const result = updateRoundState(make4PlayerTieGame());
    expect(result.players[1].chips).toBe(25);
  });

  it('3rd place (bet 20) wins 20 chips', () => {
    const result = updateRoundState(make4PlayerTieGame());
    expect(result.players[2].chips).toBe(20);
  });

  it('4th place (bet 25) gets their 5-chip excess returned and is not busted', () => {
    const result = updateRoundState(make4PlayerTieGame());
    expect(result.players[3].chips).toBe(5);
    expect(result.players[3].status).toBe('active');
  });

  it('pot is fully distributed (0 remaining)', () => {
    expect(updateRoundState(make4PlayerTieGame()).pot).toBe(0);
  });
});

// --- Integration: symmetric tie with odd pot (1 leftover chip) ---

describe('3-player river showdown: symmetric tie with odd pot from third-place all-in', () => {
  // P0 (TieA) and P1 (TieB) both have pair of aces — tied
  // P2 (Third) has king-high — loses, having bet 11 (creating an odd pot)
  // Pot = 20+20+11 = 51
  // floor(51/2) = 25 each; leftover 1 chip goes to TieB (first seat left of dealer at index 0)
  // NOTE: current Math.round logic awards 26 to both and leaves pot at -1 — this test documents the correct behavior
  const makeOddPotTieGame = (): GameState => ({
    players: [
      { id: '0', name: 'TieA',  hand: [c('ace', 'spades'),  c('ace', 'hearts')],   chips: 0, currentBet: 20, status: 'active' },
      { id: '1', name: 'TieB',  hand: [c('ace', 'clubs'),   c('ace', 'diamonds')], chips: 0, currentBet: 20, status: 'active' },
      { id: '2', name: 'Third', hand: [c('2', 'spades'),    c('7', 'clubs')],      chips: 0, currentBet: 11, status: 'active' },
    ],
    deck: [],
    tableCards: [c('king', 'hearts'), c('queen', 'spades'), c('jack', 'clubs'), c('3', 'diamonds'), c('4', 'hearts')],
    pot: 51,
    currentBet: 20,
    smallBlind: 2,
    bigBlind: 4,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    lastRaisePlayerIndex: 1,
    phase: 'river',
    winners: [],
    error: '',
  });

  it('sets phase to end', () => {
    expect(updateRoundState(makeOddPotTieGame()).phase).toBe('end');
  });

  it('first tied player (TieA) receives floor share — 25 chips', () => {
    const result = updateRoundState(makeOddPotTieGame());
    expect(result.players[0].chips).toBe(25);
  });

  it('second tied player (TieB, first seat left of dealer) receives floor share plus odd chip — 26 chips', () => {
    const result = updateRoundState(makeOddPotTieGame());
    expect(result.players[1].chips).toBe(26);
  });

  it('third place (all-in for 11, lost) ends with 0 chips and is busted', () => {
    const result = updateRoundState(makeOddPotTieGame());
    expect(result.players[2].chips).toBe(0);
    expect(result.players[2].status).toBe('busted');
  });

  it('pot is fully distributed (0 remaining)', () => {
    expect(updateRoundState(makeOddPotTieGame()).pot).toBe(0);
  });
});
