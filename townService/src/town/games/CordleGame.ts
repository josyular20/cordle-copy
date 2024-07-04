import * as fs from 'fs';
import * as path from 'path';
import InvalidParametersError, {
  GAME_NOT_IN_PROGRESS_MESSAGE,
  GAME_FULL_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
  PLAYER_ALREADY_IN_GAME_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
  GAME_NOT_STARTABLE_MESSAGE,
} from '../../lib/InvalidParametersError';
import Player from '../../lib/Player';
import {
  CordleCell,
  CordleGameState,
  CordleGuess,
  GameMove,
  PlayerID,
  CordlePlayerNumber,
  CordleDifficulty,
} from '../../types/CoveyTownSocket';
import Game from './Game';

// Helper to get the other player number
function getOtherPlayerNumber(number: CordlePlayerNumber): CordlePlayerNumber {
  if (number === 'Player2') {
    return 'Player1';
  }
  return 'Player2';
}

/**
 * This class is responsible for managing the logic of the Cordle game
 */
export default class CordleGame extends Game<CordleGameState, CordleGuess> {
  private _preferredPlayer1?: PlayerID;

  private _preferredPlayer2?: PlayerID;

  public constructor(priorGame?: CordleGame) {
    super({
      guesses: [],
      status: 'WAITING_FOR_PLAYERS',
      firstPlayer: getOtherPlayerNumber(priorGame?.state.firstPlayer || 'Player2'),
      cordle: undefined,
      guessesEvaluated: [],
      difficulty: undefined,
    });
    this._preferredPlayer1 = priorGame?.state.player1;
    this._preferredPlayer2 = priorGame?.state.player2;
  }

  /**
   * Joins a player to the game.
   * - Assigns the player to a player number (player1 or player2). If the player was in the prior game, then attempts
   * to reuse the same number if it is not in use. Otherwise, assigns the player to the first
   * available color (player1, then player2).
   * - If both players are now assigned, updates the game status to WAITING_TO_START.
   *
   * @throws InvalidParametersError if the player is already in the game (PLAYER_ALREADY_IN_GAME_MESSAGE)
   * @throws InvalidParametersError if the game is full (GAME_FULL_MESSAGE)
   *
   * @param player the player to join the game
   */
  protected _join(player: Player): void {
    if (this.state.player1 === player.id || this.state.player2 === player.id) {
      throw new InvalidParametersError(PLAYER_ALREADY_IN_GAME_MESSAGE);
    }
    if (this._preferredPlayer1 === player.id && !this.state.player1) {
      this.state = {
        ...this.state,
        status: 'WAITING_FOR_PLAYERS',
        player1: player.id,
      };
    } else if (this._preferredPlayer2 === player.id && !this.state.player2) {
      this.state = {
        ...this.state,
        status: 'WAITING_FOR_PLAYERS',
        player2: player.id,
      };
    } else if (!this.state.player1) {
      this.state = {
        ...this.state,
        status: 'WAITING_FOR_PLAYERS',
        player1: player.id,
      };
    } else if (!this.state.player2) {
      this.state = {
        ...this.state,
        status: 'WAITING_FOR_PLAYERS',
        player2: player.id,
      };
    } else {
      throw new InvalidParametersError(GAME_FULL_MESSAGE);
    }
    if (this.state.player1 && this.state.player2) {
      this.state.status = 'WAITING_TO_START';
    }
  }

  public startGame(player: Player): void {
    // Check if the game is ready to start
    if (this.state.status !== 'WAITING_TO_START') {
      throw new Error(GAME_NOT_STARTABLE_MESSAGE);
    }

    // Check if the player is in the game
    if (this.state.player1 !== player.id && this.state.player2 !== player.id) {
      throw new Error(PLAYER_NOT_IN_GAME_MESSAGE);
    }

    // Mark the player as ready
    if (this.state.player1 === player.id) {
      this.state.player1Ready = true;
    }
    if (this.state.player2 === player.id) {
      this.state.player2Ready = true;
    }
    // if none of the players from the last game are in this game, then the first player is red
    if (
      !(
        this._preferredPlayer1 === this.state.player1 ||
        this._preferredPlayer2 === this.state.player2
      )
    ) {
      this.state.firstPlayer = 'Player1';
    }

    if (this.state.player1 && this.state.player2) {
      const hardWordsFilePath = path.join(process.cwd(), 'src', 'town', 'games', 'hard_words.txt');
      const easyWordsFilePath = path.join(process.cwd(), 'src', 'town', 'games', 'easy_words.txt');
      const mediumWordsFilePath = path.join(
        process.cwd(),
        'src',
        'town',
        'games',
        'medium_words.txt',
      );
      if (
        (this.state.firstPlayer === 'Player1' && player.id === this.state.player1) ||
        (this.state.firstPlayer === 'Player2' && player.id === this.state.player2)
      ) {
        let selectedCordle = '';
        if (this.state.difficulty === ('Easy' as CordleDifficulty)) {
          selectedCordle = this._selectRandomWord(easyWordsFilePath);
        } else if (this.state.difficulty === ('Medium' as CordleDifficulty)) {
          selectedCordle = this._selectRandomWord(mediumWordsFilePath);
        } else if (this.state.difficulty === ('Hard' as CordleDifficulty)) {
          selectedCordle = this._selectRandomWord(hardWordsFilePath);
        }

        // If both players are ready, start the game
        this.state = {
          ...this.state,
          cordle: selectedCordle.toUpperCase(),
        };
      }
      // If both players are ready, start the game
      this.state = {
        ...this.state,
        status:
          this.state.player1Ready && this.state.player2Ready ? 'IN_PROGRESS' : 'WAITING_TO_START',
      };
    }
  }

  /**
   *
   * Updates the game's state to reflect the difficulty level.
   *
   * @param difficulty the difficulty level to set
   */
  public setDifficultyLevel(difficulty: CordleDifficulty): void {
    this.state = {
      ...this.state,
      difficulty,
    };
  }

  // Selects a random word from the given file
  private _selectRandomWord(filename: string): string {
    const fileContent = fs.readFileSync(filename, 'utf-8');
    const words = fileContent.trim().split('\n');
    const randomIndex = Math.floor(Math.random() * words.length);
    return words[randomIndex];
  }

  /**
   * Removes a player from the game.
   * Updates the game's state to reflect the player leaving.
   *
   * If the game state is currently "IN_PROGRESS", updates the game's status to OVER and sets the winner to the other player.
   *
   * If the game state is currently "WAITING_TO_START", updates the game's status to WAITING_FOR_PLAYERS.
   *
   * If the game state is currently "WAITING_FOR_PLAYERS" or "OVER", the game state is unchanged.
   *
   * @param player The player to remove from the game
   * @throws InvalidParametersError if the player is not in the game (PLAYER_NOT_IN_GAME_MESSAGE)
   */
  protected _leave(player: Player): void {
    if (this.state.status === 'OVER') {
      return;
    }
    const removePlayer = (playerID: string): CordlePlayerNumber => {
      if (this.state.player1 === playerID) {
        this.state = {
          ...this.state,
          player1: undefined,
          player1Ready: false,
        };
        return 'Player1';
      }
      if (this.state.player2 === playerID) {
        this.state = {
          ...this.state,
          player2: undefined,
          player2Ready: false,
        };
        return 'Player2';
      }
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    };
    const playerLeft = removePlayer(player.id);
    switch (this.state.status) {
      case 'WAITING_TO_START':
      case 'WAITING_FOR_PLAYERS':
        // no-ops: nothing needs to happen here
        this.state.status = 'WAITING_FOR_PLAYERS';
        break;
      case 'IN_PROGRESS':
        this.state = {
          ...this.state,
          status: 'OVER',
          winner: playerLeft === 'Player1' ? this.state.player2 : this.state.player1,
        };
        break;
      default:
        // This behavior can be undefined :)
        throw new Error(`Unexpected game status: ${this.state.status}`);
    }
  }

  /**
   *
   * Returns the next player who's turn it is to make a move.
   *
   * @returns the player number of the player whose turn it is
   */
  public whoseTurn(): CordlePlayerNumber {
    // A move is invalid if the player is not the current player
    let nextPlayer: CordlePlayerNumber;
    if (this.state.firstPlayer === 'Player1') {
      nextPlayer = this.state.guesses.length % 2 === 0 ? 'Player1' : 'Player2';
    } else {
      nextPlayer = this.state.guesses.length % 2 === 0 ? 'Player2' : 'Player1';
    }

    // Return the ID of the player whose turn it is
    return nextPlayer;
  }

  /**
   * Applies a move to the game.
   *
   * @param move The move to attempt to apply
   *
   * @throws InvalidParametersError if the game is not in progress (GAME_NOT_IN_PROGRESS_MESSAGE)
   * @throws INvalidParametersError if the move is not the player's turn (MOVE_NOT_YOUR_TURN_MESSAGE)
   *
   */
  public applyMove(move: GameMove<CordleGuess>): void {
    // Check if it's the player's turn
    if (this.state.status !== 'IN_PROGRESS') {
      throw new Error(GAME_NOT_IN_PROGRESS_MESSAGE);
    }

    let player: PlayerID | undefined;
    if (this.whoseTurn() === 'Player1') {
      player = this.state.player1;
    }
    if (this.whoseTurn() === 'Player2') {
      player = this.state.player2;
    }
    if (move.move.player !== player) {
      throw new Error(MOVE_NOT_YOUR_TURN_MESSAGE);
    }

    // Apply the guess
    this._applyGuess(move.move);
  }

  /**
   * Applies guess to the game state and updates the game state accordingly.
   * Adds the guess to the list of guesses and initializes an array to hold the colors of the letters in the guess.
   * If the letter is not in the word at all, the cell color is set to gray.
   * If the letter is in the word but not in the correct position, the cell color is set to yellow.
   * If the letter is in the correct position, the cell color is set to green.
   * @param guess the guess to be applied
   */
  protected _applyGuess(guess: CordleGuess): void {
    // Add the guess to the list of guesses
    this.state.guesses = [...this.state.guesses, guess];

    // Initialize an array to hold the colors of the letters in the guess
    const guessColors: CordleCell[] = [];

    // Create a copy of the cordle word to keep track of the letters that have been correctly guessed
    const cordleCopy = (this.state.cordle ?? '').split('');

    // Check each letter in the guess.
    for (let i = 0; i < guess.guessedWord.length; i++) {
      if (guess.guessedWord[i] === cordleCopy[i]) {
        // If the letter is in the correct position, set it to green
        guessColors[i] = 'Green';
        // Remove the correctly guessed letter from the cordle copy
        cordleCopy[i] = '';
      } else {
        guessColors[i] = 'Gray';
      }
    }

    // Check for yellow cells
    for (let i = 0; i < guess.guessedWord.length; i++) {
      if (guessColors[i] === 'Gray') {
        const indexInCordle = cordleCopy.indexOf(guess.guessedWord[i]);
        if (indexInCordle !== -1) {
          // If the letter is in the word but in the wrong position, set it to yellow
          guessColors[i] = 'Yellow';
          // Remove the letter from the cordle copy
          cordleCopy[indexInCordle] = '';
        }
      }
    }

    // Update the correct row in the guessesEvaluated array
    this.state.guessesEvaluated[guess.guessNumber - 1] = guessColors;

    // If all letters are in the correct position, update the game status and set the winner
    if (guessColors.every(color => color === 'Green')) {
      this.state.status = 'OVER';
      this.state.winner = guess.player;
    }

    // Check if the maximum number of attempts has been reached
    if (this.state.guesses.length >= 6 && !this.state.winner) {
      this.state.status = 'OVER';
      this.state.winner = 'DRAW';
    }
  }
}
