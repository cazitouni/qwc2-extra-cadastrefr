Composant supplémentaires cadastre français pour QWC2
=========================

Ce déépot contient les composant supplémentaire au fonctionnement du cadastre français pour QWC" en utilisant la plateforme du CEREMA 

[https://portaildf.cerema.fr](https://portaildf.cerema.fr)

PlotInfoTool
------------

Plugin pour requeter les informations cadastrales en provenance de la plateforme du Cerema.


**`config.json` configuration:**

Il est nécessaire de compléter les informations suivantes dans le fichier de configuration config.json 

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
 * `infoQueries`: Requêtes API pour permettre de récupérer les informations depuis la plateforme, chaque requête comprend une clé un message et la sous url de la plateforme


**`appConfig.js` configuration:**

Il est également nécessaire de modifier le fichier appConffig.js de votre installation pour faire fonctionner le plugin. 
La ligne suivante est a ajouter dans la partie `PluginsDef` du fichier : 

Sample `PlotInfoToolPlugin` configuration, as can be defined in the `cfg` section of `pluginsDef` in `appConfig.js`:

`PlotInfoToolPlugin: PlotInfoTool`
