import { useParams } from 'react-router-dom';

const PlayerPage = () => {
    const { playerId } = useParams();
    return (
        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute p-12 text-center">
            Player page coming · id <span className="tnum">{playerId}</span>
        </div>
    );
};

export default PlayerPage;
