<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Algorithme de hachage par défaut
    |--------------------------------------------------------------------------
    | Cahier des charges §10 : « Mots de passe hachés avec Argon2id. »
    |
    | Vérifier un hash existant reste indépendant de ce réglage : chaque hash
    | (bcrypt $2y$... ou argon2id $argon2id$...) porte son propre algorithme
    | dans son préfixe, donc Hash::check() continue de vérifier correctement
    | les mots de passe bcrypt déjà en base. Seuls les NOUVEAUX mots de passe
    | (création de compte, réinitialisation) utilisent Argon2id à partir de
    | maintenant — aucune migration de données nécessaire.
    */

    'driver' => env('HASH_DRIVER', 'argon2id'),

    'bcrypt' => [
        'rounds' => env('BCRYPT_ROUNDS', 12),
        'verify' => true,
    ],

    'argon' => [
        // Recommandations OWASP pour Argon2id en contexte serveur web classique.
        'memory'  => env('ARGON_MEMORY', 65536), // 64 Mo
        'threads' => env('ARGON_THREADS', 1),
        'time'    => env('ARGON_TIME', 4),
        'verify'  => true,
    ],

];
