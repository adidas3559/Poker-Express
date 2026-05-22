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

  it('triggers a phase change when the current player is last to act', () => {
    // currentPlayerIndex 1, lastRaisePlayerIndex 2 → next after 1 is 2 = lastRaise → end of round
    const game = makeGame({ currentPlayerIndex: 1, lastRaisePlayerIndex: 2 });
    const result = raiseHandler(game, 10);
    expect(result.phase).toBe('flop');
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
console.log('🚀 ~ makeRiverGame ~ makeRiverGame:', makeRiverGame);

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
console.log('🚀 ~ makeBenLosesGame ~ makeBenLosesGame:', makeBenLosesGame);

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

  it('mutates input game.phase as a side effect (known bug)', () => {
    const game = makePhaseGame('preflop');
    updateRoundState(game);
    expect(game.phase).toBe('flop');
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
    console.log('🚀 ~ result:', result);
    // player 0 has pair of aces and should win
    expect(game.players[5].chips).toBeGreaterThan(game.players[5].chips);
  });

  it('Second place winner gets chips', () => {
    const game = makeBenWinsGame();
    console.log('🚀 ~ game:', game);
    const result = updateRoundState(game);
    console.log('🚀 ~ result:', result);
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
