import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export async function GET() {
  
  // 1. Pega regras do banco
  let rules: any[] = [];
  try {
    const docRef = doc(db, 'config', 'game_rules');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().rules) {
      rules = docSnap.data().rules;
    } else {
      rules = [{ type: 'LOSS', prize: 'Erro', chance: 100 }];
    }
  } catch (error) {
    return NextResponse.json({ error: 'Erro Database' }, { status: 500 });
  }

  // 2. Método da Urna (Sorteio Justo)
  let urna: any[] = [];
  rules.forEach((rule) => {
    const qtde = Math.floor(Number(rule.chance) || 0);
    for (let i = 0; i < qtde; i++) urna.push(rule);
  });
  
  if (urna.length === 0) urna.push({ type: 'LOSS', prize: 'Tente+', chance: 100 });
  
  const selectedRule = urna[Math.floor(Math.random() * urna.length)];

  // 3. Geração do Grid
  const fillers = ["Tente+", "Quase", "Raspou", "Não foi", "Zebra", "Zero"];
  let grid: string[] = [];

  if (selectedRule.type === 'WIN') {
    // === VITÓRIA ===
    // Coloca 3 prêmios garantidos
    grid = [selectedRule.prize, selectedRule.prize, selectedRule.prize];
    
    // Completa o resto com lixo
    while (grid.length < 9) {
      const filler = fillers[Math.floor(Math.random() * fillers.length)];
      grid.push(filler);
    }

  } else {
    // === DERROTA (BLINDADA) ===
    // Aqui garantimos que NENHUM item apareça 3 vezes
    const allPrizesNames = rules.filter((r: any) => r.type === 'WIN').map((r: any) => r.prize);
    const pool = [...fillers, ...allPrizesNames];
    
    // Contador para garantir que nada repita 3 vezes
    const counts: Record<string, number> = {};

    while (grid.length < 9) {
        const item = pool[Math.floor(Math.random() * pool.length)];
        const currentCount = counts[item] || 0;

        // Se já tem 2 desse item, NÃO adiciona o terceiro (evita falsa vitória)
        if (currentCount < 2) {
            grid.push(item);
            counts[item] = currentCount + 1;
        }
    }
  }

  // Embaralha
  grid = grid.sort(() => Math.random() - 0.5);

  return NextResponse.json({ 
    result: selectedRule.type,
    prize: selectedRule.prize,
    grid: grid 
  });
}