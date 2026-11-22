# Prompts para o Gemini: imagens de clima da landing

Gere as duas imagens abaixo no Gemini e salve em
`/mnt/dados/projetos/mindoramap/divulgacao/referencias/gemini/` com **exatamente** estes nomes:

| Arquivo | Onde entra | Proporção | Tamanho mínimo |
|---|---|---|---|
| `revisao.png` | Faixa "Modo Revisão", entre os passos e os recursos | 16:9 (paisagem) | 1920 × 1080 |
| `noite.png` | Rodapé noturno, fim da página | 21:9 (panorama) | 2520 × 1080 |

**Antes de gerar a `revisao.png`, anexe a foto do topo** (a estudante de óculos:
`/mnt/dados/projetos/mindoramap/src/assets/landing/estudante-visor.webp`) para o Gemini manter a
mesma pessoa e o mesmo estilo. Se ele não aceitar WebP, converta antes ou tire um print da foto.

Se aparecer uma marca-d'água visível (a estrelinha do Gemini num canto), gere de novo ou me avise,
que eu recorto. Gere 2 ou 3 versões de cada e escolha a melhor.

---

## 1. `revisao.png` (Modo Revisão)

```
Fotografia realista, editorial e cinematográfica, formato paisagem 16:9. A mesma mulher da imagem
anexa (mesmo rosto, mesmo cabelo trançado preso em coque, mesmos óculos futuristas translúcidos
com um mapa mental luminoso nas lentes, blazer azul-marinho escuro), sentada de lado, olhando para
um celular que segura com as duas mãos. Do celular sobem, flutuando, cinco ou seis cartões de
estudo translúcidos e brilhantes, como pequenos painéis de vidro, ligados entre si por linhas finas
de luz e pontos luminosos, formando uma constelação que sobe em diagonal para a esquerda.
Ela ocupa o terço direito da imagem; o lado esquerdo fica livre, escuro e calmo, para um texto
por cima.
Paleta: fundo azul-noite profundo (#0B1230) passando para violeta, com um brilho quente pêssego
(#FFA27A) vindo de baixo, como um fim de tarde virando noite; detalhes em azul (#5EA8FF) e ciano
(#00B1C4). Luz suave lateral, pele com textura natural, profundidade de campo rasa, grão leve de
filme.
Sem texto, sem letras, sem números, sem logotipos, sem interface de aplicativo legível, sem
marca-d'água.
```

## 2. `noite.png` (rodapé noturno)

```
Ilustração fotorrealista de um céu noturno em panorama ultralargo 21:9, visto de baixo, sobre uma
linha de horizonte suave e escura (silhueta baixa de morros ao longe, sem prédios). Lua crescente
fina no terço direito, com halo discreto. Céu azul-noite muito profundo (#06090F no topo, #0B1230
perto do horizonte), com estrelas pequenas e nítidas; algumas estrelas estão ligadas por linhas de
luz muito finas, formando constelações que lembram um mapa mental (pontos conectados em rede, não
signos do zodíaco). Junto ao horizonte, um resto de brilho de pôr do sol em pêssego (#FFA27A) e
violeta, bem baixo e suave. A metade de cima e o lado esquerdo são quase lisos e escuros, para
receber texto e links por cima.
Atmosfera calma, silenciosa, de fim de dia de estudo. Sem pessoas, sem texto, sem letras, sem
logotipos, sem marca-d'água.
```

## 3. `dia.png` (rodapé do tema claro, 22/11/2026)

No tema claro, o rodapé noturno destoa: a página é branca e lavanda e de repente vira noite, com um
degradê que parece borrão. A ideia é usar esta imagem clara no tema claro e manter a `noite.png`
só no tema escuro. Salve em `divulgacao/referencias/gemini/dia.png`, 21:9, no mínimo 2520 × 1080.

```
Ilustração suave e luminosa em panorama ultralargo 21:9, estilo editorial minimalista, quase
pastel. Céu de manhã bem cedo, muito claro: o topo da imagem é branco-lavanda liso e uniforme
(#F9F9FC), exatamente da mesma cor em toda a borda de cima, sem nuvens nem detalhes ali, para
emendar sem costura com uma página branca. Descendo, o céu ganha um tom lavanda bem leve (#EFEFFA)
e, junto ao horizonte, um brilho de nascer do sol em pêssego claro (#FFD9C7) e rosa suave.
Na parte de baixo, uma linha de horizonte baixa com silhuetas de morros ao longe em lavanda
acinzentado (#B8B8DB), com névoa leve entre eles.
No terço direito, flutuando acima dos morros, uma constelação delicada de pontos conectados por
linhas finas e arredondadas, como um mapa mental desenhado no céu: um ponto central um pouco maior
e ramos saindo dele, cada ramo numa cor suave diferente (azul #4F7BFF, lilás #A07CF0, rosa #EF6A9A,
laranja #F29A4A, verde-água #26B39A), com transparência, como tinta aquarelada.
A metade de cima e todo o lado esquerdo ficam quase lisos e claros, com bastante espaço vazio para
receber um título escuro, um parágrafo e dois botões por cima.
Atmosfera calma, otimista, de começo de dia de estudo. Sem pessoas, sem sol visível em disco, sem
estrelas, sem texto, sem letras, sem números, sem logotipos, sem marca-d'água.
```

Gere 2 ou 3 versões e escolha a que tiver a borda de cima mais lisa e branca.

---

Depois de salvar, é só me avisar ("salvei as imagens do Gemini"). Eu otimizo para a web
(WebP, versões para celular), coloco na página e mostro antes de publicar.
