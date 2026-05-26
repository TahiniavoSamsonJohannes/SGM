interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export default function Input({ label, ...props }: Props) {
    return (
        <div>
            {label && (
                <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
            )}
            <input
                {...props}
                className="w-full bg-navy-800 border border-navy-600 rounded-lg px-3 py-2 text-sm
          text-slate-200 placeholder-slate-500 focus:outline-none focus:border-ocean-500
          focus:ring-1 focus:ring-ocean-500 transition"
            />
        </div>
    );
}