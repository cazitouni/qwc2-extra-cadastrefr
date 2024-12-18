Composant supplémentaires cadastre français pour QWC2
=========================

Ce dépôt contient les composants supplémentaires nécessaires au fonctionnement du cadastre français pour QWC, en utilisant la plateforme du CEREMA.

[https://portaildf.cerema.fr](https://portaildf.cerema.fr)

PlotInfoTool
------------

Plugin pour interroger les informations cadastrales provenant de la plateforme du Cerema.


**`config.json` configuration:**

Il est nécessaire de renseigner les informations suivantes dans le fichier de configuration config.json.

    [...]
      {
        "name": "PlotInfoTool",
        "cfg": {
          "token": "token_portaildf",
          "pdfQueryUrl": "",
          "infoQueries": [
            {
              "key": "locaux",
              "titleMsgId": "Locaux",
              "query": "/locaux"
            },
            {
              "key": "proprietaires",
              "titleMsgId": "Propriétaires",
              "query": "/proprios"
            }
          ],
          "subInfoQueries": [
            {
              "key": "locauxProp",
              "titleMsgId": "Propriétaires locaux",
              "query": "/proprios"
            }
          ]
        }
      },
    [...]

 * `token`: Le token obtenu sur [la plateforme du Cerema](https://portaildf.cerema.fr/structures/966/donnees-services/token-apidf)
 * `pdfQueryUrl`: URL d'une instance de [consultdfrapport](https://github.com/cazitouni/consultdfrapport) pour l'impression du rapport pdf
 * `infoQueries`: Requêtes API permettant de récupérer les informations depuis la plateforme. Chaque requête comprend une clé, un message et la sous-URL de la plateforme.


**`appConfig.js` configuration:**

Il est également nécessaire de modifier le fichier `appConfig.js` de votre installation pour faire fonctionner le plugin.
La ligne suivante doit être ajoutée dans la section `PluginsDef` du fichier :

`PlotInfoToolPlugin: PlotInfoTool`