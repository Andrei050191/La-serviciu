import { useEffect, useRef, useState } from 'react';
import { cautaChatIdPentru, genereazaCodConectare } from './telegram';

// Conectare prin cod de 6 cifre: aplicația arată codul, omul îl trimite botului,
// iar noi verificăm la 3 secunde (max. 5 minute) dacă a sosit.
export const useConectareTelegram = (onConectat) => {
  const [stare, setStare] = useState('idle'); // idle | asteapta | eroare
  const [cod, setCod] = useState(null);
  const onConectatRef = useRef(onConectat);

  useEffect(() => {
    onConectatRef.current = onConectat;
  });

  useEffect(() => {
    if (stare !== 'asteapta' || !cod) return;
    let oprit = false;
    let incercari = 0;
    let timer;

    const verifica = async () => {
      if (oprit) return;
      incercari += 1;
      try {
        const chatId = await cautaChatIdPentru(cod);
        if (chatId && !oprit) {
          await onConectatRef.current(chatId);
          setStare('idle');
          setCod(null);
          return;
        }
      } catch (e) {
        console.warn('Verificare Telegram:', e);
      }
      if (incercari >= 100) {
        setStare('eroare');
        return;
      }
      if (!oprit) timer = setTimeout(verifica, 3000);
    };

    timer = setTimeout(verifica, 2000);
    return () => { oprit = true; clearTimeout(timer); };
  }, [stare, cod]);

  return {
    stare,
    cod,
    porneste: () => { setCod(genereazaCodConectare()); setStare('asteapta'); },
    anuleaza: () => { setStare('idle'); setCod(null); }
  };
};
