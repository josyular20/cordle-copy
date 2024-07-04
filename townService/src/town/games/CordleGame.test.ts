// import mockFs from 'mock-fs';
import {
  GAME_FULL_MESSAGE,
  GAME_NOT_IN_PROGRESS_MESSAGE,
  GAME_NOT_STARTABLE_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
} from '../../lib/InvalidParametersError';
import { createPlayerForTesting } from '../../TestUtils';
import { CordleGuess, CordleGuessNumber } from '../../types/CoveyTownSocket';
import CordleGame from './CordleGame';

describe('CordleGame', () => {
  let game: CordleGame;
  beforeEach(() => {
    game = new CordleGame();
  });
  describe('_join', () => {
    it('should add the player as player1 if player1 is empty', () => {
      const player1 = createPlayerForTesting();
      game.join(player1);
      expect(game.state.player1).toBe(player1.id);
      expect(game.state.player2).toBeUndefined();
    });
    it('should add the player as player2 if player1 is not empty and player2 is empty', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      expect(game.state.player1).toBe(player1.id);
      expect(game.state.player2).toBe(player2.id);
    });
    it('should throw an error when attempting to add players when the game is already in progress', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      const player3 = createPlayerForTesting();
      expect(() => game.join(player3)).toThrowError(GAME_FULL_MESSAGE);
    });

    it('should allow a new player to join after the game is full but one player leaves', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      const player3 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.leave(player2);
      game.join(player3);
      expect(game.state.player1).toBe(player1.id);
      expect(game.state.player2).toBe(player3.id);
    });
    it('should throw an error if the game is already full', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      const player3 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      expect(() => game.join(player3)).toThrowError(GAME_FULL_MESSAGE);
    });
  });
  describe('startGame', () => {
    it('should throw an error if the status is not WAITING_TO_START', () => {
      const player = createPlayerForTesting();
      game.join(player);
      expect(() => game.startGame(player)).toThrowError(GAME_NOT_STARTABLE_MESSAGE);
    });
    it('should throw an error if the player is not in the game', () => {
      game.join(createPlayerForTesting());
      game.join(createPlayerForTesting());
      expect(() => game.startGame(createPlayerForTesting())).toThrowError(
        PLAYER_NOT_IN_GAME_MESSAGE,
      );
    });
    // it('should start the game with different difficulty levels', () => {
    //   const player1 = createPlayerForTesting();
    //   const player2 = createPlayerForTesting();
    //   game.join(player1);
    //   game.join(player2);
    //   game.state.difficulty = 'Medium';

    //   // Mock the file system
    //   mockFs({
    //     'medium_words.txt': 'testWord',
    //   });

    //   game.startGame(player1);
    //   game.startGame(player2);
    //   expect(game.state.status).toBe('IN_PROGRESS');

    //   // Restore the file system after the test
    //   mockFs.restore();
    // });

    it('should not start the game with only one player ready', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.state.player1Ready = true;
      game.startGame(player1);
      expect(game.state.status).not.toBe('IN_PROGRESS');
    });
    it('should throw an error if starting the game with undefined difficulty settings', () => {
      const player1 = createPlayerForTesting();
      game.join(player1);

      // Attempt to start the game without setting the difficulty
      expect(() => game.startGame(player1)).toThrowError(GAME_NOT_STARTABLE_MESSAGE);

      // Set an incorrect difficulty setting and attempt to start the game
      game.state.difficulty = undefined;
      expect(() => game.startGame(player1)).toThrowError(GAME_NOT_STARTABLE_MESSAGE);
    });
    describe('if the player is in the game', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      beforeEach(() => {
        game.join(player1);
        game.join(player2);
      });
      it('if the player is player1, it sets player1Ready to true', () => {
        game.startGame(player1);
        expect(game.state.player1Ready).toBe(true);
        expect(game.state.player2Ready).toBeFalsy();
        expect(game.state.status).toBe('WAITING_TO_START');
      });
      it('if the player is player2, it sets player2Ready to true', () => {
        game.startGame(player2);
        expect(game.state.player1Ready).toBeFalsy();
        expect(game.state.player2Ready).toBe(true);
        expect(game.state.status).toBe('WAITING_TO_START');
      });
      it('if both players are ready, it sets the status to IN_PROGRESS', () => {
        game.startGame(player1);
        game.startGame(player2);
        expect(game.state.player1Ready).toBe(true);
        expect(game.state.player2Ready).toBe(true);
        expect(game.state.status).toBe('IN_PROGRESS');
      });
      it('if a player already reported ready, it does not change the status or throw an error', () => {
        game.startGame(player1);
        game.startGame(player1);
        expect(game.state.player1Ready).toBe(true);
        expect(game.state.player2Ready).toBeFalsy();
        expect(game.state.status).toBe('WAITING_TO_START');
      });
      it('if there are not any players from a prior game, it always sets the first player to player1 when the game starts', () => {
        // create conditions where the first player *would* be player1
        game.startGame(player1);
        game.startGame(player2);
        game.leave(player1);
        expect(game.state.status).toBe('OVER');

        const secondGame = new CordleGame(game);
        secondGame.join(player1);
        expect(secondGame.state.player1).toBe(player1.id);
        const newPlayer2 = createPlayerForTesting();
        secondGame.join(newPlayer2);
        expect(secondGame.state.player2).toBe(newPlayer2.id);
        secondGame.leave(player1);

        // Now, there are no longer players from the last game.
        const newPlayer1 = createPlayerForTesting();
        secondGame.join(newPlayer1);
        secondGame.startGame(newPlayer2);
        secondGame.startGame(newPlayer1);
        expect(secondGame.state.firstPlayer).toBe('Player1');
      });
      it('if there are players from a prior game, it sets the first player to the player who was not first in the last game', () => {
        game.startGame(player1);
        game.startGame(player2);
        game.leave(player1);

        const secondGame = new CordleGame(game);
        const newPlayer1 = createPlayerForTesting();
        secondGame.join(newPlayer1);
        secondGame.join(player2);
        secondGame.startGame(newPlayer1);
        secondGame.startGame(player2);
        expect(secondGame.state.firstPlayer).toBe('Player2');
      });
    });
  });
  describe('_leave', () => {
    it('should remove the player from the game', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.leave(player1);
      expect(game.state.player1).toBeUndefined();
      expect(game.state.player2).toBe(player2.id);
    });
    it('should allow players to leave the game when it is in different states', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      // Test leaving the game when it's in progress
      game.leave(player1);
      expect(game.state.player1).toBeUndefined();
      expect(game.state.player2).toBe(player2.id);
      // Test leaving the game when it's already over
      game.leave(player2);
      expect(game.state.player2).toBeUndefined();
    });
    it('should mark the correct player as the winner when a player leaves during the game', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      game.leave(player1);
      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe(player2.id);
    });
    it('should throw an error if the player is not in the game', () => {
      const player = createPlayerForTesting();
      expect(() => game.leave(player)).toThrowError(PLAYER_NOT_IN_GAME_MESSAGE);
    });
  });
  describe('whoseTurn', () => {
    it('should return the player whose turn it is', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      expect(game.whoseTurn()).toBe('Player1');
    });
    it('should correctly determine the current player even when the game is over', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      // Simulate the game being over
      game.state.status = 'OVER';
      expect(game.whoseTurn()).toBe('Player1'); // It should still return Player1
    });
    it('should return the correct player whose turn it is after multiple moves from different players', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      game.applyMove({
        gameID: game.id,
        move: { guessedWord: 'cordl', player: player1.id, guessNumber: 1 },
        playerID: player1.id,
      });
      expect(game.whoseTurn()).toBe('Player2');
    });
  });
  describe('applyMove', () => {
    it('should throw an error if the game is not in progress', () => {
      const player = createPlayerForTesting();
      game.join(player);
      expect(() =>
        game.applyMove({
          gameID: game.id,
          move: { guessedWord: 'cordl', player: 'Player1', guessNumber: 1 },
          playerID: player.id,
        }),
      ).toThrowError(GAME_NOT_IN_PROGRESS_MESSAGE);
    });
    it("should throw an error if it is not the player's turn", () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      const notTurnPlayer = game.state.firstPlayer === 'Player1' ? 'Player2' : 'Player1';
      expect(() =>
        game.applyMove({
          gameID: game.id,
          move: { guessedWord: 'cordl', player: notTurnPlayer, guessNumber: 1 },
          playerID: notTurnPlayer === 'Player1' ? player1.id : player2.id,
        }),
      ).toThrowError(MOVE_NOT_YOUR_TURN_MESSAGE);
    });
    it('should correctly update the guess colors based on the guessed word and the cordle word', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      game.state.cordle = 'cordl';
      const guess: CordleGuess = {
        player: player1.id,
        guessedWord: 'coldx', // Correct guess: 2 letters in the correct position, 2 letters in the wrong position
        guessNumber: 1,
      };
      game.applyMove({
        gameID: game.id,
        move: guess,
        playerID: player1.id,
      });
      expect(game.state.guessesEvaluated[guess.guessNumber - 1]).toEqual([
        'Green',
        'Green',
        'Yellow',
        'Green',
        'Gray',
      ]);
    });

    it('should correctly update the guess number in the game state', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      const guess: CordleGuess = {
        player: player1.id,
        guessedWord: 'cordle',
        guessNumber: 1,
      };
      game.applyMove({
        gameID: game.id,
        move: guess,
        playerID: player1.id,
      });
      expect(game.state.guesses[0].guessNumber).toBe(1);
    });

    it('should correctly determine the winner as DRAW if maximum attempts are reached and no winner is found', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      // Simulate maximum attempts without any winner
      for (let i = 0; i < 6; i++) {
        const playerID = game.whoseTurn() === 'Player1' ? player1.id : player2.id;
        game.applyMove({
          gameID: game.id,
          move: {
            guessedWord: 'wrong',
            player: playerID,
            guessNumber: (i + 1) as CordleGuessNumber,
          },
          playerID,
        });
      }
      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe('DRAW');
    });

    it("should set the game status to 'OVER' and the winner to 'DRAW' if the maximum number of attempts has been reached and there's no winner", () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      // Simulate the maximum number of attempts
      for (let i = 0; i < 6; i++) {
        // Determine whose turn it is
        const turnPlayer = game.whoseTurn() === 'Player1' ? player1.id : player2.id;
        game.applyMove({
          gameID: game.id,
          move: {
            guessedWord: 'wrong',
            player: turnPlayer,
            guessNumber: (i + 1) as CordleGuessNumber,
          },
          playerID: turnPlayer,
        });
      }
      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe('DRAW');
    });
    it('should correctly apply a guess and update the game state', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      const guess: CordleGuess = {
        player: player1.id,
        guessedWord: 'wrong',
        guessNumber: 1,
      };
      game.applyMove({
        gameID: game.id,
        move: guess,
        playerID: player1.id,
      });
      expect(game.state.guesses).toContain(guess);
      expect(game.state.guessesEvaluated[guess.guessNumber - 1]).toBeDefined();
    });
    it('should set the game status to OVER and the winner to the current player if all letters are in the correct position', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      const guess: CordleGuess = {
        player: player1.id,
        guessedWord: game.state.cordle || '', // guessing the correct word
        guessNumber: 1,
      };
      game.applyMove({
        gameID: game.id,
        move: guess,
        playerID: player1.id,
      });
      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe(guess.player);
    });
    it('should set the cell color to green if the letter is in the correct position', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      const guess: CordleGuess = {
        player: player1.id,
        guessedWord: game.state.cordle || '', // guessing the correct word
        guessNumber: 1,
      };
      game.applyMove({
        gameID: game.id,
        move: guess,
        playerID: player1.id,
      });
      // All cells should be green because the guessed word is correct
      expect(game.state.guessesEvaluated[guess.guessNumber - 1]).toEqual(
        Array(guess.guessedWord.length).fill('Green'),
      );
    });
    it('should set the cell color to yellow if the letter is in the word but not in the correct position', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      game.state.cordle = 'cordl';
      // Create a guess where each letter is in the word but not in the correct position
      const guessedWord = 'llllc';
      const guess: CordleGuess = {
        player: player1.id,
        guessedWord,
        guessNumber: 1,
      };
      game.applyMove({
        gameID: game.id,
        move: guess,
        playerID: player1.id,
      });
      expect(game.state.guessesEvaluated[guess.guessNumber - 1]).toEqual([
        'Yellow',
        'Gray',
        'Gray',
        'Gray',
        'Yellow',
      ]);
    });
    it('should set the cell color to gray if the letter is not in the word at all', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      game.state.cordle = 'cordl';
      const guess: CordleGuess = {
        player: player1.id,
        guessedWord: 'aaaaa', // guessing a word that does not contain any letters from the cordle
        guessNumber: 1,
      };
      game.applyMove({
        gameID: game.id,
        move: guess,
        playerID: player1.id,
      });
      // All cells should be gray because none of the guessed letters are in the cordle
      expect(game.state.guessesEvaluated[guess.guessNumber - 1]).toEqual(
        Array(guess.guessedWord.length).fill('Gray'),
      );
    });
    it('should set the first T to yellow and the second T to gray when the secret word is SATIN and the guess is TOOTH', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);
      // Set the cordle to 'SATIN'
      game.state.cordle = 'SATIN';
      const guess: CordleGuess = {
        player: player1.id,
        guessedWord: 'TOOTH', // guessing 'TOOTH'
        guessNumber: 1,
      };
      game.applyMove({
        gameID: game.id,
        move: guess,
        playerID: player1.id,
      });
      // The first T should be yellow and the second T should be gray
      expect(game.state.guessesEvaluated[guess.guessNumber - 1]).toEqual([
        'Yellow',
        'Gray',
        'Gray',
        'Gray',
        'Gray',
      ]);
    });
    it('should correctly handle multiple consecutive moves from different players', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);

      // Apply multiple consecutive moves from different players
      game.applyMove({
        gameID: game.id,
        move: { guessedWord: 'cordl', player: player1.id, guessNumber: 1 },
        playerID: player1.id,
      });
      expect(game.whoseTurn()).toBe('Player2');

      game.applyMove({
        gameID: game.id,
        move: { guessedWord: 'board', player: player2.id, guessNumber: 2 },
        playerID: player2.id,
      });
      expect(game.whoseTurn()).toBe('Player1');
    });

    it('should correctly handle the case when the game ends in a draw', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);

      // Simulate the game ending in a draw
      for (let i = 0; i < 6; i++) {
        const turnPlayer = game.whoseTurn() === 'Player1' ? player1.id : player2.id;
        game.applyMove({
          gameID: game.id,
          move: {
            guessedWord: 'wrong',
            player: turnPlayer,
            guessNumber: (i + 1) as CordleGuessNumber,
          },
          playerID: turnPlayer === 'Player1' ? player1.id : player2.id,
        });
      }
      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe('DRAW');
    });

    it('should correctly handle the case when a player wins the game', () => {
      const player1 = createPlayerForTesting();
      const player2 = createPlayerForTesting();
      game.join(player1);
      game.join(player2);
      game.startGame(player1);
      game.startGame(player2);

      // Simulate a player winning the game
      const guess: CordleGuess = {
        player: player1.id,
        guessedWord: game.state.cordle || '', // guessing the correct word
        guessNumber: 1,
      };
      game.applyMove({
        gameID: game.id,
        move: guess,
        playerID: player1.id,
      });
      expect(game.state.status).toBe('OVER');
      expect(game.state.winner).toBe(guess.player);
    });
  });
});
