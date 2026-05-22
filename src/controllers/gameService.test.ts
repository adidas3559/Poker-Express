/// <reference types="jest" />
import { initGame, startNewRound } from './gameService';

describe('initGame', () => {
  it('returns a game in the waiting phase', () => {
    const game = initGame();
    expect(game.phase).toBe('waiting');
  });

  it('starts with an empty pot', () => {
    const game = initGame();
    expect(game.pot).toBe(0);
  });

  it('creates 6 players', () => {
    const game = initGame();
    expect(game.players).toHaveLength(6);
  });

  it('starts every player with an empty hand', () => {
    const game = initGame();
    game.players.forEach(player => {
      expect(player.hand).toHaveLength(0);
    });
  });

  it('starts every player with 0 currentBet', () => {
    const game = initGame();
    game.players.forEach(player => {
      expect(player.currentBet).toBe(0);
    });
  });

  it('starts every player as active', () => {
    const game = initGame();
    game.players.forEach(player => {
      expect(player.status).toBe('active');
    });
  });
});

describe('startNewRound', () => {
  it('sets phase to preflop', () => {
    const updatedGame = startNewRound(initGame());
    expect(updatedGame.phase).toBe('preflop');
  });

  it('pot equals small blind + big blind', () => {
    const game = initGame();
    const updatedGame = startNewRound(game);
    expect(updatedGame.pot).toBe(game.smallBlind + game.bigBlind);
  });

  it('table cards are empty at the start of a round', () => {
    const updatedGame = startNewRound(initGame());
    expect(updatedGame.tableCards).toHaveLength(0);
  });

  it('no player should be folded', () => {
    const game = initGame();
    const updatedGame = startNewRound(game);
    updatedGame.players.forEach(player => {
      expect(player.status).not.toBe('folded');
    });
  });

  it('every active player should have 2 cards', () => {
    const game = initGame();
    const updatedGame = startNewRound(game);
    updatedGame.players.forEach(player => {
      if (player.status === 'active') {
        expect(player.hand).toHaveLength(2);
      }
    });
  });

  it('small blind player has correct currentBet', () => {
    const game = initGame();
    const updatedGame = startNewRound(game);
    expect(updatedGame.players[1].currentBet).toBe(game.smallBlind);
  });

  it('big blind player has correct currentBet', () => {
    const game = initGame();
    const updatedGame = startNewRound(game);
    expect(updatedGame.players[2].currentBet).toBe(game.bigBlind);
  });

  it('small blind player chips are reduced by small blind amount', () => {
    const game = initGame();
    const updatedGame = startNewRound(game);
    expect(updatedGame.players[1].chips).toBe(game.players[1].chips - game.smallBlind);
  });

  it('big blind player chips are reduced by big blind amount', () => {
    const game = initGame();
    const updatedGame = startNewRound(game);
    expect(updatedGame.players[2].chips).toBe(game.players[2].chips - game.bigBlind);
  });
});

