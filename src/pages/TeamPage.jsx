import { useParams } from 'react-router-dom';

const TeamPage = () => {
    const { rosterId } = useParams();
    return (
        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute p-12 text-center">
            Team page coming · roster <span className="tnum">{rosterId}</span>
        </div>
    );
};

export default TeamPage;
