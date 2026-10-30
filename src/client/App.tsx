import { ConnectionBanner, MuteButton, Toast } from './components/Chrome';
import { Scoreboard } from './components/Scoreboard';
import { SoloPanel } from './components/SoloPanel';
import { Game } from './screens/Game';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Results } from './screens/Results';
import { Setup } from './screens/Setup';
import { useStore } from './state/store';

function Screen() {
  const session = useStore((s) => s.session);
  const room = useStore((s) => s.room);
  const setup = useStore((s) => s.setup);

  if (session && room?.code === session.code) {
    const meId = session.playerId;
    const content =
      room.phase === 'lobby' ? (
        <Lobby room={room} meId={meId} />
      ) : room.phase === 'results' ? (
        <Results room={room} meId={meId} />
      ) : (
        <Game room={room} meId={meId} />
      );
    return (
      <div className={`room-layout phase-${room.phase}${room.solo ? ' solo' : ''}`}>
        {content}
        {room.solo
          ? room.phase !== 'results' && <SoloPanel room={room} meId={meId} />
          : room.phase !== 'lobby' && <Scoreboard room={room} meId={meId} />}
      </div>
    );
  }
  if (session) return <main className="loading">Rejoining your room…</main>;
  if (setup) return <Setup mode={setup} />;
  return <Home />;
}

export function App() {
  return (
    <div className="app">
      <MuteButton />
      <ConnectionBanner />
      <Screen />
      <Toast />
    </div>
  );
}
