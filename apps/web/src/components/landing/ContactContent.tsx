// ============================================================
// CONTACT-FORM-V1 — ContactContent (page /contact)
// ------------------------------------------------------------
// Formulaire de contact public. Même shell « Céleste » que les
// pages légales (Header sticky + StarsBackground + Footer).
// Poste vers POST /contact (api → Resend → CONTACT_INBOX).
// Champ honeypot `website` invisible pour filtrer les bots.
// ============================================================

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Header } from "./Header";
import { StarsBackground } from "@/components/ui/StarsBackground";
import { contactApi } from "@/lib/api/client";
import styles from "./landing.module.css";

type Status = "idle" | "sending" | "sent" | "error";

export function ContactContent() {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus]   = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await contactApi.send({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
        website: website || undefined,
      });
      if (res.success) {
        setStatus("sent");
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      } else {
        setStatus("error");
        setErrorMsg(
          res.error?.message ??
            "L'envoi a échoué. Réessayez ou écrivez-nous directement.",
        );
      }
    } catch (err) {
      setStatus("error");
      const code = (err as { code?: string })?.code;
      if (code === "RATE_LIMIT_EXCEEDED" || code === "FST_ERR_RATE_LIMIT") {
        setErrorMsg(
          "Trop de messages envoyés. Patientez un moment avant de réessayer.",
        );
      } else {
        setErrorMsg(
          "L'envoi a échoué. Réessayez dans un instant, ou écrivez-nous directement à info@llmastro.com.",
        );
      }
    }
  }

  return (
    <>
      <StarsBackground count={80} />
      <div className={styles.page}>
        <Header />
        <main
          style={{
            maxWidth: 620,
            margin: "0 auto",
            padding: "140px 24px 80px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 38,
              fontWeight: 300,
              color: "var(--star)",
              letterSpacing: ".03em",
              marginBottom: 8,
              lineHeight: 1.15,
            }}
          >
            Nous contacter
          </h1>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "var(--muted-2)",
              marginBottom: 36,
              fontFamily: "var(--font-body)",
            }}
          >
            Une question, une remarque ou un souci&nbsp;? Écrivez-nous ci-dessous,
            ou directement à{" "}
            <a href="mailto:info@llmastro.com" className="contact-inline-link">
              info@llmastro.com
            </a>
            . Nous répondons dans un délai raisonnable.
          </p>

          {status === "sent" ? (
            <div className="contact-success">
              <p style={{ margin: 0, fontSize: 16, color: "var(--star)" }}>
                ✦ Merci, votre message a bien été envoyé.
              </p>
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 14,
                  color: "var(--muted-2)",
                }}
              >
                Nous reviendrons vers vous par email dès que possible.
              </p>
              <button
                type="button"
                className="contact-submit"
                style={{ marginTop: 22 }}
                onClick={() => setStatus("idle")}
              >
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="contact-field">
                <label htmlFor="contact-name" className="contact-label">
                  Nom
                </label>
                <input
                  id="contact-name"
                  className="contact-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Votre nom"
                />
              </div>

              <div className="contact-field">
                <label htmlFor="contact-email" className="contact-label">
                  Email
                </label>
                <input
                  id="contact-email"
                  className="contact-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={255}
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                />
              </div>

              <div className="contact-field">
                <label htmlFor="contact-subject" className="contact-label">
                  Objet <span className="contact-optional">(facultatif)</span>
                </label>
                <input
                  id="contact-subject"
                  className="contact-input"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  placeholder="De quoi s'agit-il&nbsp;?"
                />
              </div>

              <div className="contact-field">
                <label htmlFor="contact-message" className="contact-label">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  className="contact-input contact-textarea"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={7}
                  placeholder="Votre message…"
                />
              </div>

              {/* Honeypot anti-bot : invisible, doit rester vide. */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-9999px",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                }}
              >
                <label htmlFor="contact-website">Ne pas remplir</label>
                <input
                  id="contact-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {status === "error" && (
                <p className="contact-error" role="alert">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                className="contact-submit"
                disabled={status === "sending"}
              >
                {status === "sending" ? "Envoi…" : "Envoyer le message"}
              </button>
            </form>
          )}

          <div style={{ marginTop: 40 }}>
            <Link
              href="/"
              style={{
                color: "var(--gold)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              ← Retour à l&apos;accueil
            </Link>
          </div>
        </main>
      </div>

      <style jsx global>{`
        .contact-inline-link {
          color: var(--gold);
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.18s var(--ease-out);
        }
        .contact-inline-link:hover {
          border-bottom-color: var(--gold);
        }
        .contact-field {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
        }
        .contact-label {
          font-family: var(--font-body);
          font-size: 13px;
          letter-spacing: 0.03em;
          color: var(--muted);
          margin-bottom: 7px;
          text-transform: uppercase;
        }
        .contact-optional {
          text-transform: none;
          letter-spacing: 0;
          font-size: 12px;
          color: var(--muted);
          opacity: 0.7;
        }
        .contact-input {
          width: 100%;
          box-sizing: border-box;
          background: var(--bg-2);
          border: 1px solid var(--border-soft);
          border-radius: var(--r-md);
          padding: 12px 14px;
          color: var(--star);
          font-family: var(--font-body);
          font-size: 15px;
          line-height: 1.5;
          transition: border-color 0.18s var(--ease-out),
            box-shadow 0.18s var(--ease-out);
        }
        .contact-input::placeholder {
          color: var(--muted);
          opacity: 0.6;
        }
        .contact-input:focus {
          outline: none;
          border-color: var(--gold);
          box-shadow: 0 0 0 3px rgba(212, 175, 106, 0.12);
        }
        .contact-textarea {
          resize: vertical;
          min-height: 140px;
        }
        .contact-error {
          color: #e0796a;
          font-family: var(--font-body);
          font-size: 14px;
          margin: 4px 0 18px;
        }
        .contact-submit {
          display: inline-block;
          appearance: none;
          cursor: pointer;
          background: var(--gold);
          color: #0d0d15;
          border: none;
          border-radius: 999px;
          padding: 13px 32px;
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.02em;
          transition: opacity 0.18s var(--ease-out),
            transform 0.18s var(--ease-out);
        }
        .contact-submit:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .contact-submit:disabled {
          opacity: 0.55;
          cursor: default;
        }
        .contact-success {
          background: var(--bg-2);
          border: 1px solid var(--border-soft);
          border-radius: var(--r-md);
          padding: 28px 26px;
        }
      `}</style>
    </>
  );
}

// CONTACT-FORM-V1 applied
