import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import rudderUrl from '../assets/rudder.png';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

interface Props {
    url: string;
}

// Scale de base × devicePixelRatio pour la netteté
const BASE_SCALE = 1.5;

export default function PdfViewer({ url }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    // zoom CSS uniquement — pas de re-render du PDF
    const [zoom, setZoom] = useState(1);
    const renderingRef = useRef(false);

    // ── Rendu PDF
    useEffect(() => {
        if (!url) return;
        if (renderingRef.current) return;
        renderingRef.current = true;

        let cancelled = false;

        setLoading(true);
        setError('');
        setZoom(1);

        // Vider les canvas précédents
        if (containerRef.current) containerRef.current.innerHTML = '';

        async function renderPDF() {
            try {
                const response = await fetch(url);
                if (cancelled) return;

                const arrayBuffer = await response.arrayBuffer();
                if (cancelled) return;

                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                if (cancelled) return;

                // devicePixelRatio pour rendu haute résolution
                const dpr = window.devicePixelRatio || 1;
                const scale = BASE_SCALE * dpr;

                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    if (cancelled) return;

                    const page = await pdf.getPage(pageNum);
                    if (cancelled) return;

                    // Viewport à scale élevé pour la résolution physique
                    const viewport = page.getViewport({ scale });

                    const canvas = document.createElement('canvas');
                    // Taille physique du canvas (haute résolution)
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    // Taille CSS affichée (divisée par dpr → même taille visuelle)
                    canvas.style.width = `${viewport.width / dpr}px`;
                    canvas.style.height = `${viewport.height / dpr}px`;
                    canvas.style.display = 'block';
                    canvas.style.marginBottom = '8px';
                    canvas.style.background = 'white';
                    canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

                    const ctx = canvas.getContext('2d')!;

                    if (containerRef.current && !cancelled) {
                        containerRef.current.appendChild(canvas);
                    }

                    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
                    if (cancelled) return;
                }

                if (!cancelled) setLoading(false);

            } catch (err) {
                console.error('PdfViewer error:', err);
                if (!cancelled) {
                    setError('Impossible de charger le PDF');
                    setLoading(false);
                }
            } finally {
                if (!cancelled) renderingRef.current = false;
            }
        }

        renderPDF();

        return () => {
            cancelled = true;
            renderingRef.current = false;
        };
    }, [url]); // ← url seulement, pas zoom

    // ── Contrôles zoom ────────────────────────────────────────────
    const zoomIn = useCallback(() => setZoom(z => Math.min(2, +(z + 0.25).toFixed(2))), []);
    const zoomOut = useCallback(() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2))), []);
    const zoomReset = useCallback(() => setZoom(1), []);

    return (
        <div className="flex flex-col h-full bg-slate-700">

            {/* ── Barre de zoom ── */}
            <div className="flex items-center justify-center gap-3 px-4 py-2
        bg-navy-800 border-b border-navy-700 flex-shrink-0">
                <button
                    onClick={zoomOut}
                    disabled={zoom <= 0.5}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white
            hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed
            transition"
                    title="Réduire"
                >
                    <ZoomOut size={16} />
                </button>

                <button
                    onClick={zoomReset}
                    className="px-3 py-1 rounded-lg text-xs font-mono text-slate-300
            hover:bg-navy-700 hover:text-white transition min-w-[52px] text-center"
                    title="Réinitialiser le zoom"
                >
                    {Math.round(zoom * 100)}%
                </button>

                <button
                    onClick={zoomIn}
                    disabled={zoom >= 2}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white
            hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed
            transition"
                    title="Agrandir"
                >
                    <ZoomIn size={16} />
                </button>

                <button
                    onClick={zoomReset}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white
            hover:bg-navy-700 transition ml-1"
                    title="Réinitialiser"
                >
                    <RotateCcw size={14} />
                </button>
            </div>

            {/* ── Zone de rendu ── */}
            <div className="flex-1 flex min-h-0 overflow-auto custom-scroll relative">

                {/* Loading overlay — par-dessus le container */}
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center
            justify-center bg-slate-700">
                        <img
                            src={rudderUrl}
                            alt="Chargement..."
                            className="w-16 h-16 object-contain opacity-80"
                            style={{ animation: 'spin 2s linear infinite' }}
                        />
                    </div>
                )}

                {/* Erreur */}
                {error && !loading && (
                    <div className="absolute inset-0 z-10 flex items-center
            justify-center bg-slate-700">
                        <p className="text-rose-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Conteneur des canvas — TOUJOURS dans le DOM ─────────── */}
                {/* Le zoom est appliqué via CSS transform, sans re-render  */}
                <div
                    className="flex-1 flex flex-col items-center px-2"
                    style={{
                        // Origine de transformation : haut-centre
                        transformOrigin: 'top center',
                        transform: `scale(${zoom})`,
                        // Ajuster la hauteur pour que le scroll fonctionne
                        // quand on zoome (le contenu s'agrandit)
                        marginBottom: zoom > 1 ? `${(zoom - 1) * 100}%` : 0,
                    }}
                >
                    {/* ← containerRef ici, toujours monté */}
                    <div
                        ref={containerRef}
                        className="flex flex-col items-center p-2"
                        style={{ height: '100%', width: '100%' }}
                    />
                </div>
            </div>
        </div>
    );
}