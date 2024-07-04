import assert from 'assert';
import { mock } from 'jest-mock-extended';
import { nanoid } from 'nanoid';
import {
  GameResult,
  GameStatus,
  CordleGuess,
  CordlePlayerNumber,
} from '../../types/CoveyTownSocket';
import PlayerController from '../PlayerController';
import TownController from '../TownController';
import GameAreaController, { NO_GAME_IN_PROGRESS_ERROR } from './GameAreaController';
import CordleAreaController, { CORDLE_NUMBER_GUESSES } from './CordleAreaController';

describe('CordleAreaController', () => {
  const ourPlayer = new PlayerController(nanoid(), nanoid(), {
    x: 0,
    y: 0,
    moving: false,
    rotation: 'front',
  });
  const otherPlayers = [
    new PlayerController(nanoid(), nanoid(), { x: 0, y: 0, moving: false, rotation: 'front' }),
    new PlayerController(nanoid(), nanoid(), { x: 0, y: 0, moving: false, rotation: 'front' }),
  ];

  const mockTownController = mock<TownController>();
  Object.defineProperty(mockTownController, 'ourPlayer', {
    get: () => ourPlayer,
  });
  Object.defineProperty(mockTownController, 'players', {
    get: () => [ourPlayer, ...otherPlayers],
  });
  mockTownController.getPlayer.mockImplementation(playerID => {
    const p = mockTownController.players.find(player => player.id === playerID);
    assert(p);
    return p;
  });

  function updateGameWithMove(controller: CordleAreaController, nextGuess: CordleGuess): void {
    const nextState = Object.assign({}, controller.toInteractableAreaModel());
    const nextGame = Object.assign({}, nextState.game);
    nextState.game = nextGame;
    const newState = Object.assign({}, nextGame.state);
    nextGame.state = newState;
    newState.guesses = newState.guesses.concat([nextGuess]);
    controller.updateFrom(nextState, controller.occupants);
  }
  function cordleAreaControllerWithProps({
    _id,
    history,
    player1,
    player2,
    undefinedGame,
    status,
    guesses,
    gameInstanceID,
    firstPlayer,
    observers,
  }: {
    _id?: string;
    history?: GameResult[];
    player1?: string;
    player2?: string;
    undefinedGame?: boolean;
    status?: GameStatus;
    gameInstanceID?: string;
    guesses?: CordleGuess[];
    firstPlayer?: CordlePlayerNumber;
    observers?: string[];
  }) {
    const id = _id || `INTERACTABLE-ID-${nanoid()}`;
    const instanceID = gameInstanceID || `GAME-INSTANCE-ID-${nanoid()}`;
    const players = [];
    if (player1) players.push(player1);
    if (player2) players.push(player2);
    if (observers) players.push(...observers);
    const ret = new CordleAreaController(
      id,
      {
        id,
        occupants: players,
        history: history || [],
        type: 'CordleArea',
        game: undefinedGame
          ? undefined
          : {
              id: instanceID,
              players: players,
              state: {
                status: status || 'IN_PROGRESS',
                player1: player1,
                player2: player2,
                guesses: guesses || [],
                firstPlayer: firstPlayer || 'Player1',
                cordle: undefined,
                difficulty: undefined,
                guessesEvaluated: [],
              },
            },
      },
      mockTownController,
    );
    if (players) {
      ret.occupants = players
        .map(eachID => mockTownController.players.find(eachPlayer => eachPlayer.id === eachID))
        .filter(eachPlayer => eachPlayer) as PlayerController[];
    }
    return ret;
  }

  describe('[T1.1] Properties at the start of the game', () => {
    describe('board', () => {
      it('returns an empty board if there are no moves yet', () => {
        const controller = cordleAreaControllerWithProps({ status: 'IN_PROGRESS', guesses: [] });
        //Expect correct number of guesses
        expect(controller.board.length).toBe(CORDLE_NUMBER_GUESSES);
        for (let i = 0; i < CORDLE_NUMBER_GUESSES; i++) {
          expect(controller.board[i]).toBeUndefined();
        }
      });
    });
    describe('player1', () => {
      it('returns player1 if there is a player1', () => {
        const controller = cordleAreaControllerWithProps({ player1: ourPlayer.id });
        expect(controller.player1).toBe(ourPlayer);
      });
      it('returns undefined if there is no player1', () => {
        const controller = cordleAreaControllerWithProps({ player1: undefined });
        expect(controller.player1).toBeUndefined();
      });
    });
    describe('player2', () => {
      it('returns player2 if there is a player2', () => {
        const controller = cordleAreaControllerWithProps({ player2: ourPlayer.id });
        expect(controller.player2).toBe(ourPlayer);
      });
      it('returns undefined if there is no player2', () => {
        const controller = cordleAreaControllerWithProps({ player2: undefined });
        expect(controller.player2).toBeUndefined();
      });
    });
    describe('guessCount', () => {
      it('returns the number of guesses from the game state', () => {
        const controller = cordleAreaControllerWithProps({
          guesses: [
            { player: ourPlayer.id, guessedWord: 'brain', guessNumber: 1 },
            { player: ourPlayer.id, guessedWord: 'steak', guessNumber: 1 },
          ],
        });
        expect(controller.guessCount).toBe(2);
      });
    });
    describe('isOurTurn', () => {
      it('returns true if it is our turn', () => {
        const controller = cordleAreaControllerWithProps({
          player1: ourPlayer.id,
          firstPlayer: 'Player1',
          status: 'IN_PROGRESS',
          player2: otherPlayers[0].id,
        });
        expect(controller.isOurTurn).toBe(true);
      });
      it('returns false if it is not our turn', () => {
        const controller = cordleAreaControllerWithProps({
          player1: ourPlayer.id,
          firstPlayer: 'Player2',
          status: 'IN_PROGRESS',
          player2: otherPlayers[0].id,
        });
        expect(controller.isOurTurn).toBe(false);
      });
    });
    describe('whoseTurn', () => {
      it('returns player1 if the first player is player1', () => {
        const controller = cordleAreaControllerWithProps({
          player1: ourPlayer.id,
          firstPlayer: 'Player1',
          status: 'IN_PROGRESS',
          player2: otherPlayers[0].id,
        });
        expect(controller.whoseTurn).toBe(controller.player1);
      });
      it('returns player2 if the first player is player2', () => {
        const controller = cordleAreaControllerWithProps({
          player1: ourPlayer.id,
          firstPlayer: 'Player2',
          status: 'IN_PROGRESS',
          player2: otherPlayers[0].id,
        });
        expect(controller.whoseTurn).toBe(controller.player2);
      });
    });
    describe('isPlayer', () => {
      it('returns true if we are a player', () => {
        const controller = cordleAreaControllerWithProps({ player1: ourPlayer.id });
        expect(controller.isPlayer).toBe(true);
      });
      it('returns false if we are not a player', () => {
        const controller = cordleAreaControllerWithProps({ player1: undefined });
        expect(controller.isPlayer).toBe(false);
      });
    });
    describe('isEmpty', () => {
      it('returns true if there are no players', () => {
        const controller = cordleAreaControllerWithProps({ player1: undefined });
        expect(controller.isEmpty()).toBe(true);
      });
      it('returns false if there is just a player1', () => {
        const controller = cordleAreaControllerWithProps({ player1: ourPlayer.id });
        expect(controller.isEmpty()).toBe(false);
      });
      it('returns false if there is just a player2', () => {
        const controller = cordleAreaControllerWithProps({ player2: ourPlayer.id });
        expect(controller.isEmpty()).toBe(false);
      });
      it('returns false if there are multiple players', () => {
        const controller = cordleAreaControllerWithProps({
          player1: ourPlayer.id,
          player2: otherPlayers[0].id,
        });
        expect(controller.isEmpty()).toBe(false);
      });
      it('returns false if there are no players but there are observers', () => {
        const controller = cordleAreaControllerWithProps({ observers: [ourPlayer.id] });
        expect(controller.isEmpty()).toBe(false);
      });
    });
    describe('isActive', () => {
      it('returns true if the game is not empty and it is not waiting for players', () => {
        const controller = cordleAreaControllerWithProps({
          player1: ourPlayer.id,
          player2: otherPlayers[0].id,
          status: 'IN_PROGRESS',
        });
        expect(controller.isActive()).toBe(true);
      });
      it('returns false if the game is empty', () => {
        const controller = cordleAreaControllerWithProps({
          player1: undefined,
          status: 'IN_PROGRESS',
        });
        expect(controller.isActive()).toBe(false);
      });
      it('returns false if the game is waiting for players', () => {
        const controller = cordleAreaControllerWithProps({
          player1: ourPlayer.id,
          player2: otherPlayers[0].id,
          status: 'WAITING_FOR_PLAYERS',
        });
        expect(controller.isActive()).toBe(false);
      });
    });
  });

  describe('[T1.2] Properties during the game, modified by _updateFrom ', () => {
    let controller: CordleAreaController;
    beforeEach(() => {
      controller = cordleAreaControllerWithProps({
        player1: ourPlayer.id,
        player2: otherPlayers[0].id,
        status: 'IN_PROGRESS',
      });
    });
    it('does not emit a boardChange event if the board has not changed', () => {
      const spy = jest.fn();
      controller.addListener('boardChanged', spy);
      controller.updateFrom(
        { ...controller.toInteractableAreaModel() },
        otherPlayers.concat(ourPlayer),
      );
      expect(spy).not.toHaveBeenCalled();
    });
    it('Calls super.updateFrom with the correct parameters', () => {
      //eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore - we are testing spying on a private method
      const spy = jest.spyOn(GameAreaController.prototype, '_updateFrom');
      const model = controller.toInteractableAreaModel();
      controller.updateFrom(model, otherPlayers.concat(ourPlayer));
      expect(spy).toHaveBeenCalledWith(model);
    });
    describe('updating whoseTurn and isOurTurn', () => {
      describe('When Player 1 goes first and we are player 1', () => {
        beforeEach(() => {
          controller = cordleAreaControllerWithProps({
            player1: ourPlayer.id,
            player2: otherPlayers[0].id,
            status: 'IN_PROGRESS',
            firstPlayer: 'Player1',
          });
        });
        it("returns player1 and true if it is player1's turn", () => {
          updateGameWithMove(controller, {
            player: ourPlayer.id,
            guessedWord: 'brain',
            guessNumber: 1,
          });
          updateGameWithMove(controller, {
            player: otherPlayers[0].id,
            guessedWord: 'steak',
            guessNumber: 2,
          });
          expect(controller.whoseTurn).toBe(ourPlayer);
          expect(controller.isOurTurn).toBe(true);
        });
        it("returns player2 and false if it is player2's turn", () => {
          updateGameWithMove(controller, {
            player: ourPlayer.id,
            guessedWord: 'brain',
            guessNumber: 1,
          });
          expect(controller.whoseTurn).toBe(otherPlayers[0]);
          expect(controller.isOurTurn).toBe(false);
        });
      });
      describe('When player1 goes first and we are player2', () => {
        beforeEach(() => {
          controller = cordleAreaControllerWithProps({
            player2: ourPlayer.id,
            player1: otherPlayers[0].id,
            status: 'IN_PROGRESS',
            firstPlayer: 'Player1',
          });
        });
        it("returns Player1 and false if it is Player1's turn", () => {
          updateGameWithMove(controller, {
            player: otherPlayers[0].id,
            guessedWord: 'brain',
            guessNumber: 1,
          });
          updateGameWithMove(controller, {
            player: ourPlayer.id,
            guessedWord: 'steak',
            guessNumber: 2,
          });
          expect(controller.whoseTurn).toBe(otherPlayers[0]);
          expect(controller.isOurTurn).toBe(false);
        });
        it("returns player2 and true if it is player2's turn", () => {
          updateGameWithMove(controller, {
            player: otherPlayers[0].id,
            guessedWord: 'brain',
            guessNumber: 1,
          });
          expect(controller.whoseTurn).toBe(ourPlayer);
          expect(controller.isOurTurn).toBe(true);
        });
      });
      describe('When player2 goes first and we are player2', () => {
        beforeEach(() => {
          controller = cordleAreaControllerWithProps({
            player2: ourPlayer.id,
            player1: otherPlayers[0].id,
            status: 'IN_PROGRESS',
            firstPlayer: 'Player2',
          });
        });
        it("returns player2 and true if it is player2's turn", () => {
          updateGameWithMove(controller, {
            player: ourPlayer.id,
            guessedWord: 'brain',
            guessNumber: 1,
          });
          updateGameWithMove(controller, {
            player: otherPlayers[0].id,
            guessedWord: 'steak',
            guessNumber: 2,
          });
          expect(controller.whoseTurn).toBe(ourPlayer);
          expect(controller.isOurTurn).toBe(true);
        });
        it("returns player1 and false if it is player1's turn", () => {
          updateGameWithMove(controller, {
            player: ourPlayer.id,
            guessedWord: 'brain',
            guessNumber: 1,
          });
          expect(controller.whoseTurn).toBe(otherPlayers[0]);
          expect(controller.isOurTurn).toBe(false);
        });
      });
      describe('When player2 goes first and we are player1', () => {
        beforeEach(() => {
          controller = cordleAreaControllerWithProps({
            player1: ourPlayer.id,
            player2: otherPlayers[0].id,
            status: 'IN_PROGRESS',
            firstPlayer: 'Player2',
          });
        });
        it("returns player2 and false if it is player2's turn", () => {
          updateGameWithMove(controller, {
            player: otherPlayers[0].id,
            guessedWord: 'brain',
            guessNumber: 1,
          });
          updateGameWithMove(controller, {
            player: ourPlayer.id,
            guessedWord: 'steak',
            guessNumber: 2,
          });
          expect(controller.whoseTurn).toBe(otherPlayers[0]);
          expect(controller.isOurTurn).toBe(false);
        });
        it("returns player1 and true if it is player1's turn", () => {
          updateGameWithMove(controller, {
            player: otherPlayers[0].id,
            guessedWord: 'brain',
            guessNumber: 1,
          });
          expect(controller.whoseTurn).toBe(ourPlayer);
          expect(controller.isOurTurn).toBe(true);
        });
      });
    });
    describe('emitting turnChanged events', () => {
      it('emits a turnChanged event if the turn has changed', () => {
        expect(controller.isOurTurn).toBe(true);
        const spy = jest.fn();
        controller.addListener('turnChanged', spy);
        updateGameWithMove(controller, {
          player: ourPlayer.id,
          guessedWord: 'brain',
          guessNumber: 1,
        });
        expect(controller.isOurTurn).toBe(false);
        expect(spy).toHaveBeenCalledWith(false);
        spy.mockClear();
        updateGameWithMove(controller, {
          player: otherPlayers[0].id,
          guessedWord: 'steak',
          guessNumber: 2,
        });
        expect(controller.isOurTurn).toBe(true);
        expect(spy).toHaveBeenCalledWith(true);
      });
      it('does not emit a turnChanged event if the turn has not changed', () => {
        expect(controller.isOurTurn).toBe(true);
        const spy = jest.fn();
        controller.addListener('turnChanged', spy);
        controller.updateFrom(controller.toInteractableAreaModel(), [ourPlayer, otherPlayers[0]]);
        expect(spy).not.toHaveBeenCalled();
      });
    });
  });

  describe('[T1.3] startGame', () => {
    it('sends a StartGame command to the server', async () => {
      const controller = cordleAreaControllerWithProps({
        player1: ourPlayer.id,
        player2: otherPlayers[0].id,
        status: 'WAITING_TO_START',
      });
      const instanceID = nanoid();
      mockTownController.sendInteractableCommand.mockImplementationOnce(async () => {
        return { gameID: instanceID };
      });
      await controller.joinGame();

      mockTownController.sendInteractableCommand.mockClear();
      mockTownController.sendInteractableCommand.mockImplementationOnce(async () => {});
      await controller.startGame('Easy');
      expect(mockTownController.sendInteractableCommand).toHaveBeenCalledWith(controller.id, {
        type: 'StartCordleGame',
        difficulty: 'Easy',
        gameID: instanceID,
      });
    });
    it('Does not catch any errors from the server', async () => {
      const controller = cordleAreaControllerWithProps({
        player1: ourPlayer.id,
        player2: otherPlayers[0].id,
        status: 'WAITING_TO_START',
      });
      const instanceID = nanoid();
      mockTownController.sendInteractableCommand.mockImplementationOnce(async () => {
        return { gameID: instanceID };
      });
      await controller.joinGame();

      mockTownController.sendInteractableCommand.mockClear();
      const uniqueError = `Test Error ${nanoid()}`;
      mockTownController.sendInteractableCommand.mockImplementationOnce(async () => {
        throw new Error(uniqueError);
      });
      await expect(() => controller.startGame('Easy')).rejects.toThrowError(uniqueError);
      expect(mockTownController.sendInteractableCommand).toHaveBeenCalledWith(controller.id, {
        type: 'StartCordleGame',
        gameID: instanceID,
        difficulty: 'Easy',
      });
    });
    it('throws an error if the game is not startable', async () => {
      const controller = cordleAreaControllerWithProps({
        player1: ourPlayer.id,
        player2: otherPlayers[0].id,
        status: 'IN_PROGRESS',
      });
      const instanceID = nanoid();
      mockTownController.sendInteractableCommand.mockImplementationOnce(async () => {
        return { gameID: instanceID };
      });
      await controller.joinGame();
      mockTownController.sendInteractableCommand.mockClear();
      await expect(controller.startGame('Easy')).rejects.toThrowError();
      expect(mockTownController.sendInteractableCommand).not.toHaveBeenCalled();
    });
    it('throws an error if there is no instanceid', async () => {
      const controller = cordleAreaControllerWithProps({
        player1: ourPlayer.id,
        player2: otherPlayers[0].id,
        status: 'WAITING_TO_START',
      });
      mockTownController.sendInteractableCommand.mockClear();
      await expect(controller.startGame('Easy')).rejects.toThrowError();
      expect(mockTownController.sendInteractableCommand).not.toHaveBeenCalled();
    });
  });
  describe('[T1.4] makeMove', () => {
    describe('With no game in progress', () => {
      it('Throws an error if there is no game', async () => {
        const controller = cordleAreaControllerWithProps({
          player1: ourPlayer.id,
          player2: otherPlayers[0].id,
          undefinedGame: true,
        });
        await expect(() => controller.makeMove('bread')).rejects.toThrowError(
          NO_GAME_IN_PROGRESS_ERROR,
        );
      });
      it('Throws an error if game status is not IN_PROGRESS', async () => {
        const controller = cordleAreaControllerWithProps({
          player1: ourPlayer.id,
          player2: otherPlayers[0].id,
          status: 'WAITING_TO_START',
        });
        await expect(() => controller.makeMove('bread')).rejects.toThrowError(
          NO_GAME_IN_PROGRESS_ERROR,
        );
      });
    });
  });
});
