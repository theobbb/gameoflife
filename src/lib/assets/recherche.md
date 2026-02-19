# Jeu de la vie - Visualisation organique & un peu instructive

J'adore le Jeu de la vie. C'est un jeu simple, mais puissant.
Je tente de l'inscrire dans le cadre du cours sous les dimensions suivantes:

1. Un _game engine_ **organique**.
2. Une **présentation instructive** des structures et catégories les plus connues.
3. Une vulgarisation & UX des **règles du jeu** intuitive et accessible.

---

### Intro

J'ai remarqué que les moteurs de jeu en ligne (du Jeu de la vie) sont laids. Tout simplement.
Ma théorie:

- Le public cible:
  Soyons honnête, C'est un jeu de _nerds_.
  C'est un jeu qui intéresse principalement les fans de maths et les nostalgiques des premières prouesses informatiques.
- Les ressources:
  C'est un jeu extrêmement simple. Il a gagné en popularité dans les années 70 grâce à un article de journal qui invitait monsieur madame tout le monde à y jouer sur un bout de papier quadrillé. Aujourd'hui, on peut y jouer en à peut près 50 lignes de code. C'est vraiment rien. Bref, il y a toujours eu une appréciation pour la simplicité et le minimalisme du jeu. C'est le concept après tout. On part de rien pour arriver à beaucoup.

Pour ces deux raisons, je ne suis pas étonné de ne pas être tombé sur des implémentations du jeu de la vie _belles_ et _bien désignées_ (pas que le pixel art et la simplicité qu'on trouve en ligne sont laids, au contraire, mais on se comprend) :

![](attachment/4b8e2b8243d87bc2f17fb4a1ec00b5de.png)https://conwaylife.com/

![](attachment/d0e2285c387a1662c3afffb82e3bd07a.png)https://playgameoflife.com/

![](attachment/3c550264264fe096e782f9222bccb47c.png)
https://copy.sh/life/

C'est tout simplement un jeu développé par des _nerds_ (comme moi) en **solo** (comme moi). On est loin de la grosse équipe multidisciplinaire qui design + développe.

Eh bien Eureka! C'est exactement là où je veux me situer, moi. Là où les agences ne regardent pas et où les développeurs n'ont pas de goût.

## Voici donc (enfin) mon _take_ sur le Jeu de la vie!

#### Règles

#### Un jeu organique

J'en ai pas trouvé en ligne. Je trouve que c'est une idée géniale. D'un côté, ça défie le côté minimaliste pixel art du jeu, mais d'un autre, construire un physics engine qui simule un écosystème de genre de cellule, c'est plutôt approprié. Non?

Mon inspiration:

![](attachment/01b5509fa3b8c953cc05f2727d07744e.png)
https://www.youtube.com/watch?v=rSKMYc1CQHE&t=407s

_Coding Adventure: Simulating Fluids_, par Sebastian Lague (le goat)

Dans cette vidéo absolument incroyable, Lague étudie un raccourci intéressant pour estimer les comportements physiques de particules: le calcul du noyau de densité après _blur_ (flou Gaussien).

L'idée: plutôt que de calculer l'ensemble des collisions complexes, on génère une carte de densité pour estimer l'influence locale des cellules.

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

---

# Progression

---

## Semaine 1

J'ai rien foutu 😥

---

## Semaine 2

J'ai pas rien foutu 😎

Idée du jeu de la vie organique!

![](attachment/57a186d2d1c735a5b0af79c49df3623c.png)

J'ai vraiment clencher ça. J'ai fait QUE ÇA pendant 3 jours. Mais bon, très content du résultat.

#### Visualisation

Je n'ai pas vraiment fait d'esquisse à la main pour la raison suivante:

Mon concept est directement relié au _game engine_ du jeu de la vie que j'ai développé. Mon premier réflexe a donc été d'expérimenter avec le code sur une page web vierge pour premièrement déterminer si l'idée que j'avais en tête était possible.

Le problème avec cette approche - et d'ailleurs le problème de ma vie - c'est que je ne sépare pas le design avec le développement. Où est la limite entre les deux? J'expérimente avec le code pour voir si mon idée "design" est réalisable, et ensuite je _vibe design_ sans réellement m'assoeir et me poser les questions qu'il faut. Je dirais que j'ai plus ou moins prévu le coup cette fois ci. Dès que j'était satisfait du _game engine_, j'ai réussi calmer mes ardeurs: je suis allé dans _figma_ et prendre le temps de comparer différentes options et de désigner pour de vrai.

Mais j'ai tout de même complètement désigner le truc en même temps que je le développais... Sauf pour quelques éléments qui m'ont fait hésiter et où je suis allé dans figma pour mettre de l'ordre dans ma tête.

#### Game engine

![](attachment/8f808c6a64b0152997f73a04d5e344e6.png)![](attachment/fdeb805c24368cd0ccc182ae51217e6e.mp4)
Première expérimentation d'animation

![](attachment/1292ff16d998253c124e32a600f139ca.mp4)

Première expérimentation avec un _physics engine_
![](attachment/e65c6e5e3101c7379c63fa97a15b582b.mp4)![](attachment/774ad84e05d402635c27adab6e520cd0.mp4)![](attachment/16719b978eff618d90ce473de610ed67.mp4)![](attachment/3137d0237a231fab2d7adb32b470638d.mp4)![](attachment/e7785ea8f2364fdefadc368841037dec.mp4)

#### Couleurs

![](attachment/c5e144fc4aa9b8d0b95358d38c405728.png)
Couleurs beaucoup trop mignonnes qui piquent les yeux. Le jeu est ludique, et le physics engine rend cette implementation du Jeu de la vie unique. Je me suis dis, pourquoi ne pas encore plus s'éloigner du pixel art noir et blanc méga nerdy!

#### Navigation

Mise à part l'explication des règles du jeu, c'est ici que réside le côté **informatif** du projet.

Objectif:
Permettre à l'utilisateur d'explorer sommairement les différentes structures du Jeu de la vie.

J'ai d'abord commencé par simplement lister les structures sur le côté. Ça faisait très encyclopédie.

![](attachment/3dd66d3a6ea5cce53125c25f70bbb242.png)

Je suis fier de moi. J'apprend. J'AI RÉUSSI À ALLER DANS FIGMA.
C'était payant. Je suis très satisfait du résultat des cartes.

![](attachment/1769da1e2a695a1f262fd2554eeb8556.png)

Ça faisait un moment que je visualisais les cartes. Je trouvais que c'était cohérent avec le côté organique du jeu. C'est très ludique et ça fait davantage **informatif**.

![](attachment/2d9f225b5b77d1403499a68b70254460.jpg)

Bon, pas terrible l'esquisse mais on comprend la vision.

Ensuite, ce sont les catégories de structures qui m'ont fait hésiter.

![](attachment/9c545e65b3be1ef90d3fbc315270aaa1.png)
J'ai d'abord pensé à les mettre comme ceci. J'avais en tête depuis le début d'avoir une autre vue où l'on verrait toutes les catégories et toutes les structures (leur nom) côte à côte.

![](attachment/430bd3ad983aa47b145547384ddfeea7.png)

Extrêmement satisfait de cette navigation pour les catégories.
Il y a un sentiment de progression globale à travers le site. D'ailleurs, c'est l'une de mes plus belles découvertes dans le cours jusqu'à maintenant. Je le savais probablement subconsciemment, que l'on aime avoir devant les yeux sa progression globale, mais là de mettre les mots dessus c'est vraiment un plus. Ça réduit **énormément** la friction d'avoir en permanence devant soi les cinq catégories. Si je les avaient cachées dans une autre vue qu'on retrouve en passant par un bouton, je pense que ça aurait vraiment alourdit la charge mentale.

Satisfait également de la description de chaque catégorie _on hover_ seulement. Au début, comme on peut le voir plus haut, j'imaginais qu'on puisse voir en permanence la catégorie associée à la structure sélectionnée, ainsi qu'à sa description. Et c'est d'ailleurs pour cette raison que j'imaginais avoir une vue séparée pour consulter toutes les catégories.
Mais quelle révélation! Qu'est ce qu'on s'en fout de voir la description de la dite catégorie. Maintenant, on la voit _on hover_ et c'est bien suffisant. Le compromis est un _no brainer_.

---

## Semaine 3

Le feedback que j'ai reçu en classe par le prof et mes paires:
La _landing page_ est overwhelming. Premier contact avec le Jeu de la vie est violent. Trop d’infos en même temps d’un coup.

![](attachment/90b143c8beb46d5197bf975d4cef3de6.png)

J'ai essayé de stylisé les règles du jeu, mais honnêtement je pense que les deux colonnes les complexifie plutôt...

Je suis bien d'accord avec ces commentaires.

Je veux simplifier les règles et bien les présenter. C'est la première fois que j'essaie de design des règles de jeu. C'est un super exercice.

![](attachment/b288fcdc3b97cddba6e4f350b23ba328.png)

#### Introduction d'une navigation en 3 étapes.

Avantages:

- De mieux guider le nouvel utilisateur et de limiter la quantité d'information visible sur la landing page en mettant les règles dans une vue séparée.
- De tout de même permettre à un utilisateur de se rendre directement au jeu s'il connaît déjà les règles ou s'il les a déjà vu.

Inconvénients:

- Sur la landing page, on ne peut plus tout simplement mettre un bouton à haut contraste qui dirige vers le jeu. La navigation passe maintenant par le header. En fait, oui, il faut quand même mettre un bouton à haut contrast qui guide vers les règles. C'est juste que le bouton est en double. Merde.

J'ai pas vraiment eu le temps cette semaine de redesigner les règles, mais j'ai une idée de ce que je veux essayer: une genre d'animation qui explique le avant/après par génération pour chaque règle. Je pense que ça va être plus doux pour le nouvel utilisateur. Plutôt que de tout voir d'un coup en même temps.

#### Contrôles

Sinon, j'ai pas mal terminé le UI des contrôles pour le jeu. Ça commence à ressembler à quelque chose.

![](attachment/65c3070ba87f26e0866578f3180547b1.png)

Pas mal du tout. J'aime les input range en particulier. Avec le tooltip qui apparait on hover. Ça garde le tout assez léger, malgré la grande quantité d'info.

Mais ce que j'aime pas c'est le bouton démarrer. Vraiment pas assez dans ta face! Au début, je pensais avoir un bouton gros bouton gros contraste "Démarrer" - et d'ailleurs je vais peut-être le remettre - mais là je trouvais ça bizarre d'avoir les contrôles de clavier et les boutons qui disaient la même chose côte à côte. Je pense que ça peut fonctionner de seulement garder les contrôles de clavier, mais il y a clairement encore un peu de job de UI.

## Semaine 4

---

Bruh, pas encore fait

Fun fact: Petit caméo de Google

![](attachment/066df443b36cb3d3a5da0fbc440317fa.png)

Théo Baillargeon
