// ============================================================
// LEGAL-DOCS-V1 — MentionsLegalesContent (page /mentions-legales)
// ============================================================

"use client";

import Link from "next/link";
import { LegalDocLayout } from "./LegalDocLayout";

export function MentionsLegalesContent() {
  return (
    <LegalDocLayout
      title="Mentions légales"
      version="1.0"
      updatedAt="25 mai 2026"
    >
      <h2>1. Éditeur du site</h2>
      <p>
        Le site <strong>Llmastro</strong>, accessible à l&apos;adresse{" "}
        <a href="https://llmastro.com">https://llmastro.com</a>, est édité par&nbsp;:
      </p>
      <p>
        <strong>KAIROSAST LTD</strong>
        <br />
        Société de droit anglais (<em>Private Limited Company — Limited by Shares</em>)
        <br />
        Immatriculée au registre des sociétés d&apos;Angleterre et du Pays de Galles
        (Companies House)
      </p>
      <ul>
        <li>
          <strong>Numéro d&apos;immatriculation (Company Number)</strong> : [À compléter]
        </li>
        <li>
          <strong>Siège social</strong> : 71-75 Shelton Street, Covent Garden, London
          [code postal à compléter], United Kingdom
        </li>
        <li>
          <strong>Capital social</strong> : 10 GBP
        </li>
      </ul>
      <p>
        <strong>Directeur de la publication</strong> : Adrian Sauzade
        <br />
        <strong>Contact</strong> :{" "}
        <a href="mailto:info@llmastro.com">info@llmastro.com</a>
      </p>
      <p>
        <em>
          KAIROSAST LTD est actuellement en cours de constitution&nbsp;; les informations
          d&apos;immatriculation seront publiées dès leur enregistrement au Companies
          House.
        </em>
      </p>

      <h2>2. Hébergeur</h2>
      <p>Le site est hébergé par&nbsp;:</p>
      <p>
        <strong>Hostinger International Ltd.</strong>
        <br />
        61 Lordou Vironos Street, 6023 Larnaca, Chypre
        <br />
        <a href="https://www.hostinger.com">https://www.hostinger.com</a>
      </p>

      <h2>3. Nature du service</h2>
      <p>
        Llmastro est une <strong>plateforme expérimentale d&apos;astrologie en ligne</strong>{" "}
        proposant&nbsp;:
      </p>
      <ul>
        <li>
          Le calcul de thèmes natals à partir d&apos;éphémérides astronomiques (Swiss
          Ephemeris, tables JPL NASA)&nbsp;;
        </li>
        <li>
          Des observations astrologiques générées par une intelligence artificielle
          conversationnelle&nbsp;;
        </li>
        <li>Des contenus d&apos;horoscope et de synastrie.</li>
      </ul>
      <p>
        Les contenus de la plateforme sont proposés à{" "}
        <strong>
          visée de divertissement, de réflexion personnelle et d&apos;exploration
          symbolique
        </strong>
        . Ils ne constituent en aucun cas un conseil médical, psychologique, juridique,
        financier ou professionnel, et ne sauraient se substituer à l&apos;avis d&apos;un
        professionnel qualifié.
      </p>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        L&apos;ensemble des éléments composant le site Llmastro — incluant sans limitation
        les textes, images, identités visuelles, marques, logos, code source propriétaire,
        interprétations générées, structure des bases de données et présentation graphique
        — est protégé par les législations relatives à la propriété intellectuelle en
        vigueur au Royaume-Uni, en France et dans l&apos;Union européenne.
      </p>
      <p>
        Toute reproduction, représentation, modification, publication, adaptation,
        traduction ou exploitation, totale ou partielle, du site ou de ses éléments, par
        quelque procédé que ce soit, est strictement interdite sans l&apos;autorisation
        écrite préalable de KAIROSAST LTD, sauf exceptions prévues par la loi.
      </p>
      <p>
        Les marques et logos figurant sur le site sont la propriété de KAIROSAST LTD ou de
        leurs titulaires respectifs.
      </p>

      <h2>5. Bibliothèques et données scientifiques</h2>
      <p>Les calculs astronomiques utilisés par Llmastro s&apos;appuient sur&nbsp;:</p>
      <ul>
        <li>
          <strong>Swiss Ephemeris</strong> (Astrodienst AG) — utilisée sous licence&nbsp;;
        </li>
        <li>
          <strong>JPL Planetary and Lunar Ephemerides</strong> (NASA Jet Propulsion
          Laboratory) — données du domaine public.
        </li>
      </ul>
      <p>
        Le détail des sources, des méthodes de calcul et des choix techniques est
        documenté sur la page <Link href="/methode">Méthode</Link>.
      </p>

      <h2>6. Données personnelles</h2>
      <p>
        Le traitement des données personnelles des utilisateurs est décrit en détail dans
        notre <Link href="/confidentialite">Politique de confidentialité</Link>,
        conformément au Règlement Général sur la Protection des Données (RGPD — Règlement
        UE 2016/679), au UK GDPR et au UK Data Protection Act 2018.
      </p>
      <p>
        Pour toute question, demande d&apos;accès, de rectification, d&apos;effacement ou
        d&apos;opposition relative à vos données personnelles, vous pouvez nous contacter à
        l&apos;adresse&nbsp;: <a href="mailto:info@llmastro.com">info@llmastro.com</a>
      </p>

      <h2>7. Cookies</h2>
      <p>
        Le site utilise des cookies strictement nécessaires à son bon fonctionnement,
        ainsi que, sous réserve de votre consentement préalable, des cookies de mesure
        d&apos;audience et de préférences. Les modalités précises de leur utilisation sont
        détaillées dans notre{" "}
        <Link href="/confidentialite">Politique de confidentialité</Link>.
      </p>

      <h2>8. Limitation de responsabilité</h2>
      <p>
        Llmastro est une <strong>plateforme expérimentale en développement actif</strong>.
        Bien que tous les efforts soient mis en œuvre pour garantir l&apos;exactitude des
        calculs et la qualité du service, KAIROSAST LTD ne peut garantir&nbsp;:
      </p>
      <ul>
        <li>
          L&apos;absence d&apos;erreurs ou d&apos;imprécisions dans les contenus générés
          par l&apos;intelligence artificielle&nbsp;;
        </li>
        <li>La disponibilité ininterrompue du service&nbsp;;</li>
        <li>
          L&apos;adéquation parfaite des observations à la situation personnelle de chaque
          utilisateur.
        </li>
      </ul>
      <p>
        Les utilisateurs sont invités à exercer leur libre arbitre et{" "}
        <strong>à ne fonder aucune décision importante</strong> — qu&apos;elle soit
        d&apos;ordre médical, financier, juridique, professionnel ou relationnel — sur le
        seul contenu de la plateforme. En cas de doute, ils sont invités à consulter un
        professionnel qualifié.
      </p>
      <p>
        KAIROSAST LTD ne saurait être tenue responsable des dommages directs ou indirects
        résultant de l&apos;utilisation du site ou de l&apos;interprétation que les
        utilisateurs feraient de ses contenus.
      </p>

      <h2>9. Loi applicable et juridiction</h2>
      <p>
        Les présentes mentions légales sont régies par le <strong>droit anglais</strong>.
        Tout litige relatif au fonctionnement de KAIROSAST LTD relève de la compétence des{" "}
        <strong>tribunaux d&apos;Angleterre et du Pays de Galles</strong>.
      </p>
      <p>
        Conformément aux dispositions protectrices du droit européen et français de la
        consommation, les utilisateurs ayant la qualité de <strong>consommateur</strong>{" "}
        résidant en France ou dans un autre État membre de l&apos;Union européenne
        conservent le bénéfice des <strong>dispositions impératives</strong> de leur loi
        nationale, notamment en matière de droit de la consommation, de protection des
        données personnelles et de juridiction compétente.
      </p>

      <h2>10. Contact</h2>
      <p>
        Pour toute question, demande d&apos;information ou réclamation, vous pouvez nous
        contacter&nbsp;:
      </p>
      <ul>
        <li>
          <strong>Par email</strong> :{" "}
          <a href="mailto:info@llmastro.com">info@llmastro.com</a>
        </li>
        <li>
          <strong>Par courrier</strong> : KAIROSAST LTD, 71-75 Shelton Street, Covent
          Garden, London [code postal à compléter], United Kingdom
        </li>
      </ul>
      <p>Nous nous engageons à répondre à toute demande dans un délai raisonnable.</p>

      <p className="legal-meta">Version 1.0 — 25 mai 2026</p>
    </LegalDocLayout>
  );
}
