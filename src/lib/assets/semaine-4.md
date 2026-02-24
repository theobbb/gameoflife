Bon, dernière semaine de développement.

Il me reste à faire:

- La **landing page**. Là c'est n'importe quoi depuis que j'ai retiré les règles.
- Les **règles** à re-design-er.
- **Header navigation**. Bouton Démarrer/Arrêter + Règles.

S'il me reste du temps et que je suis motivé:

- Un minimum responsive. Sur mon laptop ça le fait mais sur un autre que j'ai essayé on perdait des contrôles. Mais dès que c'est un laptop petit, ou pire, mobile, je criss un écran noir qui dit d'aller sur plus gros.
- Un dialog _import_ .rle pattern.
- Peut être un genre de drawer collapsible pour les contrôles.
- Mouse gestures tooltips info
- Ajouter plus de patterns

## Navigation

C'était problématique. Semaine dernière, le problème était que y'avait trop d'infos sur la landing page et que c'était overwhelming. En particulier pour un utilisateur qui n'est pas familier avec le Jeu de la vie. Simon m'a suggéré de mieux guider l'utilisateur.

Mais ça m'énervait qu'on puisse pas _skip_ les règles à partir de la landing page si on veut pas les voir. Alors j'ai mis en place le header qu'on voit à la semaine 3.

Jeu de la vie -> Règles -> Jeu
où tout est accessible à tout moment.

Mais c'est nul. Ça ne fonctionne ni sur la landing page et ni sur le jeu. À la limite, ça fonctionne pour les règles.

- Landing page: On ne comprend pas qu'il faut cliquer sur les liens en haut. C'est juste pas evident, personne n'est familier avec ce système.
- Jeu: Ça alourdit la navigation d'avoir toutes ces options en haut. D'autant plus que la page est déjà vraiment intense avec toutes les options sur tous les côtés.

---

#### Solution

![[Pasted image 20260221112232.png]]

À partir de la page d'accueil → Guider le nouvel utilisateur vers les règles. Lui permettre tout de même de les sauter grâce à un lien plus discret.
Une fois dans les règles, lui les présenter de manière successive et ensuite diriger vers le jeu. Ici aussi, lui permettre de les sauter.

---

Ici, le bouton **Démarrer** est vraiment invisible. Alors que c'est littéralement le point central de la simulation. Éliminer la navigation en 3 étapes dans le header permet maintenant d'introduire un bouton **Démarrer** qu'on ne peut pas manquer.

Le problème en question (bouton pas assez évident) :

![[Pasted image 20260223082350.png]]

Solution:

![[Pasted image 20260223091106.png]]

Solution 2 :

![[Pasted image 20260224110722.png]]

J'ai décidé d'y aller pour la solution 2 (léger changement) parce que le bouton **Règles du jeu** n'appartient pas aux contrôles. Ça fonctionnait avant qu'il y ait le bouton Démarrer en plein centre, mais plus maintenant parce qu'il se situe entre deux sections qui appartiennent aux contrôles. Le bouton **Règles du jeu** est maintenant relié au titre.

## Landing page

Le bouton pointe maintenant vers les règles. Et on a aussi l'option de les sauter en cliquer sur _Accéder directement au jeu_.

![[Pasted image 20260221112551.png]]

Très content de ce design.
Là, on peut pas dire que c'est overwhelming. Très doux et calme.
J'ai enfin subtilement introduis les cellules zoomed-in derrière. J'avais hâte.

Pas grand chose à dire ici. Je trouve ça simple et efficace.

## Les règles

À la semaine 2, je disais que le coté informatif du site se trouvait simplement dans la présentation des différentes structures du Jeu de la vie. Mais franchement, c'est un peu léger comme dimension instructive. Il s'agit plutôt d'une présentation de mon game engine... Eh oh, tiens, dans le coin on voit le nom des structures. Super instructif !

J'ai donc décidé me m'investir davantage dans la présentation des règles. Aussi, à part le prof qui connait déjà le Jeu de la vie, mes collègues de classe trouve ça bien beau mais ils comprennent pas grand chose au jeu. C'est mauvais signe.

Alors là j'ai mis le paquet. J'ai essayé d'expliquer les règles pour de vrai.

#### Problèmes

Pour l'instant, j'ai:

![[Pasted image 20260221113204.png]]

- Les deux colonnes, c'est une idée de con. Je trouvais ça intéressant de présenter les règles de cette manière-là parce que c'est assez compact, et ça marque la distinction précise entre les deux types de règles (concernant les cellules vivantes vs mortes). Mais ça alourdit beaucoup trop la charge mentale. Je réalise qu'il faut présenter les infos petit à petit. Là, je présente tout d'un coup. C'est efficace, mais pas agréable.
- Aussi, pourquoi est-ce que j'utilise une présentation statique ?? J'imagine que j'avais pas envie de me faire chier. Il est évident que je suis loin d'exploiter le plein potentiel d'un site web et de mes atouts de développeur. Je suis littéralement en train de présenter les règles comme dans un livre.
- Le style n'est pas cohérent avec le reste. Le principe en soi du site c'est de représenter les cellules du Jeu de la vie de façon organique, ce qui rajoute forcément un niveau de complexité. En effet, si je présentais les règles avec le _physics engine_ activé, ce serait vraiment pas rendre service à celui qui veut apprendre les règles pour la première fois. Le pixel art est nettement supérieur pour apprendre les règles. Mais alors ça _clash_ avec l'esthétique du reste.

#### Solutions

- Présenter les règles de manière successive afin de réduire la charge mentale. Et non pas toutes en même temps ultra compactes.
- Introduire un aspect interactif et visuel qui accompagne l'assimilation des règles.
- Tout de même présenter les règles en pixel art. Le problème esthétique n'est pas réellement un problème depuis que la landing page a les cellules du _physics engine_ en arrière plan. On retrouve le style avant et après les règles.

#### Démarche

Je réalise qu'en essayant de re-design-er les règles, je suis d'abord allé voir ce qui se faisait sur d'autres sites web. Mais on se rappelle, les sites web moches. Sur ces sites-là, on présente l'information de façon scientifique: efficace mais intimidante. Ce n'est pas agréable à lire pour un débutant.

Je me suis donc tourner vers le visuel. Comment présente t-on les règles du jeu sur YouTube par exemple? Révélation. Beaucoup plus intuitif.

Notamment:

![[Pasted image 20260223143806.png]]
https://www.youtube.com/watch?v=eMn43As24Bo

J'ai ensuite décortiquer les informations, et surtout, l'ordre dans lequel elles sont présentées pour réduire la charge mentale au maximum. C'est ce qui m'a permis de mettre mon plan sur papier.

#### Plan sur papier

![[Pasted image 20260222152313.png]]
![[Pasted image 20260222152336.png]]
![[Pasted image 20260222152400.png]]
![[Pasted image 20260222152426.png]]

#### Développement

![[2026-02-21_15-13-48_2.mp4]]
![[2026-02-21_18-35-36_2.mp4]]
![[2026-02-21_19-43-22_2.mp4]]
![[2026-02-22_11-28-38_2.mp4]]

![[Pasted image 20260222075856.png]]

Et puis finalement il me reste à terminer la page. La fin de page a comme fonction de:

- Marquer la fin des règles.
- Inviter à débuter l'expérience.
- Expliquer brièvement le côté organique.

![[Pasted image 20260223150652.png]]

## Page trop petite

Page qui bloque le site à < 1300px de largeur. Je me suis pas fait chier.

![[Pasted image 20260223075116.png]]
