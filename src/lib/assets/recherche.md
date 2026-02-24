Le Jeu de la vie (un peu instructif) - Une visualisation graphique et une adaptation organique.

## Prélude

J'ai remarqué que les moteurs de jeu en ligne (du Jeu de la vie) sont laids. Tout simplement.
Ma théorie:

- Le public cible:
  Soyons honnête, C'est un jeu de _nerds_.
  C'est un jeu qui intéresse principalement les fans de maths et les nostalgiques des premières prouesses informatiques.
- Les ressources:
  C'est un jeu extrêmement simple. Il a gagné en popularité dans les années 70 grâce à un article de journal qui invitait monsieur madame tout le monde à y jouer sur un bout de papier quadrillé. Aujourd'hui, on peut y jouer en à peut près 50 lignes de code. C'est vraiment rien. Bref, il y a toujours eu une appréciation pour la simplicité et le minimalisme du jeu. C'est le concept après tout. On part de rien pour arriver à beaucoup.

Pour ces deux raisons, je ne suis pas étonné de ne pas être tombé sur des implémentations du jeu de la vie **belles** et **bien désignées** (pas que le pixel art et la simplicité qu'on trouve en ligne sont laids, au contraire, mais on se comprend).

Par exemple:

![[Pasted image 20260215061806.png]]https://conwaylife.com/

![[Pasted image 20260215061827.png]]https://playgameoflife.com/

![[Pasted image 20260215062057.png]]
https://copy.sh/life/

C'est tout simplement un jeu développé par des _nerds_ (comme moi) en **solo** (comme moi). On est loin de la grosse équipe multidisciplinaire qui design + développe.

Eh bien Eureka! C'est exactement là où je veux me situer, moi. Là où les grosses équipes n'ont pas d'intérêt et où les développeurs n'ont pas de goût.

## Objectifs

1. Un _game engine_ **organique**.
2. Une **présentation instructive** des structures et catégories les plus connues.
3. Une vulgarisation & UX des **règles du jeu** intuitive et accessible.

### 1. Un jeu organique

J'en ai pas trouvé en ligne. Je trouve que c'est une idée géniale. D'un côté, ça défie le côté minimaliste pixel art du jeu, mais d'un autre, construire un physics engine qui simule un écosystème de genre de cellule, c'est plutôt approprié. Non?

Mon inspiration:

![[Pasted image 20260218161005.png]]
https://www.youtube.com/watch?v=rSKMYc1CQHE&t=407s

_Coding Adventure: Simulating Fluids_, par Sebastian Lague (le goat)

Dans cette vidéo absolument incroyable, Lague étudie un raccourci intéressant pour estimer les comportements physiques de particules: le calcul du noyau de densité après _blur_ (flou Gaussien).

L'idée: plutôt que de calculer d'ensemble des collisions complexes, on génère une carte de densité pour estimer l'influence locale des cellules.

```ts
const strength = META_RAD_SQ * (cell.scale * cell.scale) * cell.alpha;
const dist_sq = dx * dx + dy2; field_buffer[row_offset + bx] += strength / dist_sq;
```

À partir de cette carte de densité, on calcule les force de pression exercées.

Mais dans ce cas aujourd'hui, ce n'est pas exactement le même processus.

En effet, pour conserver l'intégrité du jeu, j'ai réalisé rapidement qu'il faudrait que l'aspect organique du jeu soit purement visuel. S'il avait un réel impact sur le comportement des cellules et pouvait les repousser, les règles toutes simples du Jeu de la vie seraient violées.

Il y a donc:

- Les cellules en arrière-plan (invisibles) qui suivent les règles du Jeu de la vie.
- Les cellules visuelles qui suivent les règles physiques.

S'inspirant du calcul de densité de noyau, les cellules physiques sont simplement contraintes par un système de ressorts qui les pousse vers leur cible.

C'est un raccourci visuel.
Mais ça crée un effet incroyable.
À mon avis 😁.

### 2. Les structures

Dans le jeu de la vie

### 3. Les règles

Fun fact: Petit caméo de Google

![[Pasted image 20260215062016.png]]

Théo Baillargeon
