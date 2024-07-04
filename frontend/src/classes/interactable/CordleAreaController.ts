import _ from 'lodash';
import {
  CordleGameState,
  GameArea,
  GameStatus,
  CordleGuess,
  CordleGuessNumber,
  CordleCell,
  CordleDifficulty,
  CordlePlayerNumber,
} from '../../types/CoveyTownSocket';
import PlayerController from '../PlayerController';
import GameAreaController, {
  GameEventTypes,
  NO_GAME_IN_PROGRESS_ERROR,
  NO_GAME_STARTABLE,
} from './GameAreaController';

export type CordleEvents = GameEventTypes & {
  boardChanged: (board: CordleGuess[], guessesEvaluated: CordleCell[][]) => void;
  turnChanged: (isOurTurn: boolean) => void;
};
export const CORDLE_NUMBER_GUESSES = 6;
export const CORDLE_WORD_LENGTH = 5;
export const WORD_NOT_EXISTS_MESSAGE = 'The guessed word does not exist in the dictionary';
export const WORD_WRONG_LENGTH_MESSAGE = 'The guessed word must be exactly 5 characters long';

function createEmptyBoard(): CordleGuess[] {
  const board = new Array(CORDLE_NUMBER_GUESSES);
  for (let i = 0; i < CORDLE_NUMBER_GUESSES; i++) {
    board[i] = undefined;
  }
  return board;
}

function createEmptyGuessesEvaluated(): CordleCell[][] {
  const guessesEvaluated = new Array(CORDLE_NUMBER_GUESSES);
  for (let i = 0; i < CORDLE_NUMBER_GUESSES; i++) {
    guessesEvaluated[i] = new Array(CORDLE_WORD_LENGTH).fill(undefined);
  }
  return guessesEvaluated;
}

/**
 * This class is responsible for managing the state of the Cordle game, and for sending commands to the server
 */
export default class CordleAreaController extends GameAreaController<
  CordleGameState,
  CordleEvents
> {
  protected _board: CordleGuess[] = createEmptyBoard();

  protected _guessesEvaulated: CordleCell[][] = createEmptyGuessesEvaluated();

  /**
   * Returns the current state of the board.
   *
   * The board is an array of CordleGuess, which contains information about a guess or is undefined.
   */
  get board(): CordleGuess[] {
    return this._board;
  }

  /**
   * Returns the current colors of the tiles on the board.
   *
   */
  get guessesEvaluated(): CordleCell[][] {
    return this._guessesEvaulated;
  }

  /**
   * Returns the player known as Player 1, if there is one, or undefined otherwise
   */
  get player1(): PlayerController | undefined {
    const p1 = this._model.game?.state.player1;
    if (p1) {
      return this.occupants.find(eachOccupant => eachOccupant.id === p1);
    }
    return undefined;
  }

  /**
   * Returns the player known as Player 2, if there is one, or undefined otherwise
   */
  get player2(): PlayerController | undefined {
    const p2 = this._model.game?.state.player2;
    if (p2) {
      return this.occupants.find(eachOccupant => eachOccupant.id === p2);
    }
    return undefined;
  }

  /**
   * Returns the player who won the game, if there is one, or undefined otherwise
   */
  get winner(): PlayerController | undefined {
    const winner = this._model.game?.state.winner;
    if (winner) {
      return this.occupants.find(eachOccupant => eachOccupant.id === winner);
    }
    return undefined;
  }

  /**
   * Returns the word that the players are trying to guess
   */
  get cordle(): string | undefined {
    return this._model.game?.state.cordle;
  }

  /**
   * Returns the number of guesses that have been made in the game
   */
  get guessCount(): number {
    return this._model.game?.state.guesses.length || 0;
  }

  /**
   * Returns true if it is our turn to make a move, false otherwise
   */
  get isOurTurn(): boolean {
    return this.whoseTurn?.id === this._townController.ourPlayer.id;
  }

  /**
   * Returns true if the current player is in the game, false otherwise
   */
  get isPlayer(): boolean {
    return this._model.game?.players.includes(this._townController.ourPlayer.id) ?? false;
  }

  get firstPlayer(): CordlePlayerNumber | undefined {
    return this._model.game?.state.firstPlayer;
  }

  /**
   * Returns the status of the game
   * If there is no game, returns 'WAITING_FOR_PLAYERS'
   */
  get status(): GameStatus {
    const status = this._model.game?.state.status;
    if (!status) {
      return 'WAITING_FOR_PLAYERS';
    }
    return status;
  }

  /**
   * Returns the player whose turn it is, if the game is in progress
   * Returns undefined if the game is not in progress
   *
   * Follows the same logic as the backend, respecting the firstPlayer field of the gameState
   */
  get whoseTurn(): PlayerController | undefined {
    const { player1, player2 } = this;
    if (!player1 || !player2 || this._model.game?.state.status !== 'IN_PROGRESS') {
      return undefined;
    }
    const firstPlayer = this._model.game?.state.firstPlayer;
    if (firstPlayer === 'Player1') {
      if (this.guessCount % 2 === 0) {
        return player1;
      }
      return player2;
    } else {
      if (this.guessCount % 2 === 0) {
        return player2;
      }
      return player1;
    }
  }

  /**
   * Returns true if the game is empty - no players AND no occupants in the area
   *
   */
  isEmpty(): boolean {
    return !this.player1 && !this.player2 && this.occupants.length === 0;
  }

  /**
   * Returns true if the game is not empty and the game is not waiting for players
   */
  public isActive(): boolean {
    return !this.isEmpty() && this.status !== 'WAITING_FOR_PLAYERS';
  }

  /**
   * Updates the internal state of this CordleAreaController based on the new model.
   *
   * Calls super._updateFrom, which updates the occupants of this game area and other
   * common properties (including this._model)
   *
   * If the board has changed, emits a boardChanged event with the new board.
   * If the board has not changed, does not emit a boardChanged event.
   *
   * If the turn has changed, emits a turnChanged event with the new turn (true if our turn, false otherwise)
   * If the turn has not changed, does not emit a turnChanged event.
   */
  protected _updateFrom(newModel: GameArea<CordleGameState>): void {
    const wasOurTurn = this.isOurTurn;
    super._updateFrom(newModel);
    const newGame = newModel.game;
    if (newGame) {
      const newBoard = createEmptyBoard();
      const newGuessesEvaluated = createEmptyGuessesEvaluated();
      newGame.state.guesses.forEach(guess => {
        newBoard[guess.guessNumber - 1] = guess;
      });
      newGame.state.guessesEvaluated.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          newGuessesEvaluated[rowIndex][colIndex] = cell;
        });
      });
      if (
        !_.isEqual(newBoard, this._board) &&
        !_.isEqual(newGuessesEvaluated, this._guessesEvaulated)
      ) {
        this._board = newBoard;
        this._guessesEvaulated = newGuessesEvaluated;
        this.emit('boardChanged', this._board, this._guessesEvaulated);
      }
    }
    const isOurTurn = this.isOurTurn;
    if (wasOurTurn !== isOurTurn) this.emit('turnChanged', isOurTurn);
  }

  /**
   * Sends a request to the server to start the game.
   *
   * If the game is not in the WAITING_TO_START state, throws an error.
   *
   * @param difficulty the difficulty of the game
   *
   * @throws an error with message NO_GAME_STARTABLE if there is no game waiting to start
   */
  public async startGame(difficulty: CordleDifficulty): Promise<void> {
    const instanceID = this._instanceID;
    if (!instanceID || this._model.game?.state.status !== 'WAITING_TO_START') {
      throw new Error(NO_GAME_STARTABLE);
    }
    await this._townController.sendInteractableCommand(this.id, {
      gameID: instanceID,
      type: 'StartCordleGame',
      difficulty: difficulty,
    });
  }

  // Checks if the provided word is a real word using a dictionary API
  private async _isRealWord(word: string): Promise<boolean> {
    const apiUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      // Check if the response contains any definitions (indicating the word exists)
      return Array.isArray(data) && data.length > 0;
    } catch (error) {
      console.error('Error fetching data:', error);
      return false; // Treat any errors as invalid word
    }
  }

  /**
   * Sends a request to the server to make a guess in the game.
   *
   * @throws an error with message NO_GAME_IN_PROGRESS_ERROR if there is no game in progress
   * @throws an error with message INVALID_WORD_LENGTH_MESSAGE if the word is not 5 characters long
   * @throws an error with message WORD_NOT_EXISTS_MESSAGE if the word does not exist in the dictionary
   *
   * @param guess the word to guess
   */
  public async makeMove(guess: string): Promise<void> {
    const instanceID = this._instanceID;
    if (!instanceID || this._model.game?.state.status !== 'IN_PROGRESS') {
      throw new Error(NO_GAME_IN_PROGRESS_ERROR);
    }

    const playerID = this._townController.ourPlayer.id;

    // Check if the guess is exactly five letters long
    if (guess.length !== 5) {
      throw new Error(WORD_WRONG_LENGTH_MESSAGE);
    }

    // Check if the guess is a real word and place it in the board
    const isWordExists = await this._isRealWord(guess);
    if (!isWordExists) {
      throw new Error(WORD_NOT_EXISTS_MESSAGE);
    }

    const cordleGuess: CordleGuess = {
      player: playerID,
      guessedWord: guess,
      guessNumber: (this.guessCount + 1) as CordleGuessNumber,
    };
    await this._townController.sendInteractableCommand(this.id, {
      type: 'GameMove',
      gameID: instanceID,
      move: cordleGuess,
    });
  }
}
