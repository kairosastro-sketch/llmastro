# fail2ban — durcissement hôte (VPS prod)

`SECURITY-FAIL2BAN-CADDY-V1`. Ces fichiers sont la **source de vérité versionnée**
des configs fail2ban posées **à la main en root** sur le VPS (Ubuntu 24.04).
Ils ne sont pas appliqués par le déploiement Docker — à recréer si le serveur
est reconstruit.

## Jails

- **`sshd`** — active par défaut sur Debian/Ubuntu (rien à faire). SSH est en clé,
  donc surtout utile pour réduire le bruit des scanners.
- **`caddy-llmastro`** — bannit les IP abusives au niveau HTTP : `status 429`
  (rate-limit applicatif atteint) ou `401/403` répétés sur `/api/auth/*`.

## Prérequis (déjà en place, versionnés dans le repo)

1. Access-log JSON de Caddy → fichier, via la directive `log` dans
   [`caddy/Caddyfile`](../../caddy/Caddyfile) (sortie `/var/log/caddy/access.log`).
2. Bind-mount `/var/log/caddy:/var/log/caddy` du conteneur caddy vers l'hôte,
   dans [`docker-compose.prod.yml`](../../docker-compose.prod.yml), pour que
   fail2ban (host) puisse lire le log.

## Pose / mise à jour (en root sur le VPS)

```bash
sudo cp deploy/fail2ban/filter.d/caddy-llmastro.conf /etc/fail2ban/filter.d/
sudo cp deploy/fail2ban/jail.d/caddy-llmastro.conf   /etc/fail2ban/jail.d/
sudo fail2ban-client reload
sudo fail2ban-client status caddy-llmastro
```

> ⚠️ Le terminal wmux corrompt les longues lignes/heredocs collés. Préférer
> `scp`/`git pull` pour acheminer ces fichiers plutôt qu'un copier-coller.

## Détails techniques

- **Action dans `DOCKER-USER`** : Caddy est dockerisé → le trafic vers le port
  publié passe par `FORWARD`/`DOCKER-USER`, pas `INPUT`. La jail surcharge donc
  `chain="DOCKER-USER"` dans l'action `iptables-multiport`, sinon le ban est
  inefficace. fail2ban crée la règle iptables en **lazy-start** (au 1er ban).
- **Limite** : un restart du démon Docker vide `DOCKER-USER` → les bans en cours
  sautent ; fail2ban rebannit au prochain abus.
- **Débannir** : `sudo fail2ban-client set caddy-llmastro unbanip <IP>`
- **Tester** : `sudo fail2ban-client set caddy-llmastro banip 203.0.113.99`
  puis `sudo iptables -nL DOCKER-USER` (doit montrer le saut `f2b-caddy-llmastro`).
