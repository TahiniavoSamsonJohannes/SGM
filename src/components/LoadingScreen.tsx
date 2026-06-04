import rudderUrl from '../assets/rudder.png';

interface Props {
    message?: string;
}

export default function LoadingScreen({ message }: Props) {
    return (
        <div className="min-h-screen bg-navy-900 flex flex-col items-center
      justify-center gap-6 fade-in">

            {/* Image gouvernail en rotation */}
            <img
                src={rudderUrl}
                alt="Chargement..."
                className="w-20 h-20 object-contain saturate-200 opacity-80"
                style={{
                    animation: 'spin 2s linear infinite',
                }}
            />

            {/* Message optionnel */}
            {message && (
                <p className="text-slate-400 text-sm animate-pulse tracking-wide">
                    {message}
                </p>
            )}
        </div>
    );
}