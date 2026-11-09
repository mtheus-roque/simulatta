# Simulatta

Protótipo (Fase 0) de um RPG de ação e simulação de vida espacial com estética *cassette futurism* / cyberpunk espacial.

Você começa no Apartamento 07 da Torre Kessler, em Nova Kessler, uma cidade neofuturista do planeta Aurora. Desce para a rua, anda ou dirige até o Hangar 07, decola até a estratosfera e chega à órbita, onde ficam os contratos, os drones piratas e a Estação Beta.

## Como jogar

Opção 1: abra `index.html` direto no navegador (Chrome ou Edge).

Opção 2, recomendada: rode o servidor local e acesse http://localhost:5173

```bash
node tools/serve.js
```

| Tecla | Ação |
| --- | --- |
| Mouse | Câmera (a pé e dirigindo) / mira (nave) |
| WASD | Andar / dirigir / acelerar e esquivar |
| Shift | Correr |
| V | Alternar 1ª / 3ª pessoa |
| E | Interagir, entrar e sair de veículos, embarcar na nave |
| G / R | Mover / girar móvel (apartamento) |
| Clique / F | Atirar |
| Espaço | Freio |
| Enter | Pular a sequência de decolagem |
| I | Inventário e garagem |
| P | Loja |
| Q | Contratos |
| Esc | Configurações |

## Estrutura

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | Página, HUD e painéis |
| `css/style.css` | Estilos |
| `js/data.js` | Dados do jogo: itens, naves, veículos, contratos e save |
| `js/engine.js` | Áudio procedural e utilitários de renderização |
| `js/hub.js` | Apartamento do jogador |
| `js/city.js` | Planeta Aurora / Nova Kessler: ruas, prédios, comércios, NPCs, trânsito, veículos, hangar e decolagem |
| `js/flight.js` | Voo espacial em órbita |
| `js/ui.js` | Contratos, inventário, garagem, loja, configurações e HUD |
| `js/main.js` | Modos de jogo, input e loop principal |
| `tools/serve.js` | Servidor estático local |

O documento de design está em `documento_de_design_de_jogo_e_roteiro_t_cnico.md`, e as artes conceituais estão nas imagens `.jpeg`.
