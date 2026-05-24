import {
  createPlayer,
  createGame,
  DealCards,
  testDealCards as testDeal,
  raiseHandler as raise,
  callHandler as call,
  checkHandler as check,
  foldHandler as fold,
  allInHandler as allIn,
} from './GameLogic';
import type { CardState, GameState, PlayerState } from '../types/GameState';

// Edit these constants to test specific scenarios
const TEST_PLAYER_HANDS: [CardState, CardState][] = [
  [{ number: '6', suit: 'hearts' },     { number: '2', suit: 'spades' }],    // Blake
  [{ number: 'queen', suit: 'spades' }, { number: '8', suit: 'spades' }],    // Alissa
  [{ number: '4', suit: 'spades' },     { number: 'queen', suit: 'clubs' }], // Stephen
  [{ number: '3', suit: 'spades' },     { number: '6', suit: 'diamonds' }],  // Caitlyn
  [{ number: 'jack', suit: 'hearts' },  { number: '10', suit: 'clubs' }],    // Ben
  [{ number: '2', suit: 'hearts' },     { number: '7', suit: 'hearts' }],    // Max
];

// Ordered for pop(): last element is drawn first
// Table cards produced: 4♣, 9♠, 10♦ (flop), 8♥ (turn), K♣ (river)
const TEST_DECK: CardState[] = [
  { number: 'king',  suit: 'clubs' },    // river card
  { number: '5',     suit: 'clubs' },    // burn before river
  { number: '8',     suit: 'hearts' },   // turn card
  { number: '5',     suit: 'diamonds' }, // burn before turn
  { number: '10',    suit: 'diamonds' }, // flop card 3
  { number: '9',     suit: 'spades' },   // flop card 2
  { number: '4',     suit: 'clubs' },    // flop card 1
  { number: '5',     suit: 'hearts' },   // burn before flop (popped first)
];

const testInitGame = (): GameState => {
  const players: PlayerState[] = [
    createPlayer('0', 'Blake', 20),
    createPlayer('1', 'Alissa', 20),
    createPlayer('2', 'Stephen', 20),
    createPlayer('3', 'Caitlyn', 20),
    createPlayer('4', 'Ben', 2),
    createPlayer('5', 'Max', 20),
  ]
  return createGame(players);
}

type RoomState = {
  roomName: string;
  roomCode: string;
  host: string;
  players: { id: string, socketId: string, nickname: string }[];
}

const initGame = (room: RoomState): GameState => {
  const players: PlayerState[] = room.players.map(p => {
    return createPlayer(p.id, p.nickname, 20);
  });
  return createGame(players);
}

const startNewRound = (game: GameState): GameState => {
  return DealCards(game);
}

const testStartNewRound = (game: GameState): GameState => {
  return testDeal(game, { playerHands: TEST_PLAYER_HANDS, deck: TEST_DECK });
}

const raiseHandler = (game: GameState, betInput: number): GameState => {
  return raise(game, betInput);
}

const callHandler = (game: GameState): GameState => {
  return call(game);
}

const checkHandler = (game: GameState): GameState => {
  return check(game);
}

const foldHandler = (game: GameState): GameState => {
  return fold(game);
}

const allInHandler = (game: GameState): GameState => {
  return allIn(game);
}

export {
  initGame,
  testInitGame,
  startNewRound,
  testStartNewRound,
  raiseHandler,
  callHandler,
  checkHandler,
  foldHandler,
  allInHandler,
}