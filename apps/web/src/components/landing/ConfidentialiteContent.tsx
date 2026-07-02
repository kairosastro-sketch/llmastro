// ============================================================
// LEGAL-DOCS-V1 — ConfidentialiteContent (page /confidentialite)
// Remplace le placeholder LEGAL-PAGES-FIX-V1 / HEADER-LEGAL-PAGES-V2
// par la Politique de confidentialité complète de KAIROSAST LTD.
// ============================================================

"use client";

import Link from "next/link";
import { LegalDocLayout } from "./LegalDocLayout";

export function ConfidentialiteContent() {
  return (
    <LegalDocLayout
      title="Politique de confidentialité"
      version="1.1"
      updatedAt="2 juillet 2026"
    >
      <h2>Préambule</h2>
      <p>
        La présente Politique de confidentialité décrit la manière dont{" "}
        <strong>KAIROSAST LTD</strong> («&nbsp;nous&nbsp;», «&nbsp;notre&nbsp;»,
        l&apos;«&nbsp;Éditeur&nbsp;») collecte, utilise, conserve et protège les données
        personnelles des utilisateurs de la plateforme <strong>Llmastro</strong>{" "}
        accessible à l&apos;adresse <a href="https://llmastro.com">https://llmastro.com</a>{" "}
        (la «&nbsp;Plateforme&nbsp;»).
      </p>
      <p>
        Nous nous engageons à respecter votre vie privée et à traiter vos données
        personnelles dans le respect du{" "}
        <strong>Règlement Général sur la Protection des Données</strong> (Règlement UE
        2016/679, «&nbsp;<strong>RGPD</strong>&nbsp;»), du <strong>UK GDPR</strong>, du{" "}
        <strong>UK Data Protection Act 2018</strong>, et de la{" "}
        <strong>Loi française n° 78-17 du 6 janvier 1978</strong> dite «&nbsp;Informatique
        et Libertés&nbsp;».
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>Le responsable du traitement de vos données personnelles est&nbsp;:</p>
      <p>
        <strong>KAIROSAST LTD</strong>
      </p>
      <ul>
        <li>Numéro d&apos;immatriculation&nbsp;: [À compléter]</li>
        <li>
          Siège social&nbsp;: 71-75 Shelton Street, Covent Garden, London [code postal à
          compléter], United Kingdom
        </li>
        <li>Représentant légal&nbsp;: Adrian Sauzade, Directeur</li>
        <li>
          <strong>Contact protection des données</strong> :{" "}
          <a href="mailto:info@llmastro.com">info@llmastro.com</a>
        </li>
      </ul>
      <p>
        Nous n&apos;avons pas désigné de Délégué à la Protection des Données (DPO), cette
        désignation n&apos;étant pas obligatoire au regard de notre activité. Pour toute
        question relative à vos données, vous pouvez nous écrire à l&apos;adresse
        ci-dessus.
      </p>

      <h2>2. Données personnelles collectées</h2>
      <p>Nous collectons et traitons les catégories de données suivantes&nbsp;:</p>

      <h3>2.1 Données fournies directement par l&apos;Utilisateur</h3>
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Catégorie</th>
              <th>Exemples</th>
              <th>Caractère</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Identification</strong>
              </td>
              <td>Nom ou pseudonyme, adresse email, mot de passe (chiffré)</td>
              <td>Obligatoire pour la création du Compte</td>
            </tr>
            <tr>
              <td>
                <strong>Données de naissance</strong>
              </td>
              <td>Date, heure et lieu de naissance</td>
              <td>Nécessaires au calcul des thèmes astrologiques</td>
            </tr>
            <tr>
              <td>
                <strong>Données relationnelles</strong>
              </td>
              <td>Données de naissance d&apos;un tiers (synastrie)</td>
              <td>
                Facultatif, fournies par l&apos;Utilisateur sous sa responsabilité
              </td>
            </tr>
            <tr>
              <td>
                <strong>Échanges conversationnels</strong>
              </td>
              <td>Questions, messages et requêtes adressés à l&apos;IA</td>
              <td>Nécessaires à la fourniture du Service</td>
            </tr>
            <tr>
              <td>
                <strong>Données de facturation</strong>
              </td>
              <td>Adresse de facturation, historique d&apos;achats</td>
              <td>Obligatoires en cas de souscription</td>
            </tr>
            <tr>
              <td>
                <strong>Communications</strong>
              </td>
              <td>Emails échangés avec notre support</td>
              <td>Selon les besoins de la relation</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>2.2 Données collectées automatiquement</h3>
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Catégorie</th>
              <th>Exemples</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Données techniques</strong>
              </td>
              <td>
                Adresse IP, type de navigateur, système d&apos;exploitation, langue,
                fuseau horaire
              </td>
            </tr>
            <tr>
              <td>
                <strong>Données d&apos;usage</strong>
              </td>
              <td>
                Pages consultées, fonctionnalités utilisées, horodatage des sessions
              </td>
            </tr>
            <tr>
              <td>
                <strong>Cookies et traceurs</strong>
              </td>
              <td>Voir Article 8</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>2.3 Données de paiement</h3>
      <p>
        Les <strong>données de carte bancaire</strong> sont collectées et traitées{" "}
        <strong>directement par notre prestataire de paiement Stripe</strong> (Stripe
        Payments UK Limited / Stripe Payments Europe Limited selon les cas). Nous
        n&apos;avons <strong>jamais accès</strong> au numéro complet de votre carte
        bancaire ni à votre cryptogramme. Nous recevons uniquement les confirmations de
        paiement et un identifiant de transaction.
      </p>

      <h3>2.4 Données concernant les mineurs</h3>
      <p>
        La Plateforme est{" "}
        <strong>réservée aux personnes majeures (18 ans révolus)</strong>. Nous ne
        collectons pas sciemment de données concernant des mineurs. Si vous estimez
        qu&apos;un mineur nous a transmis des données, contactez-nous à{" "}
        <a href="mailto:info@llmastro.com">info@llmastro.com</a> pour suppression.
      </p>

      <h2>3. Finalités et bases légales du traitement</h2>
      <p>
        Conformément à l&apos;article 6 du RGPD, chaque traitement repose sur une base
        légale identifiée&nbsp;:
      </p>
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Finalité</th>
              <th>Base légale RGPD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Création et gestion de votre Compte</td>
              <td>Exécution du contrat (art. 6.1.b)</td>
            </tr>
            <tr>
              <td>Calcul des thèmes astrologiques et fourniture des Contenus</td>
              <td>Exécution du contrat (art. 6.1.b)</td>
            </tr>
            <tr>
              <td>Génération de contenus par IA en réponse à vos requêtes</td>
              <td>Exécution du contrat (art. 6.1.b)</td>
            </tr>
            <tr>
              <td>Gestion des Abonnements et facturation</td>
              <td>Exécution du contrat + obligation légale (art. 6.1.b et c)</td>
            </tr>
            <tr>
              <td>Conservation des justificatifs comptables et fiscaux</td>
              <td>Obligation légale (art. 6.1.c)</td>
            </tr>
            <tr>
              <td>Sécurité du Service, prévention de la fraude et des abus</td>
              <td>Intérêt légitime (art. 6.1.f)</td>
            </tr>
            <tr>
              <td>Amélioration du Service, analyses statistiques anonymisées</td>
              <td>Intérêt légitime (art. 6.1.f)</td>
            </tr>
            <tr>
              <td>Envoi de communications promotionnelles</td>
              <td>Consentement (art. 6.1.a)</td>
            </tr>
            <tr>
              <td>Mesure d&apos;audience anonyme (statistiques sans cookie)</td>
              <td>Intérêt légitime (art. 6.1.f) — solution exemptée de consentement</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Vous pouvez à tout moment <strong>retirer votre consentement</strong> pour les
        traitements fondés sur celui-ci, sans que cela affecte la licéité des traitements
        antérieurs.
      </p>

      <h2>4. Destinataires des données — Sous-traitants</h2>
      <p>
        Nous partageons certaines de vos données avec un nombre limité de prestataires
        techniques, qui agissent en tant que <strong>sous-traitants</strong> au sens de
        l&apos;article 28 du RGPD, sur la base d&apos;un contrat de sous-traitance
        conforme.
      </p>

      <h3>4.1 Catégories de sous-traitants</h3>
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Catégorie</th>
              <th>Prestataire</th>
              <th>Finalité</th>
              <th>Localisation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Hébergement</strong>
              </td>
              <td>Hostinger International Ltd.</td>
              <td>Hébergement de la Plateforme</td>
              <td>Chypre (UE)</td>
            </tr>
            <tr>
              <td>
                <strong>Paiement</strong>
              </td>
              <td>Stripe Payments UK Ltd / Stripe Payments Europe Ltd</td>
              <td>Traitement des paiements</td>
              <td>Royaume-Uni / Irlande</td>
            </tr>
            <tr>
              <td>
                <strong>Intelligence artificielle</strong>
              </td>
              <td>xAI Corp (Grok)</td>
              <td>Génération des contenus astrologiques</td>
              <td>États-Unis</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Chaque sous-traitant est sélectionné pour ses garanties de sécurité et de conformité RGPD.</p>
      <p>
        <em>
          Note&nbsp;: aucun prestataire d&apos;email transactionnel tiers n&apos;est
          utilisé à ce jour. Les emails de service sont envoyés directement depuis nos
          infrastructures hébergées. Cette liste sera mise à jour si la situation évolue.
        </em>
      </p>

      <h3>4.2 Autres destinataires</h3>
      <p>Vos données peuvent également être communiquées&nbsp;:</p>
      <ul>
        <li>
          Aux <strong>autorités administratives ou judiciaires</strong> sur demande légale
          et dûment justifiée&nbsp;;
        </li>
        <li>
          À notre <strong>expert-comptable</strong> et à nos{" "}
          <strong>conseils juridiques</strong> dans le strict cadre de leurs missions&nbsp;;
        </li>
        <li>
          À un <strong>éventuel repreneur</strong> en cas de cession, fusion ou
          restructuration, avec engagement de respect de la présente Politique.
        </li>
      </ul>
      <p>
        Nous <strong>ne vendons jamais</strong> vos données personnelles à des tiers.
      </p>

      <h2>5. Transferts de données hors de l&apos;Union européenne</h2>
      <p>
        Certains de nos sous-traitants (notamment le fournisseur de services
        d&apos;intelligence artificielle xAI) sont susceptibles de traiter vos données
        depuis les <strong>États-Unis</strong> ou d&apos;autres pays hors de l&apos;Espace
        économique européen.
      </p>
      <p>
        Lorsque c&apos;est le cas, nous nous assurons qu&apos;au moins{" "}
        <strong>l&apos;une des garanties suivantes</strong> est en place&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Décision d&apos;adéquation</strong> de la Commission européenne (par
          exemple, le <em>EU-US Data Privacy Framework</em> pour les entreprises
          américaines certifiées)&nbsp;;
        </li>
        <li>
          <strong>Clauses Contractuelles Types</strong> (CCT) adoptées par la Commission
          européenne&nbsp;;
        </li>
        <li>
          <strong>Mesures techniques supplémentaires</strong> (chiffrement,
          pseudonymisation) lorsque nécessaire.
        </li>
      </ul>
      <p>
        Vous pouvez nous contacter à{" "}
        <a href="mailto:info@llmastro.com">info@llmastro.com</a> pour obtenir copie ou
        information sur les garanties applicables à un transfert spécifique.
      </p>

      <h2>6. Durées de conservation</h2>
      <p>
        Vos données sont conservées pour la durée strictement nécessaire aux finalités
        poursuivies&nbsp;:
      </p>
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Catégorie</th>
              <th>Durée de conservation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Données de Compte</td>
              <td>
                Tant que le Compte est actif, puis <strong>2 ans</strong> après la
                dernière connexion en cas d&apos;inactivité, sauf demande de suppression
              </td>
            </tr>
            <tr>
              <td>Données de thèmes natals et conversations IA</td>
              <td>Pendant la vie du Compte&nbsp;; suppression définitive après clôture</td>
            </tr>
            <tr>
              <td>Données de facturation et justificatifs comptables</td>
              <td>
                <strong>10 ans</strong> à compter de l&apos;opération (obligation légale)
              </td>
            </tr>
            <tr>
              <td>Données de prospection et marketing</td>
              <td>
                <strong>3 ans</strong> à compter du dernier contact, ou jusqu&apos;au
                retrait du consentement
              </td>
            </tr>
            <tr>
              <td>Logs techniques de sécurité</td>
              <td>
                <strong>12 mois</strong> maximum
              </td>
            </tr>
            <tr>
              <td>Cookies</td>
              <td>Voir Article 8</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        À l&apos;expiration de ces durées, vos données sont{" "}
        <strong>supprimées ou anonymisées</strong> de façon irréversible.
      </p>

      <h2>7. Vos droits</h2>
      <p>
        Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants sur
        vos données personnelles&nbsp;:
      </p>

      <h3>7.1 Droit d&apos;accès (art. 15)</h3>
      <p>
        Vous pouvez demander la confirmation que vos données sont traitées et obtenir une
        copie des données vous concernant.
      </p>
      <h3>7.2 Droit de rectification (art. 16)</h3>
      <p>Vous pouvez demander la correction de données inexactes ou incomplètes.</p>
      <h3>7.3 Droit à l&apos;effacement / «&nbsp;droit à l&apos;oubli&nbsp;» (art. 17)</h3>
      <p>
        Vous pouvez demander la suppression de vos données, sous réserve de nos
        obligations légales de conservation.
      </p>
      <h3>7.4 Droit à la limitation du traitement (art. 18)</h3>
      <p>
        Vous pouvez demander la suspension temporaire du traitement de vos données dans
        certains cas.
      </p>
      <h3>7.5 Droit à la portabilité (art. 20)</h3>
      <p>
        Vous pouvez demander à recevoir vos données dans un format structuré, couramment
        utilisé et lisible par machine, ou demander leur transmission directe à un autre
        responsable de traitement.
      </p>
      <h3>7.6 Droit d&apos;opposition (art. 21)</h3>
      <p>
        Vous pouvez vous opposer, à tout moment et pour des raisons tenant à votre
        situation particulière, au traitement de vos données fondé sur notre intérêt
        légitime. Vous pouvez vous opposer <strong>sans motif</strong> au traitement à des
        fins de prospection.
      </p>
      <h3>7.7 Droit de retirer votre consentement</h3>
      <p>
        Lorsque le traitement repose sur votre consentement, vous pouvez le retirer à tout
        moment, sans que cela affecte la licéité des traitements antérieurs.
      </p>
      <h3>7.8 Droit de définir des directives post-mortem</h3>
      <p>
        Vous pouvez définir des directives relatives au sort de vos données après votre
        décès (article 85 de la loi française n° 78-17).
      </p>

      <h3>7.9 Modalités d&apos;exercice</h3>
      <p>
        Depuis votre compte, vous pouvez exercer en libre-service&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Droit d&apos;accès et portabilité</strong> — bouton «&nbsp;Télécharger
          mes données&nbsp;» dans la rubrique «&nbsp;Tes données&nbsp;» de votre page
          Mon compte. Vous obtenez un export JSON complet de l&apos;ensemble des données
          vous concernant (profils natals, lectures, conversations, notifications,
          abonnement).
        </li>
        <li>
          <strong>Droit à l&apos;effacement</strong> — bouton «&nbsp;Supprimer mon
          compte&nbsp;» dans la rubrique «&nbsp;Zone dangereuse&nbsp;» de votre page Mon
          compte. La suppression devient définitive après une période de grâce de 30
          jours pendant laquelle vous pouvez l&apos;annuler en vous reconnectant.
        </li>
      </ul>
      <p>
        Pour toute autre demande (rectification, opposition, limitation, directives
        post-mortem, etc.), contactez-nous à{" "}
        <a href="mailto:info@llmastro.com">info@llmastro.com</a> en précisant votre
        demande et en justifiant de votre identité si nécessaire.
      </p>
      <p>
        Nous répondons à votre demande dans un délai d&apos;<strong>un (1) mois</strong>,
        prorogeable de deux (2) mois en cas de complexité ou de volume important.
      </p>

      <h3>7.10 Réclamation auprès d&apos;une autorité de contrôle</h3>
      <p>
        Si vous estimez que le traitement de vos données enfreint la réglementation, vous
        avez le droit d&apos;introduire une réclamation auprès d&apos;une autorité de
        contrôle, en particulier&nbsp;:
      </p>
      <ul>
        <li>
          <strong>CNIL</strong> (France) — Commission Nationale de l&apos;Informatique et
          des Libertés
          <br />
          3 place de Fontenoy, TSA 80715, 75334 PARIS CEDEX 07
          <br />
          <a href="https://www.cnil.fr">https://www.cnil.fr</a>
        </li>
        <li>
          <strong>ICO</strong> (Royaume-Uni) — Information Commissioner&apos;s Office
          <br />
          Wycliffe House, Water Lane, Wilmslow, Cheshire SK9 5AF
          <br />
          <a href="https://ico.org.uk">https://ico.org.uk</a>
        </li>
        <li>ou l&apos;autorité de contrôle de l&apos;État membre de votre résidence habituelle.</li>
      </ul>

      <h2>8. Cookies et traceurs</h2>
      <h3>8.1 Définition</h3>
      <p>
        Un cookie est un petit fichier déposé sur votre terminal lors de la visite
        d&apos;un site, qui permet de stocker des informations utiles à votre navigation.
      </p>
      <h3>8.2 Types de cookies utilisés</h3>
      <div className="legal-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Finalité</th>
              <th>Consentement requis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Strictement nécessaires</strong>
              </td>
              <td>Authentification, sécurité, panier d&apos;achat</td>
              <td>Non (exemptés par l&apos;art. 82 LIL)</td>
            </tr>
            <tr>
              <td>
                <strong>Fonctionnels</strong>
              </td>
              <td>Mémorisation de vos préférences (langue, thème)</td>
              <td>Oui</td>
            </tr>
            <tr>
              <td>
                <strong>Mesure d&apos;audience</strong>
              </td>
              <td>Statistiques de fréquentation anonymes, sans cookie (solution auto-hébergée)</td>
              <td>Non — solution exemptée CNIL (voir 8.5)</td>
            </tr>
            <tr>
              <td>
                <strong>Marketing</strong>
              </td>
              <td>Aucun à ce jour</td>
              <td>–</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>8.3 Gestion des cookies</h3>
      <p>
        La Plateforme ne dépose que des <strong>cookies strictement nécessaires</strong>{" "}
        (authentification, sécurité) et n&apos;utilise <strong>aucun cookie publicitaire
        ni traceur tiers</strong>. Notre mesure d&apos;audience fonctionne{" "}
        <strong>sans cookie</strong> (voir 8.5). Pour cette raison,{" "}
        <strong>aucun bandeau de consentement aux cookies n&apos;est nécessaire</strong>.
      </p>
      <p>Vous pouvez à tout moment&nbsp;:</p>
      <ul>
        <li>configurer votre navigateur pour bloquer tout ou partie des cookies&nbsp;;</li>
        <li>
          utiliser une extension de blocage&nbsp;: notre mesure d&apos;audience étant
          anonyme et auto-hébergée, la bloquer n&apos;a aucun impact sur votre navigation.
        </li>
      </ul>
      <p>
        Le refus des cookies strictement nécessaires peut empêcher l&apos;utilisation
        normale de la Plateforme.
      </p>

      <h3>8.4 Durée des cookies</h3>
      <p>
        Les cookies déposés ont une durée maximale de <strong>13 mois</strong>{" "}
        conformément aux recommandations de la CNIL. Les données collectées via les
        cookies sont conservées pour une durée maximale de <strong>25 mois</strong>.
      </p>

      <h3>8.5 Mesure d&apos;audience de la Plateforme</h3>
      <p>
        Pour comprendre comment la Plateforme est utilisée et l&apos;améliorer, nous
        utilisons <strong>Umami</strong>, une solution de mesure d&apos;audience{" "}
        <strong>auto-hébergée sur nos propres serveurs</strong> (Union européenne).
        Aucune donnée n&apos;est transmise à un tiers, à un réseau publicitaire ou à
        Google, et <strong>nous ne revendons jamais</strong> ces statistiques.
      </p>
      <p>
        Cette mesure est <strong>sans cookie</strong> et <strong>anonyme</strong>&nbsp;:
        elle ne dépose aucun fichier sur votre terminal, ne crée aucun identifiant
        publicitaire et n&apos;établit aucun profil vous concernant. Elle relève des
        solutions de mesure d&apos;audience <strong>exemptées de consentement</strong> par
        la CNIL&nbsp;; c&apos;est pourquoi aucun bandeau ne vous est demandé pour
        l&apos;activer.
      </p>
      <p>Nous enregistrons uniquement, de façon agrégée&nbsp;:</p>
      <ul>
        <li>
          la <strong>page consultée</strong> et la <strong>page d&apos;origine</strong>{" "}
          (référent)&nbsp;;
        </li>
        <li>
          des informations techniques générales&nbsp;: type de navigateur et de système
          d&apos;exploitation, type d&apos;appareil, langue et <strong>pays</strong>&nbsp;;
        </li>
        <li>la date et l&apos;heure de la visite.</li>
      </ul>
      <p>
        Votre <strong>adresse IP</strong> est utilisée de façon <strong>éphémère</strong>{" "}
        pour en déduire le pays, puis <strong>n&apos;est pas conservée</strong>. Le
        décompte des visiteurs uniques repose sur un identifiant technique{" "}
        <strong>haché et renouvelé chaque jour</strong>, qui ne permet ni de vous
        identifier ni de vous suivre d&apos;un jour ou d&apos;un site à l&apos;autre. Ces
        statistiques sont conservées sous forme <strong>agrégée</strong> et servent
        exclusivement à améliorer la Plateforme.
      </p>

      <h2>9. Intelligence artificielle et décisions automatisées</h2>
      <h3>9.1 Information de transparence</h3>
      <p>
        Conformément au Règlement UE 2024/1689 sur l&apos;intelligence artificielle
        («&nbsp;<strong>AI Act</strong>&nbsp;»), nous vous informons que la Plateforme
        utilise des <strong>systèmes d&apos;intelligence artificielle générative</strong>{" "}
        pour produire les observations astrologiques.
      </p>
      <h3>9.2 Données transmises aux fournisseurs d&apos;IA</h3>
      <p>
        Pour fournir le Service, certaines de vos données (notamment vos données de thème
        natal et vos messages) sont transmises à notre fournisseur d&apos;IA (xAI). Nous
        mettons en œuvre des mesures pour limiter les données transmises au strict
        nécessaire et, lorsque possible, <strong>pseudonymiser ces données</strong> avant
        transmission.
      </p>
      <h3>9.3 Absence de décision automatisée à effet juridique</h3>
      <p>
        Les Contenus générés par l&apos;IA{" "}
        <strong>
          ne constituent pas des décisions individuelles automatisées produisant des
          effets juridiques
        </strong>{" "}
        ou affectant significativement votre situation au sens de l&apos;article 22 du
        RGPD. Ils sont fournis à visée informative, symbolique et de divertissement.
      </p>
      <h3>9.4 Vos données ne servent pas à entraîner l&apos;IA</h3>
      <p>
        Nous nous assurons contractuellement, dans la mesure des engagements de nos
        sous-traitants, que{" "}
        <strong>
          vos données ne sont pas utilisées pour entraîner ou améliorer les modèles
          d&apos;IA
        </strong>{" "}
        de tiers.
      </p>

      <h2>10. Sécurité de vos données</h2>
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles appropriées
        pour protéger vos données contre la perte, l&apos;altération ou l&apos;accès non
        autorisé, notamment&nbsp;:
      </p>
      <ul>
        <li>chiffrement des données en transit (TLS/HTTPS)&nbsp;;</li>
        <li>chiffrement des mots de passe au repos (hachage avec sel)&nbsp;;</li>
        <li>contrôle d&apos;accès strict aux bases de données&nbsp;;</li>
        <li>sauvegardes régulières&nbsp;;</li>
        <li>mises à jour de sécurité régulières&nbsp;;</li>
        <li>audits et tests réguliers de nos infrastructures.</li>
      </ul>
      <p>
        En cas de <strong>violation de données personnelles</strong> susceptible
        d&apos;engendrer un risque pour vos droits et libertés, nous notifierons
        l&apos;autorité de contrôle compétente dans les <strong>72 heures</strong>, et
        vous informerons sans délai indu lorsque la loi l&apos;impose.
      </p>

      <h2>11. Modifications de la Politique de confidentialité</h2>
      <p>
        Nous pouvons être amenés à modifier la présente Politique pour refléter des
        évolutions légales, techniques ou de notre Service.
      </p>
      <p>
        En cas de modification <strong>substantielle</strong>, nous vous en informerons
        par email ou par notification visible sur la Plateforme{" "}
        <strong>au moins 30 jours avant son entrée en vigueur</strong>. La date de
        dernière mise à jour est indiquée en haut du document.
      </p>

      <h2>12. Contact</h2>
      <p>
        Pour toute question relative à vos données personnelles ou à la présente
        Politique&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Email</strong> :{" "}
          <a href="mailto:info@llmastro.com">info@llmastro.com</a>
        </li>
        <li>
          <strong>Courrier</strong> : KAIROSAST LTD, 71-75 Shelton Street, Covent Garden,
          London [code postal à compléter], United Kingdom
        </li>
      </ul>
      <p>
        Nous nous engageons à vous répondre dans les meilleurs délais et au plus tard sous{" "}
        <strong>un (1) mois</strong>.
      </p>
      <p>
        Voir aussi&nbsp;: <Link href="/cgu">CGU/CGV</Link> ·{" "}
        <Link href="/mentions-legales">Mentions légales</Link>
      </p>

      <p className="legal-meta">Version 1.1 — 2 juillet 2026</p>
    </LegalDocLayout>
  );
}
