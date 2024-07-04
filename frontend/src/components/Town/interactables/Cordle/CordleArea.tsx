import {
  Button,
  chakra,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  useToast,
} from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import CordleAreaController from '../../../../classes/interactable/CordleAreaController';
import PlayerController from '../../../../classes/PlayerController';
import { useInteractableAreaController } from '../../../../classes/TownController';
import useTownController from '../../../../hooks/useTownController';
import {
  CordleDifficulty,
  CordlePlayerNumber,
  GameStatus,
  InteractableID,
} from '../../../../types/CoveyTownSocket';
import CordleBoard from './CordleBoard';

const StyledToolTipButton = chakra(Button, {
  baseStyle: {
    size: 'sm',
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    marginRight: '2rem',
  },
});

/**
 * The CordleArea component renders the Cordle game area.
 * It renders the current state of the area, optionally allowing the player to join the game.
 *
 * It uses Chakra-UI components (does not use other GUI widgets)
 *
 * It uses the CordleAreaController to get the current state of the game.
 * It listens for the 'gameUpdated' and 'gameEnd' events on the controller, and re-renders accordingly.
 * It subscribes to these events when the component mounts, and unsubscribes when the component unmounts. It also unsubscribes when the gameAreaController changes.
 *
 * It renders the following:
 * - A list of players' usernames (in a list with the aria-label 'list of players in the game', one item for player1 and one for player2)
 *    - If there is no player in the game, the username is '(No player yet!)'
 *    - List the players as (exactly) `Player1: ${username}` and `Player2: ${username}`
 * - A message indicating the current game status:
 *    - If the game is in progress, the message is 'Game in progress, {moveCount} moves in, currently {whoseTurn}'s turn'. If it is currently our player's turn, the message is 'Game in progress, {moveCount} moves in, currently your turn'
 *    - If the game is in status WAITING_FOR_PLAYERS, the message is 'Waiting for players to join'
 *    - If the game is in status WAITING_TO_START, the message is 'Waiting for players to press start'
 *    - If the game is in status OVER, the message is 'Game over'
 * - If the game is in status WAITING_FOR_PLAYERS or OVER, a button to join the game is displayed, with the text 'Join New Game'
 *    - Clicking the button calls the joinGame method on the gameAreaController
 *    - Before calling joinGame method, the button is disabled and has the property isLoading set to true, and is re-enabled when the method call completes
 *    - If the method call fails, a toast is displayed with the error message as the description of the toast (and status 'error')
 *    - Once the player joins the game, the button dissapears
 * - If the game is in status WAITING_TO_START, a button to start the game is displayed, with the text 'Start Game'
 *    - Clicking the button calls the startGame method on the gameAreaController
 *    - Before calling startGame method, the button is disabled and has the property isLoading set to true, and is re-enabled when the method call completes
 *    - If the method call fails, a toast is displayed with the error message as the description of the toast (and status 'error')
 *    - Once the game starts, the button dissapears
 * - The CordleBoard component, which is passed the current gameAreaController as a prop (@see CordleBoard.tsx)
 *
 * - When the game ends, a toast is displayed with the result of the game:
 *    - Tie: description 'Game ended in a tie'
 *    - Our player won: description 'You won!'
 *    - Our player lost: description 'You lost :('
 *
 */
export default function CordleArea({
  interactableID,
}: {
  interactableID: InteractableID;
}): JSX.Element {
  const gameAreaController = useInteractableAreaController<CordleAreaController>(interactableID);
  const townController = useTownController();

  const [player1, setPlayer1] = useState<PlayerController | undefined>(gameAreaController.player1);
  const [player2, setPlayer2] = useState<PlayerController | undefined>(gameAreaController.player2);
  const [joiningGame, setJoiningGame] = useState(false);
  const [displayDifficultySelector, setDisplayDifficultySelector] = useState(true);
  const [difficulty, setDifficulty] = useState('');
  const [firstPlayer, setFirstPlayer] = useState<CordlePlayerNumber | undefined>(
    gameAreaController.firstPlayer,
  );
  const [gameStatus, setGameStatus] = useState<GameStatus>(gameAreaController.status);
  const [guessCount, setGuessCount] = useState<number>(gameAreaController.guessCount);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const toast = useToast();
  useEffect(() => {
    const updateGameState = () => {
      setPlayer1(gameAreaController.player1);
      setPlayer2(gameAreaController.player2);
      setGameStatus(gameAreaController.status);
      setGuessCount(gameAreaController.guessCount || 0);
      setFirstPlayer(gameAreaController.firstPlayer);
    };
    const onGameEnd = () => {
      const winner = gameAreaController.winner;
      if (!winner) {
        toast({
          title: 'Game over',
          description: `You did not guess the word in 6 tries. The word is ${gameAreaController.cordle}`,
          status: 'info',
        });
      } else {
        toast({
          title: 'Game over',
          description: `${winner.userName} made the final guess!`,
          status: 'success',
        });
      }

      setDisplayDifficultySelector(true);
    };
    gameAreaController.addListener('gameUpdated', updateGameState);
    gameAreaController.addListener('gameEnd', onGameEnd);
    return () => {
      gameAreaController.removeListener('gameUpdated', updateGameState);
      gameAreaController.removeListener('gameEnd', onGameEnd);
    };
  }, [townController, gameAreaController, toast]);
  let gameStatusText = <></>;
  if (gameStatus === 'IN_PROGRESS') {
    gameStatusText = (
      <>
        Game in progress, {guessCount} moves in, currently{' '}
        {gameAreaController.whoseTurn === townController.ourPlayer
          ? 'your'
          : gameAreaController.whoseTurn?.userName + "'s"}{' '}
        turn{' '}
        {townController.ourPlayer === gameAreaController.player2
          ? "(You're Player 2)"
          : "(You're Player 1)"}
      </>
    );
  } else if (gameStatus == 'WAITING_TO_START') {
    const p1 = firstPlayer === 'Player1' ? player1 : player2;
    if (displayDifficultySelector && townController.ourPlayer.id === p1?.id) {
      const difficultySelector = (
        <div>
          <Button
            onClick={async () => {
              setDisplayDifficultySelector(false);
              setDifficulty('Easy');
            }}>
            Easy
          </Button>
          <Button
            onClick={async () => {
              setDisplayDifficultySelector(false);
              setDifficulty('Medium');
            }}>
            Medium
          </Button>
          <Button
            onClick={async () => {
              setDisplayDifficultySelector(false);
              setDifficulty('Hard');
            }}>
            Hard
          </Button>
        </div>
      );
      gameStatusText = <b>Waiting for players to select difficulty. {difficultySelector}</b>;
    } else {
      const startGameButton = (
        <Button
          onClick={async () => {
            setJoiningGame(true);
            try {
              await gameAreaController.startGame(difficulty as CordleDifficulty);
            } catch (err) {
              toast({
                title: 'Error starting game',
                description: (err as Error).toString(),
                status: 'error',
              });
            }
            setJoiningGame(false);
          }}
          isLoading={joiningGame}
          disabled={joiningGame}>
          Start Game
        </Button>
      );
      gameStatusText = <b>Waiting for players to press start. {startGameButton}</b>;
    }
  } else {
    const joinGameButton = (
      <Button
        onClick={async () => {
          setJoiningGame(true);
          try {
            await gameAreaController.joinGame();
          } catch (err) {
            toast({
              title: 'Error joining game',
              description: (err as Error).toString(),
              status: 'error',
            });
          }
          setJoiningGame(false);
        }}
        isLoading={joiningGame}
        disabled={joiningGame}>
        Join New Game
      </Button>
    );
    let gameStatusStr;
    if (gameStatus === 'OVER') {
      gameStatusStr = 'over';
    } else if (gameStatus === 'WAITING_FOR_PLAYERS') gameStatusStr = 'waiting for players to join';
    gameStatusText = (
      <b>
        Game {gameStatusStr}. {joinGameButton}
      </b>
    );
  }
  return (
    <>
      {gameStatusText}
      <StyledToolTipButton onClick={() => setIsTooltipOpen(true)}>How to Play</StyledToolTipButton>
      <Modal isOpen={isTooltipOpen} onClose={() => setIsTooltipOpen(false)}>
        <ModalOverlay />
        <ModalContent borderRadius='md' bg='white' p={4}>
          <ModalHeader textAlign='center' fontSize='xl' fontWeight='bold'>
            How to Play
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <p>Select a difficulty level to start the game (easy, medium, hard).</p>
            <br />
            <p>Each guess must be a valid five-letter word.</p>
            <br />
            <p>The color of a tile changes to indicate the correctness of your guess:</p>
            <br />
            <ul>
              <li>
                <b>Green:</b> Correct letter in the correct spot.
              </li>
              <li>
                <b>Yellow:</b> Correct letter, but in the wrong spot.
              </li>
              <li>
                <b>Gray:</b> Incorrect letter.
              </li>
            </ul>
            <br />
            <p>
              You have six attempts to guess the word correctly. Players can decide to do this
              either cooperatively or competitively.
            </p>
          </ModalBody>
        </ModalContent>
      </Modal>
      <List aria-label='list of players in the game'>
        <ListItem>Player1: {player1?.userName || '(No player yet!)'}</ListItem>
        <ListItem>Player2: {player2?.userName || '(No player yet!)'}</ListItem>
      </List>
      <CordleBoard gameAreaController={gameAreaController} />
    </>
  );
}
