import { nanoid } from 'nanoid';
import { mock } from 'jest-mock-extended';
import Player from '../../lib/Player';
import CordleGame from './CordleGame';
import * as CordleGameModule from './CordleGame';
import CordleGameArea from './CordleGameArea';
import {
  CordleGameState,
  GameMove,
  TownEmitter,
  CordleGuess,
  GameInstanceID,
  CordlePlayerNumber,
  CordleDifficulty,
} from '../../types/CoveyTownSocket';
import Game from './Game';
import { createPlayerForTesting } from '../../TestUtils';
import {
  GAME_NOT_IN_PROGRESS_MESSAGE,
  GAME_ID_MISSMATCH_MESSAGE,
} from '../../lib/InvalidParametersError';

class TestingGame extends Game<CordleGameState, CordleGuess> {
  public constructor(priorGame?: CordleGame) {
    super({
      guesses: [],
      status: 'WAITING_FOR_PLAYERS',
      firstPlayer: priorGame?.state.firstPlayer || 'Player1',
      cordle: '',
      guessesEvaluated: [],
      difficulty: undefined,
    });
  }

  public applyMove(move: GameMove<CordleGuess>): void {}

  public endGame(winner?: string) {
    this.state = {
      ...this.state,
      status: 'OVER',
      winner,
    };
  }

  public startGame(player: Player) {
    if (this.state.player1 === player.id) this.state.player1Ready = true;
    else this.state.player2Ready = true;
  }

  protected _join(player: Player): void {
    if (this.state.player1) this.state.player2 = player.id;
    else this.state.player1 = player.id;
    this._players.push(player);
  }

  protected _leave(player: Player): void {}

  public whoseTurn(): CordlePlayerNumber {
    return 'Player1';
  }

  public setDifficultyLevel(difficulty: CordleDifficulty): void {}

  protected _applyGuess(guess: CordleGuess): void {}
}

describe('CordleGameArea', () => {
  let gameArea: CordleGameArea;
  let player1: Player;
  let player2: Player;
  let interactableUpdateSpy: jest.SpyInstance;
  const gameConstructorSpy = jest.spyOn(CordleGameModule, 'default');
  let game: CordleGame;

  beforeEach(() => {
    gameConstructorSpy.mockClear();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore (Testing without using the real game class)
    game = new TestingGame();

    gameConstructorSpy.mockReturnValue(game);

    player1 = createPlayerForTesting();
    player2 = createPlayerForTesting();

    gameArea = new CordleGameArea(
      nanoid(),
      { x: 0, y: 0, width: 100, height: 100 },
      mock<TownEmitter>(),
    );
    gameArea.add(player1);
    gameArea.add(player2);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore (Test requires access to protected method)
    interactableUpdateSpy = jest.spyOn(gameArea, '_emitAreaChanged');
  });

  describe('[T3.2] StartCordleGame command', () => {
    test('when there is no game, it should throw an error and not call _emitAreaChanged', () => {
      expect(() =>
        gameArea.handleCommand(
          { type: 'StartCordleGame', gameID: nanoid(), difficulty: 'Easy' },
          player1,
        ),
      ).toThrowError(GAME_NOT_IN_PROGRESS_MESSAGE);
      expect(interactableUpdateSpy).not.toHaveBeenCalled();
    });

    describe('when there is a game in progress', () => {
      it('should call startGame on the game and call _emitAreaChanged', () => {
        const { gameID } = gameArea.handleCommand({ type: 'JoinGame' }, player1);
        interactableUpdateSpy.mockClear();
        gameArea.handleCommand({ type: 'StartCordleGame', gameID, difficulty: 'Easy' }, player2);
        expect(interactableUpdateSpy).toHaveBeenCalledTimes(1);
      });

      it('should not call _emitAreaChanged if the game throws an error', () => {
        interactableUpdateSpy.mockClear();
        expect(() =>
          gameArea.handleCommand(
            { type: 'StartCordleGame', gameID: game.id, difficulty: 'Easy' },
            player1,
          ),
        ).toThrowError(GAME_NOT_IN_PROGRESS_MESSAGE);
        expect(interactableUpdateSpy).not.toHaveBeenCalled();
      });

      test('when the game ID mismatches, it should throw an error and not call _emitAreaChanged', () => {
        gameArea.handleCommand({ type: 'JoinGame' }, player1);
        if (!game) {
          throw new Error('Game was not created by the first call to join');
        }
        expect(() =>
          gameArea.handleCommand(
            { type: 'StartCordleGame', gameID: nanoid(), difficulty: 'Easy' },
            player1,
          ),
        ).toThrowError(GAME_ID_MISSMATCH_MESSAGE);
      });
    });
  });

  describe('[T3.3] GameMove command', () => {
    it('should throw an error if there is no game in progress and not call _emitAreaChanged', () => {
      interactableUpdateSpy.mockClear();

      expect(() =>
        gameArea.handleCommand(
          {
            type: 'GameMove',
            move: { guessedWord: 'test', guessNumber: 1, player: player1.id },
            gameID: nanoid(),
          },
          player1,
        ),
      ).toThrowError(GAME_NOT_IN_PROGRESS_MESSAGE);
      expect(interactableUpdateSpy).not.toHaveBeenCalled();
    });

    describe('when there is a game in progress', () => {
      let gameID: GameInstanceID;
      beforeEach(() => {
        gameID = gameArea.handleCommand({ type: 'JoinGame' }, player1).gameID;
        gameArea.handleCommand({ type: 'JoinGame' }, player2);
        interactableUpdateSpy.mockClear();
      });

      it('should throw an error if the gameID does not match the game and not call _emitAreaChanged', () => {
        expect(() =>
          gameArea.handleCommand(
            {
              type: 'GameMove',
              move: { guessedWord: 'test', guessNumber: 1, player: player1.id },
              gameID: nanoid(),
            },
            player1,
          ),
        ).toThrowError(GAME_ID_MISSMATCH_MESSAGE);
      });

      it('should call applyMove on the game and call _emitAreaChanged', () => {
        const move: CordleGuess = { guessedWord: 'test', guessNumber: 1, player: 'Player1' };
        const applyMoveSpy = jest.spyOn(game, 'applyMove');
        gameArea.handleCommand({ type: 'GameMove', move, gameID }, player1);
        expect(applyMoveSpy).toHaveBeenCalledWith({
          gameID: game.id,
          playerID: player1.id,
          move,
        });
        expect(interactableUpdateSpy).toHaveBeenCalledTimes(1);
      });

      it('should not call _emitAreaChanged if the game throws an error', () => {
        const move: CordleGuess = { guessedWord: 'test', guessNumber: 1, player: 'Player1' };
        const applyMoveSpy = jest.spyOn(game, 'applyMove').mockImplementationOnce(() => {
          throw new Error('Test Error');
        });
        expect(() =>
          gameArea.handleCommand({ type: 'GameMove', move, gameID }, player1),
        ).toThrowError('Test Error');
        expect(applyMoveSpy).toHaveBeenCalledWith({
          gameID: game.id,
          playerID: player1.id,
          move,
        });
        expect(interactableUpdateSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('[T3.4] LeaveGame command', () => {
    it('should throw an error if there is no game in progress', () => {
      expect(() =>
        gameArea.handleCommand({ type: 'LeaveGame', gameID: nanoid() }, player1),
      ).toThrowError(GAME_NOT_IN_PROGRESS_MESSAGE);
    });

    describe('when there is a game in progress', () => {
      let gameID: GameInstanceID;
      beforeEach(() => {
        gameID = gameArea.handleCommand({ type: 'JoinGame' }, player1).gameID;
        gameArea.handleCommand({ type: 'JoinGame' }, player2);
        interactableUpdateSpy.mockClear();
      });

      it('should call leaveGame on the game and call _emitAreaChanged', () => {
        const leaveGameSpy = jest.spyOn(game, 'leave');
        gameArea.handleCommand({ type: 'LeaveGame', gameID }, player1);
        expect(leaveGameSpy).toHaveBeenCalledWith(player1);
        expect(interactableUpdateSpy).toHaveBeenCalledTimes(1);
      });

      it('should not call _emitAreaChanged if the game throws an error', () => {
        const leaveGameSpy = jest.spyOn(game, 'leave').mockImplementationOnce(() => {
          throw new Error('Test Error');
        });
        expect(() => gameArea.handleCommand({ type: 'LeaveGame', gameID }, player1)).toThrowError(
          'Test Error',
        );
        expect(leaveGameSpy).toHaveBeenCalledWith(player1);
        expect(interactableUpdateSpy).not.toHaveBeenCalled();
      });
    });
  });
});
