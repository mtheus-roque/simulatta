# GDD & Roteiro Técnico: Projeto "Rust & Orbit" (Nome Provisório)
*Documento de Especificação de Escopo, Universo e Diretrizes de Implementação com IA*

---

## 1. Visão Geral e Premissa Narrativa

### 1.1 O Universo e o Êxodo
* **Gênero:** RPG de Ação e Simulação de Vida Espacial / Sandbox com Economia Territorial.
* **Estética & Tom:** *Cassette Futurism* / Cyberpunk Espacial com atmosfera de Western Espacial (inspirado em *Cowboy Bebop*, *Alien* clássico e *Blade Runner*). Naves de linhas industriais desgastadas, monitores CRT monocromáticos, fios expostos, luzes de neon decadentes e trilha sonora baseada em jazz, blues e batidas lo-fi.
* **Histórico:** A Terra foi perdida há dois séculos devido ao "Grande Colapso". Os remanescentes da humanidade migraram em naves-arca e cargueiros de sucata, colonizando sistemas distantes e dividindo espaço com civilizações já estabelecidas.

### 1.2 As Espécies do Universo
1. **Humanos:** Resilientes, apegados à cultura analógica da Terra perdida. Muito presentes no comércio informal, navegação autônoma e caça a recompensas.
2. **Vexari:** Espécie humanoide esguia com pele azulada/acinzentada. Engenheiros metódicos, donos das maiores rotas de hiperespaço e estaleiros de propulsão.
3. **Oskari:** Espécie humanoide de alta densidade muscular e traços rochosos, adaptados a planetas de alta gravidade. Predominam em frentes de mineração profunda, patrulhas blindadas e facções mercenárias.

---

## 2. Pilares de Jogabilidade

### 2.1 O Ciclo Central de Jogo (Core Loop)
$$\text{Trabalho / Exploração} \longrightarrow \text{Créditos / Sucata} \longrightarrow \text{Upgrades (Nave, Casa, Armas)} \longrightarrow \text{Disputa Territorial / Expansão}$$

* **Vida Civil (Mundana):** Empregos formais em distritos protegidos (manutenção, entregas urbanas, refino) geram salário seguro e previsível.
* **Vida de Fronteira:** Coleta arriscada de minérios em luas inóspitas, caça de recompensas (PVE/PVP) e transporte de contrabando entre portos.

### 2.2 Estrutura Espacial e Zoneamento Planetário
* **High-Sec (Zonas Seguras):** Megacidades industrializadas. Sem PvP aberto. Centro de moradias protegidas, lojas de grife e bolsas de valores centrais.
* **Mid-Sec (Fronteira):** Cidades-porto instáveis e estações orbitais. PvP fora dos portões. Hub de mercenários, leilões piratas e recursos medianos.
* **Null-Sec (Selva Cósmica):** Planetas hostis com tempestades ácidas e criaturas. PvP livre total. Local onde estão os minerais mais valiosos para peças de nível máximo e bases construídas por clãs.

### 2.3 Housing, Garagens e Píeres
* **Apartamentos Verticais:** Entrada única em prédios de megacidades com **instanciação interior** (permite milhares de apartamentos sem ocupar espaço físico infinito no mapa).
* **Decoração e Mobília:** Posição em grade/livre para itens comprados: sofás de couro puído, fliperamas antigos, bancadas de armas, gravadores de fita cassete.
* **Hangares / Píeres:** Locais onde o jogador armazena suas naves, instala módulos de motores, escudos e canhões, e admira sua frota.

### 2.4 Sistemas de Combate e Voo
* **Combate a Pé (3ª Pessoa):**
  * **Tiroteio:** Pistolas pesadas, espingardas cinéticas, fuzis de pulso. Uso de cobertura simples e gestão de munição.
  * **Melee:** Bastões de choque, facas térmicas e socos/esquivas para combate rápido em corredores estreitos de naves e becos.
* **Voo Espacial (Estilo Arcade / Acessível):**
  * **Controles Intuitivos:** Sem física newtoniana complexa. Estabilizadores inerciais automáticos ativados por padrão (estilo *Star Wars: Squadrons* ou *No Man's Sky*).
  * Aceleração simples (W/S), manobra direcional com o mouse, propulsores de esquiva lateral (A/D) e frenagem de emergência (Barra de espaço).
  * Armas acopladas: Canhões giratórios balísticos e torpedos teleguiados.

### 2.5 Economia, Clãs e Comércio
* **Mercados Descentralizados:** Cada porto tem sua própria tabela de oferta e procura de produtos.
* **Controle de Cidades/Nós:** Clãs de jogadores podem conquistar postos avançados em guerras programadas, recebendo uma porcentagem em impostos sobre taxas de pouso e transações de mercado do local dominado.

---

## 3. Arquitetura Modular para Desenvolvedor Solo

Para que o projeto seja viável para um desenvolvedor solo com assistência de IA, adota-se o padrão **orientado a dados (Data-Driven)**:

```
[Definição JSON/ScriptableObject]
  ├── Itens (Armas, Mobília, Peças de Nave)
  ├── Naves (Chassi, Slots de Módulos, Velocidade, Vida)
  ├── Planetas (Tabela de Spawn, Bioma, Multiplicador de Preço)
  └── Missões (Objetivos, Localização, Recompensa)
```
*Toda nova nave, arma ou item é apenas uma nova linha de dados, reaproveitando a mesma malha (mesh) básica e a mesma lógica de código.*

---

## 4. Instruções Técnicas para a IA: Protótipo Web Inicial (Fase 0)

Esta seção serve como diretriz direta para ser colada nos prompts de criação do protótipo no navegador.

### 4.1 Pilha Tecnológica do Protótipo Web
* **Engine/Biblioteca:** **Three.js** ou **Babylon.js** (executado via HTML5/JavaScript em arquivo único ou estrutura simples de módulo).
* **Renderização:** Estilo estilizado Low-Poly ou iluminação retrô com shaders de scanline CRT e paleta de cores âmbar/neon para reduzir a necessidade de texturas hiper-realistas pesadas.
* **Persistência de Dados:** `localStorage` do navegador para salvar inventário, créditos, estado do apartamento e naves compradas.

### 4.2 Módulos do Protótipo Web a Serem Solicitados à IA

#### Módulo 1: O Hub do Jogador (Apartamento/Garagem)
* **Objetivo:** Criar um interior 3D fechado onde o jogador caminha em 3ª pessoa.
* **Elementos:**
  * Câmera em terceira pessoa seguindo a malha do personagem.
  * Pelo menos 3 móveis posicionáveis (sofá, terminal de dados, bancada).
  * Um terminal interativo que abre o menu de inventário e contratos.
  * Uma porta/elevador que faz a transição para a nave.

#### Módulo 2: O Sistema de Voo Simples
* **Objetivo:** Uma cena espacial onde o jogador pilota a nave.
* **Elementos:**
  * Modelo de nave 3D com propulsor luminoso.
  * Controle com teclado (W/S acelera, A/D vira, Mouse mira).
  * Campo de asteroides com colisão simples e detritos para coletar.
  * Tiroteio básico (disparo de projéteis contra alvos estáticos ou drones piratas simples).
  * Marcador de hiperespaço para pousar em outro ponto ou voltar à garagem.

#### Módulo 3: Economia e Inventário (UI/HUD)
* **Objetivo:** Gerenciar a progressão.
* **Elementos:**
  * Moeda virtual ("Woolongs" / "Créditos").
  * Loja simulada com 3 peças de nave (Motor Tier 1, Canhão Duplo, Blindagem de Sucata) e 2 móveis.
  * Tela de contratos (Ex: "Entregar suprimentos na Estação Beta" ou "Eliminar 3 drones de sucata").

---

## 5. Roteiro Evolutivo (Roadmap de Longo Prazo)

| Fase | Plataforma | Objetivo Principal | Entregável |
| :--- | :--- | :--- | :--- |
| **Fase 0 (Atual)** | Navegador Web (Three.js/Canvas) | Validação rápida da jogabilidade, estética e sistemas de UI/inventário via IA. | Protótipo web jogável com voo simples e apartamento funcional. |
| **Fase 1** | Engine 3D (Godot 4 ou Unreal 5) | Migração da lógica validada para uma engine profissional com suporte a shaders e física avançada. | Vertical Slice single-player: 1 cidade-hub, 1 setor espacial e combate a pé/nave. |
| **Fase 2** | Engine 3D | Geração procedural de planetas e sistema de housing em prédios instanciados. | 3 planetas com diferentes níveis de segurança e lojas de mobília. |
| **Fase 3** | Engine 3D + Backend (Node/Go/Nakama) | Implementação de arquitetura de rede cliente-servidor (Multiplayer). | Servidor com sincronização de naves, chat de texto e comércio entre jogadores. |
| **Fase 4** | Engine 3D + Backend | Sistema de clãs, guerras territoriais e economia global descentralizada. | Conquista de nós planetários por guildas e impostos automatizados. |