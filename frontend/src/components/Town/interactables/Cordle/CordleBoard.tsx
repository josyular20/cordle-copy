import CordleAreaController from '../../../../classes/interactable/CordleAreaController';
import { chakra, Container, useToast } from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import { CordleGuess, CordleCell } from '../../../../types/CoveyTownSocket';

export type CordleGameProps = {
  gameAreaController: CordleAreaController;
};
const StyledCordleBoard = chakra(Container, {
  baseStyle: {
    display: 'flex',
    width: '350px',
    height: '350px',
    padding: '5px',
    flexWrap: 'wrap',
  },
});
const StyledCordleSquare = chakra('div', {
  baseStyle: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexBasis: '16%',
    border: '1px solid black',
    height: '14%',
    fontSize: '40px',
    marginRight: '5px',
    marginBottom: '5px',
  },
});
/**
 * A component that renders the Cordle board
 *
 * Renders the Cordle board as a "StyledCordleBoard", which consists of "StyledCordleSquare"s
 * (one for each cell in the board, starting from the top left and going left to right, top to bottom).
 *
 * Each StyledCordleSquare has an aria-label property that describes the cell's position in the board,
 * formatted as `Cell ${rowIndex},${colIndex} (Green|Yellow|Gray)`.
 *
 * The background color of each StyledCordleSquare is determined by the value of the cell in the board, either
 * 'Green', 'Yellow', or 'Gray'.
 *
 * The board is re-rendered whenever the board changes.
 *
 * If the current player is in the game, then the CordleBoard is clickable, and clicking
 * on it will allow the player to make a guess. If there is an error making the move, then a toast will be
 * displayed with the error message as the description of the toast. If it is not the current player's
 * turn, then the CordleBoard will be disabled.
 *
 * @param gameAreaController the controller for the Cordle game
 */
export default function CordleBoard({ gameAreaController }: CordleGameProps): JSX.Element {
  const [board, setBoard] = useState<CordleCell[][]>(gameAreaController.guessesEvaluated);
  const [guesses, setGuesses] = useState<CordleGuess[]>(gameAreaController.board);
  const [isOurTurn, setIsOurTurn] = useState(gameAreaController.isOurTurn);
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const toast = useToast();
  useEffect(() => {
    const updateBoard = (
      updatesGuesses: CordleGuess[],
      updatesGuessesEvaluated: CordleCell[][],
    ) => {
      setGuesses(updatesGuesses);
      setBoard(updatesGuessesEvaluated);
    };

    gameAreaController.addListener('turnChanged', setIsOurTurn);
    gameAreaController.addListener('boardChanged', updateBoard);
    return () => {
      gameAreaController.removeListener('boardChanged', updateBoard);
      gameAreaController.removeListener('turnChanged', setIsOurTurn);
    };
  }, [gameAreaController]);

  // handle user keyboard input for making a guess or submitting it for verification
  const userInput = async (event: React.KeyboardEvent<HTMLDivElement>) => {
    const { key } = event;
    if (!isOurTurn) return;

    // check if the key is a letter and update the current guess
    if (/^[a-zA-Z]$/.test(key) && currentGuess.length < 5) {
      setCurrentGuess(prevInput => prevInput + key.toUpperCase());
    }

    if (key === 'Backspace') setCurrentGuess(currentGuess.slice(0, -1));

    if (key === 'Enter') {
      try {
        await gameAreaController.makeMove(currentGuess);
        setCurrentGuess('');
      } catch (e) {
        toast({
          title: 'Error making move',
          description: (e as Error).toString(),
          status: 'error',
        });
      }
    }
  };

  // get the letter in the finalized guesses or current guess for the given row and column
  const letterInGuess = (rowIndex: number, colIndex: number): string => {
    const currentRow = guesses.findIndex(guess => guess === undefined);
    if (guesses[rowIndex]) {
      return guesses[rowIndex].guessedWord[colIndex];
    } else if (rowIndex === currentRow) {
      return currentGuess[colIndex];
    }
    return '';
  };

  return (
    <StyledCordleBoard aria-label='Cordle Board' onKeyDown={userInput} tabIndex={0}>
      {board.map((row, rowIndex) => {
        return row.map((cell, colIndex) => {
          return (
            <StyledCordleSquare
              key={`${rowIndex}.${colIndex}`}
              backgroundColor={cell ? cell : 'white'}
              aria-label={`Cell ${rowIndex},${colIndex} (${cell || 'Empty'})`}>
              {letterInGuess(rowIndex, colIndex)}
            </StyledCordleSquare>
          );
        });
      })}
    </StyledCordleBoard>
  );
}
