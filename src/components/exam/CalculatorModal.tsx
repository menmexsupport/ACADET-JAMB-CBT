import { useCallback, useEffect, useState } from 'react';
import { Delete, X } from 'lucide-react';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalculatorModal({ isOpen, onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [justEvaluated, setJustEvaluated] = useState(false);

  const appendValue = useCallback(
    (val: string) => {
      if (justEvaluated && /[0-9.]/.test(val)) {
        setDisplay(val === '.' ? '0.' : val);
        setExpression('');
        setJustEvaluated(false);
        return;
      }
      setJustEvaluated(false);
      setDisplay((prev) => {
        if (prev === 'Error') return val === '.' ? '0.' : val;
        if (val === '.' && prev.includes('.')) return prev;
        return prev === '0' && val !== '.' ? val : prev + val;
      });
    },
    [justEvaluated]
  );

  const applyOperator = useCallback(
    (op: string) => {
      setJustEvaluated(false);
      setExpression((prev) => `${prev}${display === 'Error' ? '0' : display} ${op} `);
      setDisplay('0');
    },
    [display]
  );

  const evaluate = useCallback(() => {
    try {
      const full = `${expression}${display}`.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
      if (!/^[0-9+\-*/().\s]+$/.test(full)) {
        setDisplay('Error');
        return;
      }
      const result = Function(`"use strict"; return (${full})`)();
      const formatted = typeof result === 'number' && Number.isFinite(result) ? String(Number(result.toFixed(8))) : 'Error';
      setDisplay(formatted);
      setExpression('');
      setJustEvaluated(true);
    } catch {
      setDisplay('Error');
      setExpression('');
    }
  }, [display, expression]);

  const applyScientific = (fn: 'sqrt' | 'sq' | 'inv' | 'pct' | 'neg') => {
    const num = parseFloat(display);
    if (Number.isNaN(num)) return;
    let out = num;
    if (fn === 'sqrt') out = num >= 0 ? Math.sqrt(num) : NaN;
    if (fn === 'sq') out = num * num;
    if (fn === 'inv') out = num !== 0 ? 1 / num : NaN;
    if (fn === 'pct') out = num / 100;
    if (fn === 'neg') out = -num;
    setDisplay(Number.isFinite(out) ? String(Number(out.toFixed(8))) : 'Error');
    if (fn !== 'neg') setJustEvaluated(true);
  };

  const clearAll = useCallback(() => {
    setDisplay('0');
    setExpression('');
    setJustEvaluated(false);
  }, []);

  const backspace = useCallback(() => {
    setDisplay((prev) => (prev.length > 1 && prev !== 'Error' ? prev.slice(0, -1) : '0'));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (/^[0-9.]$/.test(e.key)) {
        e.preventDefault();
        appendValue(e.key);
      } else if (e.key === '+' || e.key === '-') {
        e.preventDefault();
        applyOperator(e.key);
      } else if (e.key === '*') {
        e.preventDefault();
        applyOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        applyOperator('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        evaluate();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, appendValue, applyOperator, evaluate, backspace]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xs overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between bg-[#0B5E2E] px-4 py-3 text-white">
          <div>
            <h3 className="text-sm font-bold">Calculator</h3>
            <p className="text-[11px] text-emerald-100">On-screen CBT calculator</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close calculator"
            className="flex h-9 w-9 items-center justify-center rounded-md text-emerald-100 hover:bg-[#084722] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5 text-right dark:border-slate-700 dark:bg-slate-950">
            <div className="min-h-4 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
              {expression || '\u00A0'}
            </div>
            <div className="truncate font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
              {display}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 font-mono text-sm">
            <button type="button" onClick={clearAll} className="min-h-[44px] rounded-md border border-rose-200 bg-rose-50 font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">AC</button>
            <button type="button" onClick={backspace} aria-label="Backspace" className="flex min-h-[44px] items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><Delete className="h-4 w-4" /></button>
            <button type="button" onClick={() => applyScientific('pct')} className="min-h-[44px] rounded-md border border-slate-200 bg-slate-100 font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">%</button>
            <button type="button" onClick={() => applyOperator('÷')} className="min-h-[44px] rounded-md border border-emerald-200 bg-emerald-50 font-bold text-[#0B5E2E] hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">÷</button>

            <button type="button" onClick={() => applyScientific('sqrt')} className="min-h-[40px] rounded-md border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">√x</button>
            <button type="button" onClick={() => applyScientific('sq')} className="min-h-[40px] rounded-md border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">x²</button>
            <button type="button" onClick={() => applyScientific('inv')} className="min-h-[40px] rounded-md border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">1/x</button>
            <button type="button" onClick={() => applyOperator('×')} className="min-h-[40px] rounded-md border border-emerald-200 bg-emerald-50 font-bold text-[#0B5E2E] hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">×</button>

            {['7', '8', '9'].map((n) => (
              <button key={n} type="button" onClick={() => appendValue(n)} className="min-h-[44px] rounded-md border border-slate-300 bg-white font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">{n}</button>
            ))}
            <button type="button" onClick={() => applyOperator('-')} className="min-h-[44px] rounded-md border border-emerald-200 bg-emerald-50 font-bold text-[#0B5E2E] hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">−</button>

            {['4', '5', '6'].map((n) => (
              <button key={n} type="button" onClick={() => appendValue(n)} className="min-h-[44px] rounded-md border border-slate-300 bg-white font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">{n}</button>
            ))}
            <button type="button" onClick={() => applyOperator('+')} className="min-h-[44px] rounded-md border border-emerald-200 bg-emerald-50 font-bold text-[#0B5E2E] hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300">+</button>

            {['1', '2', '3'].map((n) => (
              <button key={n} type="button" onClick={() => appendValue(n)} className="min-h-[44px] rounded-md border border-slate-300 bg-white font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">{n}</button>
            ))}
            <button type="button" onClick={evaluate} className="row-span-2 rounded-md bg-[#0B5E2E] font-bold text-white hover:bg-[#084722]">=</button>

            <button type="button" onClick={() => applyScientific('neg')} className="min-h-[44px] rounded-md border border-slate-300 bg-white font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">±</button>
            <button type="button" onClick={() => appendValue('0')} className="min-h-[44px] rounded-md border border-slate-300 bg-white font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">0</button>
            <button type="button" onClick={() => appendValue('.')} className="min-h-[44px] rounded-md border border-slate-300 bg-white font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">.</button>
          </div>
        </div>
      </div>
    </div>
  );
}
