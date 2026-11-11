import { useEffect, useState } from 'react';
import { format } from 'date-fns';

const cheieAzi = () => format(new Date(), 'yyyyMMdd');

// Întoarce ziua de azi (yyyyMMdd) și se actualizează singur după miezul nopții,
// sau când aplicația revine în prim-plan pe telefon.
export const useZiCurenta = () => {
  const [zi, setZi] = useState(cheieAzi);

  useEffect(() => {
    const verifica = () => setZi(cheieAzi());
    const timer = setInterval(verifica, 60 * 1000);
    document.addEventListener('visibilitychange', verifica);
    window.addEventListener('focus', verifica);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', verifica);
      window.removeEventListener('focus', verifica);
    };
  }, []);

  return zi;
};
