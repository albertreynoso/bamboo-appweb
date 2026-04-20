import React from 'react';

type Variant = 'premium_glass' | 'premium_ethereal' | 'premium_modern' | 'premium_bold';

interface LoadingTransitionProps {
    variant?: Variant;
    message?: string;
}

const LoadingTransition: React.FC<LoadingTransitionProps> = ({
    variant = 'premium_glass',
    message = 'Cargando...'
}) => {

    const getStyles = () => {
        switch (variant) {
            case 'premium_ethereal':
                return {
                    bg: 'bg-white',
                    ring: 'border-t-primary/60 border-r-transparent border-b-transparent border-l-transparent',
                    logoColor: 'text-primary/80',
                    brandFont: 'font-light tracking-[0.4em] text-[9px]',
                    text: 'text-slate-400'
                };
            case 'premium_modern':
                return {
                    bg: 'bg-[#fafafa]',
                    ring: 'border-t-primary border-r-primary/10 border-b-primary/5 border-l-primary/30',
                    logoColor: 'text-primary',
                    brandFont: 'font-black tracking-[0.1em] text-[11px] italic',
                    text: 'text-slate-500'
                };
            case 'premium_bold':
                return {
                    bg: 'bg-white',
                    ring: 'border-[6px] border-t-primary border-r-slate-100 border-b-slate-100 border-l-slate-100',
                    logoColor: 'text-slate-900',
                    brandFont: 'font-bold tracking-normal text-[12px]',
                    text: 'text-slate-800'
                };
            case 'premium_glass':
            default:
                return {
                    bg: 'bg-white/90 backdrop-blur-xl',
                    ring: 'border-t-primary border-r-primary/20 border-b-primary/5 border-l-primary/40',
                    logoColor: 'text-primary',
                    brandColor: 'text-slate-900',
                    brandFont: 'font-bold tracking-[0.25em] text-[10px]',
                    text: 'text-slate-600'
                };
        }
    };

    const styles = getStyles();

    return (
        <div className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center ${styles.bg} transition-all duration-500`}>
            <div className="relative flex items-center justify-center h-40 w-40">
                {/* Exterior Loading Ring - Expanded */}
                <div
                    className={`absolute inset-0 rounded-full border-[5px] ${styles.ring} animate-spin`}
                    style={{ animationDuration: '1.5s' }}
                />

                {/* Logo and Brand Container - Floating (No background box) */}
                <div className="flex flex-col items-center justify-center transition-transform duration-300 transform scale-110">
                    <ToothIcon className={`h-12 w-12 mb-2 ${styles.logoColor} drop-shadow-sm`} />
                    <span className={`${styles.brandFont} uppercase opacity-90 ${styles.brandColor || styles.logoColor}`}>DentLink</span>
                </div>
            </div>

            {message && (
                <p className={`mt-8 text-[11px] font-semibold tracking-[0.3em] uppercase ${styles.text} animate-pulse px-4 text-center`}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default LoadingTransition;

/* ══════════════════════════════════════════════════
   Ícono SVG local para independencia del componente
   ══════════════════════════════════════════════════ */

function ToothIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M12 3C9.2 3 6.5 4.6 5.8 7.2C5.1 9.8 5.8 12.8 7 15.2L8.5 20C8.8 21.1 9.8 21.5 10.7 21.1C11.3 20.8 11.4 20 11.7 19.8C11.9 19.7 12.1 19.7 12.3 19.8C12.6 20 12.7 20.8 13.3 21.1C14.2 21.5 15.2 21.1 15.5 20L17 15.2C18.2 12.8 18.9 9.8 18.2 7.2C17.5 4.6 14.8 3 12 3Z"
                fill="currentColor"
            />
        </svg>
    );
}
