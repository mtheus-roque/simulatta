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
| Clique | Socar (a pé) / atirar (órbita) |
| E | Interagir, comer, coletar, dirigir, embarcar e pousar |
| O | Subir da atmosfera para a órbita |
| Enter | Pular a subida à órbita |
| V | Alternar 1ª / 3ª pessoa |
| G / R | Mover / girar móvel (apartamento) |
| I | Inventário e garagem |
| P | Loja |
| Q | Contratos |
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
| `js/flight.js` | Voo espacial em órbita |
| `js/ui.js` | Contratos, inventário, garagem, loja, comida, configurações e HUD |
| `js/main.js` | Modos de jogo, input e loop principal |
| `tools/serve.js` | Servidor estático local |

O documento de design está em `documento_de_design_de_jogo_e_roteiro_t_cnico.md`, e as artes conceituais estão nas imagens `.jpeg`.
