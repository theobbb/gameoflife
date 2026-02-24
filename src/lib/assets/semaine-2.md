J'ai pas rien foutu 😎

## Horaire de travail

Je ne fais pas d'horaire de travail. C'est la première fois que je peux faire un site web pour l'école. Je suis au paradis. Je sais que je vais trouver plus de temps que nécessaire à mettre dans le projet.

## Idées

J'ai exploré 2 idées:

1. Une présentation graphique des circuits _redstone_ dans _Minecraft_. https://minecraft.wiki/w/Redstone_circuits. Quelque chose du genre mais en plus beau. Une genre de vulgarisation des circuits électriques principaux.
2. Un site web sur les fourmis. J'imaginais la vision. Plein de petites fourmis qui évite le curseur de souris quand on le déplace. On pourrait voir à l'intérieur de la colonies, les rôles, etc. Probablement un mix de 2D / 3D.

Et là, boom : idée du Jeu de la vie organique!

![[Pasted image 20260218152423.png]]

J'ai vraiment clencher ça. J'ai fait QUE ÇA pendant 3 jours. Mais bon, très content du résultat.

## Visualisation

Je n'ai pas vraiment fait d'esquisse à la main pour la raison suivante:

Mon concept est directement relié au _game engine_ du jeu de la vie que j'ai développé. Mon premier réflexe a donc été d'expérimenter avec le code sur une page web vierge pour premièrement déterminer si l'idée que j'avais en tête était possible.

Le problème avec cette approche - et d'ailleurs le problème de ma vie - c'est que je ne sépare pas le design avec le développement. Où est la limite entre les deux? J'expérimente avec le code pour voir si mon idée "design" est réalisable, et ensuite je _vibe design_ sans réellement m'assoeir et me poser les questions qu'il faut. Je dirais que j'ai plus ou moins prévu le coup cette fois ci. Dès que j'était satisfait du _game engine_, j'ai réussi calmer mes ardeurs: je suis allé dans _figma_ pour prendre le temps de comparer différentes options et de désigner pour de vrai.

Mais j'ai tout de même complètement désigner le truc en même temps que je le développais... Sauf pour quelques éléments qui m'ont fait hésiter et où je suis allé dans figma pour mettre de l'ordre dans ma tête.

## Sujet choisi

## Développement

### Game engine

![[Screenshot 2026-02-09 at 06-30-20.png]]![[2026-02-09_06-57-35_2.mp4]]
Première expérimentation d'animation

![[2026-02-09_07-10-21_2.mp4]]

Première expérimentation avec un _physics engine_
![[2026-02-09_10-34-44_2.mp4]]![[2026-02-09_10-37-56_2.mp4]]![[2026-02-09_10-40-44_2.mp4]]![[2026-02-09_15-36-37_2.mp4]]![[2026-02-14_04-25-00_2.mp4]]

### Couleurs

![[Pasted image 20260215075218.png]]
Couleurs beaucoup trop mignonnes qui piquent les yeux. Le jeu est ludique, et le physics engine rend cette implementation du Jeu de la vie unique. Je me suis dis, pourquoi ne pas encore plus s'éloigner du pixel art noir et blanc méga nerdy!

### Navigation

Mise à part l'explication des règles du jeu, c'est ici que réside le côté **informatif** du projet.

Objectif:
Permettre à l'utilisateur d'explorer sommairement les différentes structures du Jeu de la vie.

J'ai d'abord commencé par simplement lister les structures sur le côté. Ça faisait très encyclopédie.

![[Pasted image 20260215063902.png]]

Je suis fier de moi. J'apprend. J'AI RÉUSSI À ALLER DANS FIGMA.
C'était payant. Je suis très satisfait du résultat des cartes.

![[Pasted image 20260215064048.png]]

Ça faisait un moment que je visualisais les cartes. Je trouvais que c'était cohérent avec le côté organique du jeu. C'est très ludique et ça fait davantage **informatif**.

![[PXL_20260215_114520221.jpg]]

Bon, pas terrible l'esquisse mais on comprend la vision.

Ensuite, ce sont les catégories de structures qui m'ont fait hésiter.

![[Pasted image 20260215064857.png]]
J'ai d'abord pensé à les mettre comme ceci. J'avais en tête depuis le début d'avoir une autre vue où l'on verrait toutes les catégories et toutes les structures (leur nom) côte à côte.

![[Pasted image 20260215065236.png]]

Extrêmement satisfait de cette navigation pour les catégories.
Il y a un sentiment de progression globale à travers le site. D'ailleurs, c'est l'une de mes plus belles découvertes dans le cours jusqu'à maintenant. Je le savais probablement subconsciemment, que l'on aime avoir devant les yeux sa progression globale, mais là de mettre les mots dessus c'est vraiment un plus. Ça réduit **énormément** la friction d'avoir en permanence devant soi les cinq catégories. Si je les avaient cachées dans une autre vue qu'on retrouve en passant par un bouton, je pense que ça aurait vraiment alourdit la charge mentale.

Satisfait également de la description de chaque catégorie _on hover_ seulement. Au début, comme on peut le voir plus haut, j'imaginais qu'on puisse voir en permanence la catégorie associée à la structure sélectionnée, ainsi qu'à sa description. Et c'est d'ailleurs pour cette raison que j'imaginais avoir une vue séparée pour consulter toutes les catégories.
Mais quelle révélation! Qu'est ce qu'on s'en fout de voir la description de la dite catégorie. Maintenant, on la voit _on hover_ et c'est bien suffisant. Le compromis est un _no brainer_.
