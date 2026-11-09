# Simulatta

Protótipo (Fase 0) de um RPG de ação e simulação de vida espacial com estética *cassette futurism* / cyberpunk espacial.

Você começa no Apartamento 07 da Torre Kessler, em Nova Kessler, no planeta **Aurora**. Aurora é uma esfera completa, com 40 km de raio, que dá para circundar a pé, de carro ou de nave. O planeta tem:

- duas cidades: Nova Kessler (high-sec, ao entardecer) e Porto Ferrugem (mid-sec, do outro lado do mundo, à noite);
- áreas selvagens com planícies, Deserto Rubro, montanhas, geleiras e oceanos;
- jazidas de minério e ervas para coletar e vender.

Da órbita (tecla **O** durante o voo) chega-se aos contratos, aos drones piratas e à Estação Beta.

## Como jogar

Opção 1: abra `index.html` direto no navegador (Chrome ou Edge).

Opção 2, recomendada: rode o servidor local e acesse http://localhost:5173

```bash
node tools/serve.js
```

| Tecla | Ação |
| --- | --- |
| Mouse | Câmera (a pé e dirigindo) / mira (nave) |
| WASD | Andar / dirigir / potência da nave |
| Shift | Correr (gasta energia) / pós-combustor da nave |
| Espaço | Pular (a pé) / freio (carro e nave) |
| Clique | Atirar / golpear (segure para golpe forte) / atirar (órbita) |
| Botão direito | Mirar por cima do ombro |
| 1 – 4 | Trocar arma (1 corpo a corpo, 2 pistola, 3 espingarda, 4 fuzil) |
| R | Recarregar |
| C | Esquiva (gasta energia, invulnerável por um instante) |
| Setas | Minijogo de manutenção de painéis |
| E | Interagir, comer, coletar (e acertar o ponto quente), dirigir, embarcar, pousar, algemar e revistar |
| O | Subir da atmosfera para a órbita |
| Enter | Pular a subida à órbita |
| V | Alternar 1ª / 3ª pessoa |
| G / R | Mover / girar móvel (apartamento) |
| I | Inventário e garagem |
| P | Loja |
| Q | Recompensas, empregos e contratos orbitais |
| Esc | Configurações (inclui a lista de atalhos) |

### Sobrevivência e lei

- **Vida**: cai com golpes, disparos, atropelamentos e batidas. Ao zerar, você acorda na clínica e paga a conta.
- **Energia**: gasta ao correr e pular, e se recupera parado.
- **Saciedade**: cai devagar (cerca de 50 minutos de cheio a vazio). Com fome, você fica mais lento e com menos energia. Coma em restaurantes e barracas ou leve comida no inventário.
- **Polícia**: agredir ou atropelar pessoas gera estrelas de procurado (até 3).
  - ★ agentes a pé;
  - ★★ viatura e drone;
  - ★★★ mais drones atirando.
  - Fique longe da polícia para despistá-la. Se um agente o pegar parado, você é preso e paga multa.

### Combate

- **Armas de fogo:** Pistola Pesada (inicial), Espingarda Cinética e Fuzil de Pulso. Cada uma tem munição própria, recarga e tiro na cabeça com dano dobrado.
- **Corpo a corpo:** punhos, Bastão de Choque (atordoa) e Faca Térmica. O combo é de 3 golpes; segurar o clique dá um golpe forte.
- **Inimigos:**
  - os **Ratos de Ferrugem** dominam 3 esquinas de Porto Ferrugem e atacam quem fica no território deles;
  - **acampamentos de bandidos** espalhados pelas áreas selvagens têm uma caixa de suprimentos e voltam a ser ocupados depois de 30 minutos;
  - corpos podem ser revistados (**E**) atrás de créditos e munição.
- **Colete Balístico:** reduz 35% do dano recebido.

### Trabalho e economia

- **Mineração:** a melhor ferramenta que você tem é usada automaticamente. Apertar **E** com o cursor na faixa verde extrai mais.
  - Mãos: só ervas;
  - Picareta: ferro e cobre;
  - Furadeira de Plasma: cristal;
  - Laser de Mineração: titânio.
- **Fabricação:** feita na bancada do apartamento ou na Oficina da Doca, em Porto Ferrugem. Produz munição, kit médico, colete, faca, ferramentas, módulos de nave e Liga de Titânio.
- **Recompensas (Q → Recompensas):** caçe procurados nas áreas selvagens. Cada um tem escolta, e ele se rende com a vida baixa.
  - Algemado vivo, paga a recompensa +25%;
  - abatido, paga 60%.
- **Empregos (Q → Empregos):** renda segura dentro das cidades.
  - **Entregas Expressas:** com prazo e bônus por rapidez;
  - **Táxi:** precisa estar dirigindo; dirigir bem rende gorjeta;
  - **Manutenção Urbana:** 3 painéis, cada um com um minijogo de setas.

## Estrutura

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | Página, HUD e painéis |
| `css/style.css` | Estilos |
| `js/data.js` | Dados: itens, minérios, comidas, naves, veículos, contratos e save |
| `js/engine.js` | Áudio procedural e utilitários de renderização |
| `js/hub.js` | Apartamento do jogador |
| `js/planet.js` | Planeta Aurora: relevo, oceanos, biomas, céu dia/noite, nuvens e recursos selvagens |
| `js/city.js` | Cidades, NPCs, trânsito, jogador a pé, veículos e nave atmosférica |
| `js/survival.js` | Vida, energia, saciedade, crimes e polícia |
| `js/combat.js` | Armas, mira, corpo a corpo, esquiva, gangues, bandidos e IA de inimigos |
| `js/work.js` | Mineração com ferramentas, fabricação, recompensas e empregos civis |
| `js/flight.js` | Voo espacial em órbita |
| `js/ui.js` | Contratos, inventário, garagem, loja, comida, configurações e HUD |
| `js/main.js` | Modos de jogo, input e loop principal |
| `tools/serve.js` | Servidor estático local |

O documento de design está em `documento_de_design_de_jogo_e_roteiro_t_cnico.md`, e as artes conceituais estão nas imagens `.jpeg`.
